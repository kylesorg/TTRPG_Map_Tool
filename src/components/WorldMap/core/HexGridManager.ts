import * as PIXI from 'pixi.js';
import { HexRenderer } from './HexRenderer';
import { HexEventHandler, type HexEventHandlerConfig } from './HexEventHandler';
import { HexViewportManager, type ViewportConfig } from './HexViewportManager';
import { HexLayerManager, type LayerManagerConfig, type LayerContainers } from './HexLayerManager';
import { generateHexTextures } from '../../../utils/hexTextureGenerator';
import { axialToPixelOriented, pixelToAxialOriented, type HexOrientation } from '../../../utils/hexMath'; // NEW: Import pixelToAxialOriented
import { GRID_ROWS, GRID_COLS } from '../../../utils/constants';
import type { HexTile, DrawingPath } from '../../../types/mapTypes';
import type { ToolMode } from '../../../types/sharedTypes';
import type { GeographyImageData } from '../../../utils/geographyImageManager';

export interface HexGridManagerConfig {
    tileSize: number;
    maxZoomLevel: number;
    hexBuffer: number;
    viewSettings: {
        showTownNames: boolean;
    };
    gridLineThickness: number;
    gridLineColor: string;
    textScale: number;
    hexOrientation?: HexOrientation; // NEW: Add hex orientation to config
    onHexClick: (hex: HexTile) => void;
    onPaintHexBatch: (batch: Array<{ hexId: string }>, tool: ToolMode) => void;
    onPaintComplete?: (lastPaintedHex: HexTile) => void;
    onNewPath?: (newPath: DrawingPath) => void;
    onErasePaths?: (erasePoint: { x: number; y: number }, eraseRadius: number) => void;
    onVisibleHexesChange?: (count: number, zoom: number) => void;
}

export class HexGridManager {
    private app: PIXI.Application;
    private containerNode: HTMLElement;
    private config: HexGridManagerConfig;

    // Core modules
    private renderer: HexRenderer | null = null;
    private eventHandler: HexEventHandler | null = null;
    private viewport: HexViewportManager | null = null;
    private layerManager: HexLayerManager | null = null;

    // Container references
    private containers: LayerContainers | null = null;

    // State
    private hexTiles: HexTile[] = [];
    private initialized = false;
    private cleanupFunctions: (() => void)[] = [];

    constructor(app: PIXI.Application, containerNode: HTMLElement, config: HexGridManagerConfig) {
        this.app = app;
        this.containerNode = containerNode;
        this.config = config;
    }

