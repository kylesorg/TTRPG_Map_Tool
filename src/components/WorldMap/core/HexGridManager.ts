import * as PIXI from 'pixi.js';
import { HexRenderer } from './HexRenderer';
import { HexEventHandler, type HexEventHandlerConfig } from './HexEventHandler';
import { HexViewportManager, type ViewportConfig } from './HexViewportManager';
import { HexLayerManager, type LayerManagerConfig, type LayerContainers } from './HexLayerManager';
import { generateHexTextures } from '../../../utils/hexTextureGenerator';
import { axialToPixelOriented, type HexOrientation } from '../../../utils/hexMath'; // NEW: Import HexOrientation and orientation-aware functions
import type { HexTile, DrawingPath } from '../../../types/mapTypes';
import type { ToolMode } from '../../../types/sharedTypes';

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
            onViewportChange: () => this.updateVisibleHexes(),
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
            onDrawingPreview: (previewData) => {
                if (this.layerManager) {
                    this.layerManager.renderDrawingPreview(previewData);
                }
            },
            onErasePaths: this.config.onErasePaths
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
     * Updates the hex tiles and triggers a re-render
     */
    setHexTiles(hexTiles: HexTile[]): void {
        // console.log('[HexGridManager] Setting hex tiles, count:', hexTiles.length);
        this.hexTiles = hexTiles;
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
        }
    }

    /**
     * Sets background image scale
     */
    setBackgroundImageScale(scale: number): void {
        if (this.layerManager) {
            this.layerManager.setBackgroundImageScale(scale);
        }
    }

    /**
     * Sets background image offset
     */
    setBackgroundImageOffset(offsetX: number, offsetY: number): void {
        if (this.layerManager) {
            this.layerManager.setBackgroundImageOffset(offsetX, offsetY);
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
}