    /**
     * Initializes all hex grid components
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.warn('[HexGridManager] Already initialized');
            return;
        }

        // Create layer containers
        this.containers = this.createLayerContainers();

        // Initialize layer manager (orientation-aware)
        const layerConfig: LayerManagerConfig = {
            tileSize: this.config.tileSize,
            hexOrientation: this.config.hexOrientation || 'flat-top',
            viewSettings: this.config.viewSettings,
            gridLineThickness: this.config.gridLineThickness,
            gridLineColor: this.config.gridLineColor,
            textScale: this.config.textScale
        };
        this.layerManager = new HexLayerManager(layerConfig, this.containers, this.app);

        // Generate hex textures (orientation-aware)
        const textures = generateHexTextures(this.app, this.config.tileSize, {
            borderWidth: this.config.gridLineThickness,
            borderColor: this.config.gridLineColor,
            orientation: this.config.hexOrientation || 'flat-top'
        });

        // Initialize renderer (orientation-aware)
        this.renderer = new HexRenderer(
            this.containers.hexFills,
            this.containers.hexBorders,
            this.containers.highlight,
            this.config.tileSize,
            this.config.hexOrientation || 'flat-top'
        );
        this.renderer.setTextures(textures);

        // Initialize viewport manager
        const viewportConfig: ViewportConfig = {
            maxZoomLevel: this.config.maxZoomLevel,
            minZoomLevel: 0.1,
            onViewportChange: () => {
                this.updateVisibleHexes();
            },
            onPanStateChange: (isPanning: boolean, didPan: boolean) => {
                // Update event handler with panning state
                if (this.eventHandler) {
                    this.eventHandler.updatePanningState(isPanning, didPan);
                }
            }
        };
        this.viewport = new HexViewportManager(
            viewportConfig,
            this.layerManager.getAllContainers(),
            this.containerNode
        );

        // Initialize event handler (orientation-aware)
        const eventConfig: HexEventHandlerConfig = {
            tileSize: this.config.tileSize,
            hexOrientation: this.config.hexOrientation || 'flat-top',
            onHexClick: this.config.onHexClick,
            onPaintHexBatch: this.config.onPaintHexBatch,
            onPaintComplete: this.config.onPaintComplete,
            onNewPath: this.config.onNewPath,
            onLiveDrawing: (liveDrawingData) => {
                if (this.layerManager) {
                    this.layerManager.renderLiveDrawing(liveDrawingData);
                }
            },
            onErasePaths: this.config.onErasePaths,
            gridManager: this // NEW: Pass grid manager reference for better coordinate conversion
        };
        this.eventHandler = new HexEventHandler(eventConfig, this.containers.hexFills);

        // Set up event listeners
        const cleanupViewport = this.viewport.setupEventListeners();
        this.cleanupFunctions.push(cleanupViewport);

        this.eventHandler.setupPixiEventHandlers();

        this.initialized = true;
    }

    /**
     * Creates and configures all layer containers
     */
    private createLayerContainers(): LayerContainers {
        const containers: LayerContainers = {
            background: new PIXI.Container(),
            hexFills: new PIXI.Container(),
            hexBorders: new PIXI.Container(),
            geography: new PIXI.Container(),
            liveDrawing: new PIXI.Container(),
            townNames: new PIXI.Container(),
            highlight: new PIXI.Container()
        };

        // Add all containers to stage
        Object.values(containers).forEach(container => {
            this.app.stage.addChild(container);
        });

        return containers;
    }

    /**
     * Gets the center coordinates of the hex grid
     */
    private getGridCenterCoordinates(): { q: number; r: number } {
        // Calculate the center based on user coordinates, then convert to axial
        const centerUserX = Math.floor(GRID_COLS / 2);
        const centerUserY = Math.floor(GRID_ROWS / 2);

        if (this.config.hexOrientation === 'pointy-top') {
            // For pointy-top: use even-r offset coordinate conversion
            const offsetCol = centerUserX;
            const offsetRow = (GRID_ROWS - 1) - centerUserY;
            const q_axial_offset = -Math.floor(GRID_COLS / 2);
            const r_axial_offset = -Math.floor(GRID_ROWS / 2);

            const q_axial = offsetCol - (offsetRow + (offsetRow & 1)) / 2 + q_axial_offset;
            const r_axial = offsetRow + r_axial_offset;

            return { q: q_axial, r: r_axial };
        } else {
            // For flat-top: use even-q offset coordinate conversion (existing logic)
            const vCol = centerUserX;
            const vRow_from_top = (GRID_ROWS - 1) - centerUserY;
            const r_axial_offset = -(GRID_ROWS - 1);

            const q_prime = vCol;
            const r_prime = vRow_from_top - (vCol + (vCol & 1)) / 2;
            const q_axial = q_prime;
            const r_axial = r_prime + r_axial_offset;

            return { q: q_axial, r: r_axial };
        }
    }

    /**
     * Debug method to analyze hex grid coordinate ranges
     */
    debugCoordinateRanges(silent: boolean = false): void {
        // Add a static counter to prevent infinite logging
        if (!(window as any).debugCoordinateCount) {
            (window as any).debugCoordinateCount = 0;
        }

        (window as any).debugCoordinateCount++;

        // Only log the first 5 times, then silently return
        if ((window as any).debugCoordinateCount > 5 || silent) {
            return;
        }

        if (this.hexTiles.length > 0) {
            // Use safer operations to avoid stack overflow with large arrays
            let minQ = Infinity, maxQ = -Infinity;
            let minR = Infinity, maxR = -Infinity;
            let minLabelX = Infinity, maxLabelX = -Infinity;
            let minLabelY = Infinity, maxLabelY = -Infinity;
            let labelXCount = 0, labelYCount = 0;

            // Iterate once to find min/max values safely
            for (const hex of this.hexTiles) {
                minQ = Math.min(minQ, hex.coordinates.q);
                maxQ = Math.max(maxQ, hex.coordinates.q);
                minR = Math.min(minR, hex.coordinates.r);
                maxR = Math.max(maxR, hex.coordinates.r);

                if (hex.labelX !== undefined) {
                    minLabelX = Math.min(minLabelX, hex.labelX);
                    maxLabelX = Math.max(maxLabelX, hex.labelX);
                    labelXCount++;
                }

                if (hex.labelY !== undefined) {
                    minLabelY = Math.min(minLabelY, hex.labelY);
                    maxLabelY = Math.max(maxLabelY, hex.labelY);
                    labelYCount++;
                }
            }

            // Sample hex for detailed analysis (reduced logging)
            if ((window as any).debugCoordinateCount <= 1) {
                const sampleHex = this.hexTiles[0];
                const lastHex = this.hexTiles[this.hexTiles.length - 1];

                console.log('[HexGridManager] Hex grid coordinate analysis:', {
                    totalHexes: this.hexTiles.length,
                    axialRanges: {
                        q: { min: minQ, max: maxQ },
                        r: { min: minR, max: maxR }
                    },
                    labelRanges: {
                        X: labelXCount > 0 ? { min: minLabelX, max: maxLabelX } : 'No labelX values',
                        Y: labelYCount > 0 ? { min: minLabelY, max: maxLabelY } : 'No labelY values'
                    },
                    sampleHexes: {
                        first: { id: sampleHex.id, labelX: sampleHex.labelX, labelY: sampleHex.labelY },
                        last: { id: lastHex.id, labelX: lastHex.labelX, labelY: lastHex.labelY }
                    }
                });
            }

            // Check for common coordinate issues
            const hasNegativeQ = minQ < 0;
            const hasNegativeR = minR < 0; // Note: Negative R is normal for flat-top even-q conversion
            const missingLabels = labelXCount === 0 || labelYCount === 0;

            // Only warn about actual issues (negative Q or missing labels)
            // Negative R is expected in flat-top even-q to axial conversion
            if (hasNegativeQ || missingLabels) {
                console.warn('[HexGridManager] Coordinate system issues detected:', {
                    hasNegativeQ,
                    hasNegativeR: hasNegativeR ? '(expected for flat-top)' : false,
                    missingLabels,
                    expectedGridSize: `${GRID_COLS} x ${GRID_ROWS}`,
                    note: hasNegativeQ ? 'Negative Q coordinates indicate grid generation issues' :
                        missingLabels ? 'Missing label coordinates will cause display issues' : ''
                });
            } else {
                console.log('[HexGridManager] ✓ Coordinate system appears healthy', {
                    hasNegativeR: hasNegativeR ? '(expected for flat-top)' : false,
                    totalHexes: this.hexTiles.length,
                    expectedGridSize: `${GRID_COLS} x ${GRID_ROWS}`
                });
            }
        } else {
            console.log('[HexGridManager] No hex tiles to analyze');
        }
    }

    /**
     * Enhanced debug method with more detailed coordinate information
     */
    debugCoordinatesDetailed(): void {
        if (this.hexTiles.length === 0) {
            console.log('[HexGridManager] No hex tiles to analyze');
            return;
        }

        let minQ = Infinity, maxQ = -Infinity;
        let minR = Infinity, maxR = -Infinity;
        let minLabelX = Infinity, maxLabelX = -Infinity;
        let minLabelY = Infinity, maxLabelY = -Infinity;
        let labelXCount = 0, labelYCount = 0;

        // Sample coordinates from different parts of the grid
        const coordinateSamples: Array<{ index: number, hex: any }> = [];
        const sampleIndices = [
            0,
            Math.floor(this.hexTiles.length * 0.25),
            Math.floor(this.hexTiles.length * 0.5),
            Math.floor(this.hexTiles.length * 0.75),
            this.hexTiles.length - 1
        ];

        // Iterate once to find min/max values and collect samples
        for (let i = 0; i < this.hexTiles.length; i++) {
            const hex = this.hexTiles[i];

            minQ = Math.min(minQ, hex.coordinates.q);
            maxQ = Math.max(maxQ, hex.coordinates.q);
            minR = Math.min(minR, hex.coordinates.r);
            maxR = Math.max(maxR, hex.coordinates.r);

            if (hex.labelX !== undefined) {
                minLabelX = Math.min(minLabelX, hex.labelX);
                maxLabelX = Math.max(maxLabelX, hex.labelX);
                labelXCount++;
            }

            if (hex.labelY !== undefined) {
                minLabelY = Math.min(minLabelY, hex.labelY);
                maxLabelY = Math.max(maxLabelY, hex.labelY);
                labelYCount++;
            }

            // Collect samples
            if (sampleIndices.includes(i)) {
                coordinateSamples.push({ index: i, hex });
            }
        }

        console.log('[HexGridManager] DETAILED Coordinate Analysis:', {
            gridInfo: {
                totalHexes: this.hexTiles.length,
                expectedDimensions: `${GRID_COLS} x ${GRID_ROWS}`,
                calculatedTotal: GRID_COLS * GRID_ROWS,
                matches: this.hexTiles.length === (GRID_COLS * GRID_ROWS)
            },
            axialCoordinates: {
                q: { min: minQ, max: maxQ, range: maxQ - minQ + 1 },
                r: { min: minR, max: maxR, range: maxR - minR + 1 }
            },
            labelCoordinates: {
                X: labelXCount > 0 ? { min: minLabelX, max: maxLabelX, range: maxLabelX - minLabelX + 1, count: labelXCount } : 'MISSING',
                Y: labelYCount > 0 ? { min: minLabelY, max: maxLabelY, range: maxLabelY - minLabelY + 1, count: labelYCount } : 'MISSING'
            },
            coordinateSamples: coordinateSamples.map(sample => ({
                position: `${sample.index}/${this.hexTiles.length}`,
                id: sample.hex.id,
                axial: sample.hex.coordinates,
                label: { X: sample.hex.labelX, Y: sample.hex.labelY }
            })),
            issues: {
                hasNegativeQ: minQ < 0,
                hasNegativeR: minR < 0,
                missingLabels: labelXCount === 0 || labelYCount === 0,
                unexpectedTotalCount: this.hexTiles.length !== (GRID_COLS * GRID_ROWS)
            }
        });

        // Check coordinate system consistency
        // Note: For flat-top even-q to axial conversion, the ranges are not simply GRID_COLS-1 and GRID_ROWS-1
        // The actual ranges depend on the coordinate transformation used in grid generation

        // Calculate expected ranges based on the actual coordinate transformation logic
        // This matches the logic in generateFlatTopGrid()
        const expectedQRange = GRID_COLS - 1; // Q range is straightforward: 0 to GRID_COLS-1

        // For R range with flat-top even-q conversion, we need to calculate based on the transformation:
        // r_axial = r_prime + r_axial_offset where r_axial_offset = -(GRID_ROWS - 1)
        // The r_prime values depend on the even-q conversion: r_prime = vRow_from_top - (vCol + (vCol & 1)) / 2
        // With vRow_from_top ranging from 0 to GRID_ROWS-1 and vCol from 0 to GRID_COLS-1
        // The minimum r_prime occurs at the top-right corner: (GRID_ROWS-1) - (GRID_COLS-1 + ((GRID_COLS-1) & 1)) / 2
        // The maximum r_prime occurs at bottom-left corner: 0 - (0 + (0 & 1)) / 2 = 0
        const r_axial_offset = -(GRID_ROWS - 1);
        const minRPrime = (GRID_ROWS - 1) - Math.floor((GRID_COLS - 1 + ((GRID_COLS - 1) & 1)) / 2);
        const maxRPrime = 0;
        const expectedMinR = minRPrime + r_axial_offset;
        const expectedMaxR = maxRPrime + r_axial_offset;
        const expectedRRange = expectedMaxR - expectedMinR;

        const actualQRange = maxQ - minQ;
        const actualRRange = maxR - minR;

        if (actualQRange !== expectedQRange || actualRRange !== expectedRRange) {
            console.warn('[HexGridManager] Coordinate range mismatch:', {
                expected: {
                    qRange: expectedQRange,
                    rRange: expectedRRange,
                    rMin: expectedMinR,
                    rMax: expectedMaxR
                },
                actual: {
                    qRange: actualQRange,
                    rRange: actualRRange,
                    rMin: minR,
                    rMax: maxR
                },
                note: 'This suggests the grid generation or coordinate system has issues'
            });
        } else {
            console.log('[HexGridManager] ✓ Coordinate ranges match expected values for flat-top even-q conversion');
        }

        // Expose this function globally
        (window as any).debugCoordinatesDetailed = () => this.debugCoordinatesDetailed();
    }

    /**
     * Debug method to get current drawing layer state
     */
    debugDrawingState(): void {
        if (this.layerManager) {
            const geographyState = this.layerManager.debugGeographyContainer();
            console.log('[HexGridManager] Drawing state debug:', {
                geographyContainerInfo: geographyState
            });
        } else {
            console.log('[HexGridManager] LayerManager not available for drawing debug');
        }

        // Expose this globally
        (window as any).debugDrawingState = () => this.debugDrawingState();
    }

    /**
     * Getter method to access hex tiles for debugging
     */
    getHexTiles(): HexTile[] {
        return this.hexTiles;
    }

    /**
     * Updates the hex tiles and triggers a re-render
     */
    setHexTiles(hexTiles: HexTile[]): void {
        // console.log('[HexGridManager] Setting hex tiles, count:', hexTiles.length);
        this.hexTiles = hexTiles;

        // Run coordinate analysis automatically when hex tiles are loaded (only first time)
        if (hexTiles.length > 0 && !(window as any).hexGridDebugRan) {
            (window as any).hexGridDebugRan = true;
            // Run silent coordinate analysis for debugging purposes
            this.debugCoordinateRanges(true); // Pass true for silent mode
        }

        this.updateVisibleHexes();

        // Re-render town names when hex tiles change (important for new towns)
        if (this.layerManager) {
            this.layerManager.renderTownNames(this.hexTiles);
        }

        if (this.eventHandler) {
            this.eventHandler.updateState({ hexTiles });
        }
    }

    /**
     * Updates the current tool
     */
    setCurrentTool(tool: ToolMode): void {
        if (this.eventHandler) {
            this.eventHandler.updateState({ currentTool: tool });
        }

        if (this.viewport) {
            this.viewport.setCurrentTool(tool);
        }
    }

    /**
     * Updates the selected hex
     */
    setSelectedHex(hexId: string | null): void {
        if (this.renderer) {
            this.renderer.updateSelection(hexId, this.hexTiles);
        }
    }

    /**
     * Updates view settings
     */
    updateViewSettings(viewSettings: Partial<typeof this.config.viewSettings>): void {
        this.config.viewSettings = { ...this.config.viewSettings, ...viewSettings };

        if (this.layerManager) {
            this.layerManager.updateConfig({ viewSettings: this.config.viewSettings });
            this.layerManager.renderTownNames(this.hexTiles);
        }
    }

    /**
     * Sets grid lines visibility
     */
    setGridLinesVisible(visible: boolean): void {
        if (this.layerManager) {
            this.layerManager.setGridLinesVisibility(visible);
        }

        // Regenerate textures with appropriate border settings to eliminate white gaps
        if (this.renderer && this.app) {
            const borderWidth = visible ? this.config.gridLineThickness : 0;
            const textures = generateHexTextures(this.app, this.config.tileSize, {
                borderWidth: borderWidth,
                borderColor: this.config.gridLineColor,
                orientation: this.config.hexOrientation || 'flat-top'
            });
            this.renderer.setTextures(textures);
            // Trigger re-render of all hexes to use new textures
            this.updateVisibleHexes();
        }
    }

    /**
     * Sets geography layer visibility
     */
    setGeographyVisible(visible: boolean): void {
        if (this.layerManager) {
            this.layerManager.setGeographyVisibility(visible);
        }
    }

    /**
     * Loads a background image
     */
    async loadBackgroundImage(imageUrl: string): Promise<void> {
        if (this.layerManager) {
            await this.layerManager.loadBackgroundImage(imageUrl);

            // Auto-center viewport on the grid center where the background image is positioned
            // This ensures the background image is visible after loading
            if (this.viewport) {
                const gridCenter = this.getGridCenterCoordinates();
                const centerPixel = axialToPixelOriented(
                    gridCenter.q,
                    gridCenter.r,
                    this.config.tileSize,
                    this.config.hexOrientation || 'flat-top'
                );

                // Debug: Check actual hex coordinate ranges in the current tiles
                if (this.hexTiles.length > 0) {
                    // Use safe iteration to avoid stack overflow with large arrays
                    let minQ = Infinity, maxQ = -Infinity;
                    let minR = Infinity, maxR = -Infinity;

                    for (const hex of this.hexTiles) {
                        minQ = Math.min(minQ, hex.coordinates.q);
                        maxQ = Math.max(maxQ, hex.coordinates.q);
                        minR = Math.min(minR, hex.coordinates.r);
                        maxR = Math.max(maxR, hex.coordinates.r);
                    }

                    // Grid coordinate analysis disabled for normal operation
                    // (Range values: Q: ${minQ} to ${maxQ}, R: ${minR} to ${maxR})
                }

                // Auto-center viewport on background image
                this.viewport.centerOn(centerPixel.x, centerPixel.y, this.app.screen.width, this.app.screen.height);
            }
        } else {
            console.error('[HexGridManager] layerManager not available for background image loading');
        }
    }

    /**
     * Clears the background image
     */
    clearBackgroundImage(): void {
        if (this.layerManager) {
            this.layerManager.clearBackgroundImage();
        }
    }

    /**
     * Sets background image visibility
     */
    setBackgroundImageVisible(visible: boolean): void {
        if (this.layerManager) {
            this.layerManager.setBackgroundImageVisibility(visible);
        } else {
            console.error('[HexGridManager] layerManager not available for background visibility');
        }
    }

    /**
     * Sets background image scale
     */
    setBackgroundImageScale(scale: number): void {
        if (this.layerManager) {
            this.layerManager.setBackgroundImageScale(scale);
        } else {
            console.error('[HexGridManager] layerManager not available for background scale');
        }
    }

    /**
     * Sets background image offset
     */
    setBackgroundImageOffset(offsetX: number, offsetY: number): void {
        if (this.layerManager) {
            this.layerManager.setBackgroundImageOffset(offsetX, offsetY);
        } else {
            console.error('[HexGridManager] layerManager not available for background offset');
        }
    }

    /**
     * Renders drawing paths
     */
    renderDrawingPaths(paths: DrawingPath[], visible: boolean): void {
        if (this.layerManager) {
            this.layerManager.renderDrawingPaths(paths, visible);
        }
    }

    /**
     * Centers the viewport on a specific hex
     */
    centerOnHex(hexId: string): void {
        const hex = this.hexTiles.find(h => h.id === hexId);
        if (!hex || !this.viewport) {
            return;
        }

        const pixel = axialToPixelOriented(hex.coordinates.q, hex.coordinates.r, this.config.tileSize, this.config.hexOrientation || 'flat-top');
        this.viewport.centerOn(pixel.x, pixel.y, this.app.screen.width, this.app.screen.height);
        this.updateVisibleHexes();
    }

    /**
     * Centers on coordinates (0,0) or the first available hex
     */
    centerOnOrigin(): void {
        // Try to find hex at origin
        const originHex = this.hexTiles.find(h => h.coordinates.q === 0 && h.coordinates.r === 0);

        if (originHex) {
            this.centerOnHex(originHex.id);
            return;
        }

        // Find hex closest to origin
        if (this.hexTiles.length > 0) {
            const closestHex = this.hexTiles.reduce((best, hex) => {
                const distance = Math.abs(hex.coordinates.q) + Math.abs(hex.coordinates.r);
                const bestDistance = Math.abs(best.coordinates.q) + Math.abs(best.coordinates.r);
                return distance < bestDistance ? hex : best;
            });
            this.centerOnHex(closestHex.id);
        }
    }

    /**
     * Updates visible hexes based on current viewport
     */
    updateVisibleHexes(): void {
        if (!this.renderer || !this.viewport) return;

        const bounds = this.viewport.getVisibleBounds(this.app.screen.width, this.app.screen.height);
        const pixelBuffer = this.config.hexBuffer * this.config.tileSize;

        const expandedBounds = {
            minX: bounds.minX - pixelBuffer,
            maxX: bounds.maxX + pixelBuffer,
            minY: bounds.minY - pixelBuffer,
            maxY: bounds.maxY + pixelBuffer
        };

        const visibleCount = this.renderer.renderVisibleHexes(this.hexTiles, expandedBounds, pixelBuffer);

        if (this.config.onVisibleHexesChange) {
            const zoom = this.viewport.getState().zoomLevel;
            this.config.onVisibleHexesChange(visibleCount, zoom);
        }
    }

    /**
     * Handles resize events
     */
    handleResize(): void {
        if (this.layerManager) {
            this.layerManager.handleResize(this.app.screen.width, this.app.screen.height);
        }

        // Update visible hexes after resize but don't re-center
        this.updateVisibleHexes();
    }

    /**
     * Gets current viewport state
     */
    getViewportState() {
        return this.viewport?.getState();
    }

    /**
     * Gets renderer statistics
     */
    getRendererStats() {
        return this.renderer?.getStats();
    }

    /**
     * Sets grid line thickness
     */
    setGridLineThickness(thickness: number): void {
        this.config.gridLineThickness = thickness;
        if (this.layerManager) {
            this.layerManager.setGridLineThickness(thickness);
        }

        // Regenerate textures with new border width and update renderer
        if (this.renderer && this.app) {
            const textures = generateHexTextures(this.app, this.config.tileSize, {
                borderWidth: thickness,
                borderColor: this.config.gridLineColor,
                orientation: this.config.hexOrientation || 'flat-top'
            });
            this.renderer.setTextures(textures);
            // Trigger re-render of all hexes to use new textures
            this.updateVisibleHexes();
        }
    }

    /**
     * Sets grid line color
     */
    setGridLineColor(color: string): void {
        this.config.gridLineColor = color;
        if (this.layerManager) {
            this.layerManager.setGridLineColor(color);
        }

        // Regenerate textures with new border color and update renderer
        if (this.renderer && this.app) {
            const textures = generateHexTextures(this.app, this.config.tileSize, {
                borderWidth: this.config.gridLineThickness,
                borderColor: color,
                orientation: this.config.hexOrientation || 'flat-top'
            });
            this.renderer.setTextures(textures);
            // Trigger re-render of all hexes to use new textures
            this.updateVisibleHexes();
        }
    }

    /**
     * Sets text scale for town names
     */
    setTextScale(scale: number): void {
        this.config.textScale = scale;
        if (this.layerManager) {
            this.layerManager.setTextScale(scale);
            // Re-render town names with new scale
            this.layerManager.renderTownNames(this.hexTiles);
        }
    }

    /**
     * Updates the hex orientation and regenerates textures
     */
    setHexOrientation(orientation: HexOrientation): void {
        this.config.hexOrientation = orientation;

        // Update renderer orientation
        if (this.renderer) {
            this.renderer.setHexOrientation(orientation);
        }

        // Update event handler orientation
        if (this.eventHandler) {
            this.eventHandler.setHexOrientation(orientation);
        }

        // Update layer manager orientation
        if (this.layerManager) {
            this.layerManager.setHexOrientation(orientation);
        }

        // Regenerate textures with new orientation
        if (this.renderer && this.app) {
            const textures = generateHexTextures(this.app, this.config.tileSize, {
                borderWidth: this.config.gridLineThickness,
                borderColor: this.config.gridLineColor,
                orientation: orientation
            });
            this.renderer.setTextures(textures);
            // Trigger re-render of all hexes to use new textures with correct orientation
            this.updateVisibleHexes();
        }
    }

    /**
     * Updates the orientation configuration and repositions background image
     */
    updateOrientation(newOrientation: HexOrientation): void {
        this.config.hexOrientation = newOrientation;

        // Update background image position for new orientation
        if (this.layerManager) {
            this.layerManager.updateBackgroundImageForOrientation();
        }
    }

    /**
     * Updates the brush settings for geography drawing
     */
    setBrushSettings(color: string, size: number, isErasing: boolean): void {
        if (this.eventHandler) {
            this.eventHandler.setBrushSettings(color, size, isErasing);
        }
    }

    /**
     * Cleans up any ongoing drawing/preview state (useful when switching tools)
     */
    cleanupDrawingState(): void {
        if (this.eventHandler) {
            this.eventHandler.cleanup();
        }
    }

    /**
     * Cleans up all resources and event listeners
     */
    destroy(): void {

        // Clean up event listeners
        this.cleanupFunctions.forEach(cleanup => cleanup());
        this.cleanupFunctions = [];

        // Destroy modules
        this.renderer?.destroy();
        this.eventHandler?.destroy();
        this.viewport?.destroy();
        this.layerManager?.destroy();

        // Clear references
        this.renderer = null;
        this.eventHandler = null;
        this.viewport = null;
        this.layerManager = null;
        this.containers = null;

        this.initialized = false;
    }

    /**
     * Converts world pixel coordinates to the closest hex tile in our grid
     * This method accounts for the actual grid positioning and offsets used in generation
     */
    public worldPixelToHex(worldX: number, worldY: number): HexTile | null {
        if (!this.hexTiles || this.hexTiles.length === 0) {
            return null;
        }

        // Use the standard pixel-to-axial conversion as a starting point
        const axial = pixelToAxialOriented(worldX, worldY, this.config.tileSize, this.config.hexOrientation || 'flat-top');

        // Round to get candidate coordinates
        const candidateQ = Math.round(axial.q);
        const candidateR = Math.round(axial.r);

        // First try exact match
        let foundHex = this.hexTiles.find(h => h.coordinates.q === candidateQ && h.coordinates.r === candidateR);

        if (foundHex) {
            return foundHex;
        }

        console.log(`[HexGridManager] No exact match found, searching by pixel distance...`);

        // If no exact match, find the closest hex by actual distance
        let closestHex: HexTile | null = null;
        let closestDistance = Infinity;
        const hexRadius = this.config.tileSize * 0.9; // Slightly smaller than actual size for better UX
        console.log(`[HexGridManager] Search radius: ${hexRadius.toFixed(2)} pixels`);

        let searchCount = 0;
        const maxSearchSample = 10; // Only log first 10 for debugging

        for (const hex of this.hexTiles) {
            // Get the actual pixel position of this hex
            const hexPixel = axialToPixelOriented(
                hex.coordinates.q,
                hex.coordinates.r,
                this.config.tileSize,
                this.config.hexOrientation || 'flat-top'
            );

            // Calculate actual pixel distance
            const distance = Math.sqrt(
                Math.pow(worldX - hexPixel.x, 2) +
                Math.pow(worldY - hexPixel.y, 2)
            );

            // Log first few candidates for debugging
            if (searchCount < maxSearchSample && distance < hexRadius * 2) {
                console.log(`[HexGridManager] Candidate hex ${searchCount + 1}:`, {
                    id: hex.id,
                    axialCoords: hex.coordinates,
                    labelCoords: { X: hex.labelX, Y: hex.labelY },
                    hexPixelPos: { x: hexPixel.x.toFixed(2), y: hexPixel.y.toFixed(2) },
                    distance: distance.toFixed(2),
                    withinRadius: distance < hexRadius
                });
                searchCount++;
            }

            // Check if this is the closest hex and within a reasonable distance
            if (distance < hexRadius && distance < closestDistance) {
                closestDistance = distance;
                closestHex = hex;
                console.log(`[HexGridManager] New closest hex found:`, {
                    id: closestHex.id,
                    coordinates: closestHex.coordinates,
                    distance: closestDistance.toFixed(2)
                });
            }
        }

        if (closestHex) {
            console.log(`[HexGridManager] Final result - closest hex:`, {
                id: closestHex.id,
                coordinates: closestHex.coordinates,
                labelCoords: { X: closestHex.labelX, Y: closestHex.labelY },
                pixelDistance: closestDistance.toFixed(2)
            });
        } else {
            console.log(`[HexGridManager] No hex found within clickable radius at world coordinates (${worldX.toFixed(2)}, ${worldY.toFixed(2)})`);
        }

        return closestHex;
    }

    /**
     * Loads and displays geography image
     */
    async loadGeographyImage(imageData: GeographyImageData | null, visible: boolean): Promise<void> {
        if (this.layerManager) {
            await this.layerManager.loadGeographyImage(imageData, visible);
        }
    }
}
