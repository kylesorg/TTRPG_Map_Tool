import * as PIXI from 'pixi.js';
import { pixelToAxialOriented, type HexOrientation } from '../../../utils/hexMath'; // NEW: Import orientation-aware functions
import { throttle } from '../../../utils/throttle';
import type { HexTile } from '../../../types/mapTypes';
import type { ToolMode } from '../../../types/sharedTypes';

export interface HexEventHandlerConfig {
    tileSize: number;
    hexOrientation?: HexOrientation; // NEW: Add hex orientation
    onHexClick: (hex: HexTile) => void;
    onPaintHexBatch: (batch: Array<{ hexId: string }>, tool: ToolMode) => void;
    onPaintComplete?: (lastPaintedHex: HexTile) => void;
    onNewPath?: (newPath: any) => void;
    onLiveDrawing?: (liveDrawingPath: { points: { x: number; y: number }[], color: string, strokeWidth: number } | null) => void;
    onErasePaths?: (erasePoint: { x: number; y: number }, eraseRadius: number) => void;
    gridManager?: { worldPixelToHex: (worldX: number, worldY: number) => HexTile | null }; // NEW: Optional grid manager for better coordinate conversion
}

export interface HexEventHandlerState {
    currentTool: ToolMode;
    hexTiles: HexTile[];
    brushSize: number;
    brushColor: string;
    isErasing: boolean;
    isPanning: boolean;
    didPan: boolean;
    // Paint tool state
    isPainting: boolean;
    lastPaintedHex: HexTile | null;
    // Geography tool state
    isDrawing: boolean;
    isActivelyErasing: boolean; // New: tracks when mouse is down and erasing
    currentDrawingPath: { x: number; y: number }[] | null;
}

export class HexEventHandler {
    private config: HexEventHandlerConfig;
    private state: HexEventHandlerState;
    private fillsContainer: PIXI.Container;
    // Live drawing with immediate updates - no throttling, no preview complexity
    private throttledErase: ((erasePoint: { x: number; y: number }, eraseRadius: number) => void) | null = null;

    constructor(
        config: HexEventHandlerConfig,
        fillsContainer: PIXI.Container
    ) {
        this.config = config;
        this.fillsContainer = fillsContainer;
        this.state = {
            currentTool: 'select',
            hexTiles: [],
            brushSize: 1,
            brushColor: '#000000',
            isErasing: false,
            isPanning: false,
            didPan: false,
            isPainting: false,
            lastPaintedHex: null,
            isDrawing: false,
            isActivelyErasing: false,
            currentDrawingPath: null
        };

        // Create throttled erase function to prevent spam
        if (this.config.onErasePaths) {
            this.throttledErase = throttle(this.config.onErasePaths, 16);
        }
    }

    /**
     * Updates the event handler state
     */
    updateState(newState: Partial<HexEventHandlerState>): void {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Updates the panning state from viewport manager
     */
    updatePanningState(isPanning: boolean, didPan: boolean): void {
        this.state.isPanning = isPanning;
        this.state.didPan = didPan;

        // If we start panning while painting, stop painting
        if (isPanning && this.state.isPainting) {
            this.state.isPainting = false;
            this.state.lastPaintedHex = null;
        }

        // If we start panning while drawing geography, stop drawing
        if (isPanning && this.state.isDrawing) {
            // Geography drawing interrupted by panning
            this.state.isDrawing = false;
            this.state.currentDrawingPath = null;
        }
    }

    /**
     * Sets up PIXI event handlers on the fills container for hex interactions
     */
    setupPixiEventHandlers(): void {
        if (!this.fillsContainer) {
            console.warn('[HexEventHandler] No fills container available for event setup');
            return;
        }

        this.fillsContainer.removeAllListeners();
        this.fillsContainer.eventMode = 'static';
        this.fillsContainer.interactive = true;

        // Create a large invisible hit area that covers the whole screen and beyond
        const hitAreaSize = 20000; // Increased from 10000 to be extra sure
        this.fillsContainer.hitArea = new PIXI.Rectangle(-hitAreaSize, -hitAreaSize, hitAreaSize * 2, hitAreaSize * 2);

        // Container setup complete - only log errors if they occur

        this.fillsContainer.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            const { x, y } = event.data.global;

            // Only handle left-click (button 0) for tool interactions
            if (event.data.button === 0) {
                this.handleToolPointerDown(event, x, y);
            } else {
                console.log(`[HexEventHandler] Non-left-click ignored, button: ${event.data.button}`);
            }
        });

        this.fillsContainer.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
            this.handleToolPointerMove(event);
        });

        this.fillsContainer.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
            this.handleToolPointerUp(event);
        });

        this.fillsContainer.on('pointerupoutside', (event: PIXI.FederatedPointerEvent) => {
            this.handleToolPointerUp(event);
        });
    }

    /**
     * Removes all PIXI event handlers
     */
    removePixiEventHandlers(): void {
        if (this.fillsContainer) {
            this.fillsContainer.removeAllListeners();
        }
    }

    /**
     * Handles tool-specific pointer down events
     */
    private handleToolPointerDown(event: PIXI.FederatedPointerEvent, x: number, y: number): void {
        switch (this.state.currentTool) {
            case 'select':
                this.handleSelectToolPointerDown(event, x, y);
                break;
            case 'paint':
                this.handlePaintToolPointerDown(event);
                break;
            case 'geography':
                this.handleGeographyToolPointerDown(event);
                break;
            default:
            // Unknown tool
        }
    }

    /**
     * Handles tool-specific pointer move events
     */
    private handleToolPointerMove(event: PIXI.FederatedPointerEvent): void {
        switch (this.state.currentTool) {
            case 'select':
                this.handleSelectToolPointerMove(event);
                break;
            case 'paint':
                this.handlePaintToolPointerMove(event);
                break;
            case 'geography':
                this.handleGeographyToolPointerMove(event);
                break;
        }
    }

    /**
     * Handles tool-specific pointer up events
     */
    private handleToolPointerUp(event: PIXI.FederatedPointerEvent): void {
        switch (this.state.currentTool) {
            case 'select':
                this.handleSelectToolPointerUp(event);
                break;
            case 'paint':
                this.handlePaintToolPointerUp(event);
                break;
            case 'geography':
                this.handleGeographyToolPointerUp(event);
                break;
        }
    }

    /**
     * Handles select tool pointer down - finds and selects the hex under the pointer
     */
    private handleSelectToolPointerDown(_event: PIXI.FederatedPointerEvent, x: number, y: number): void {
        const hex = this.getHexAtScreenPoint(x, y);
        if (hex) {
            this.config.onHexClick(hex);
        }
    }

    private handleSelectToolPointerMove(_event: PIXI.FederatedPointerEvent): void {
        // Reserved for future select tool hover/drag logic
    }

    private handleSelectToolPointerUp(_event: PIXI.FederatedPointerEvent): void {
        // Reserved for future select tool pointer up logic
    }

    /**
     * Handles paint tool pointer down - starts painting
     */
    private handlePaintToolPointerDown(event: PIXI.FederatedPointerEvent): void {
        // Paint tool activated

        // Don't paint if we're panning or if we panned
        if (this.state.isPanning || this.state.didPan) {
            // Paint blocked by panning state
            return;
        }

        const { x, y } = event.data.global;
        const hex = this.getHexAtScreenPoint(x, y);

        if (hex) {
            // Starting paint on hex
            this.state.isPainting = true;
            this.state.lastPaintedHex = hex;
            this.config.onPaintHexBatch([{ hexId: hex.id }], this.state.currentTool);
        } else {
            // No hex found at click location
        }
    }

    private handlePaintToolPointerMove(event: PIXI.FederatedPointerEvent): void {
        // Only continue painting if we started painting and aren't panning
        if (!this.state.isPainting || this.state.isPanning) return;

        const { x, y } = event.data.global;
        const hex = this.getHexAtScreenPoint(x, y);
        if (hex && hex.id !== this.state.lastPaintedHex?.id) {
            this.state.lastPaintedHex = hex;
            this.config.onPaintHexBatch([{ hexId: hex.id }], this.state.currentTool);
        }
    }

    private handlePaintToolPointerUp(_event: PIXI.FederatedPointerEvent): void {
        if (this.state.isPainting) {
            this.state.isPainting = false;

            // Call paint complete with fresh hex data (not the stale cached version)
            if (this.state.lastPaintedHex && this.config.onPaintComplete) {
                // Get the fresh hex data from the current hex tiles array
                const freshHex = this.state.hexTiles.find(h => h.id === this.state.lastPaintedHex!.id);
                if (freshHex) {
                    this.config.onPaintComplete(freshHex);
                } else {
                    this.config.onPaintComplete(this.state.lastPaintedHex);
                }
            }

            this.state.lastPaintedHex = null;
        }
    }

    /**
     * Handles geography tool pointer down - starts drawing/erasing
     */
    private handleGeographyToolPointerDown(event: PIXI.FederatedPointerEvent): void {
        console.log('[HexEventHandler] Geography pointer down - starting', this.state.isErasing ? 'erasing' : 'drawing');

        if (this.state.isPanning || this.state.didPan) {
            console.log('[HexEventHandler] Geography action blocked by panning state');
            return;
        }

        const worldPoint = this.fillsContainer.toLocal(event.global);

        if (this.state.isErasing) {
            // Erasing mode - start actively erasing at this point
            this.state.isActivelyErasing = true;
            if (this.throttledErase) {
                // Use brush size + small buffer for better erasing accuracy
                const eraseRadius = this.state.brushSize + 1;
                this.throttledErase(worldPoint, eraseRadius);
            }
        } else {
            // Drawing mode - start a new drawing path
            this.state.isDrawing = true;
            this.state.currentDrawingPath = [{ x: worldPoint.x, y: worldPoint.y }];

            // Start live drawing immediately - no preview, just real drawing
            this.updateLiveDrawing();
        }
    }

    private handleGeographyToolPointerMove(event: PIXI.FederatedPointerEvent): void {
        const worldPoint = this.fillsContainer.toLocal(event.global);

        if (this.state.isActivelyErasing) {
            // Continue erasing while moving (only when mouse is down)
            if (this.throttledErase) {
                // Use brush size + small buffer for better erasing accuracy
                const eraseRadius = this.state.brushSize + 1;
                this.throttledErase(worldPoint, eraseRadius);
            }
        } else if (this.state.isDrawing && this.state.currentDrawingPath) {
            // Continue drawing - add point only if it's far enough from the last point
            const lastPoint = this.state.currentDrawingPath[this.state.currentDrawingPath.length - 1];
            const distance = Math.sqrt(
                Math.pow(worldPoint.x - lastPoint.x, 2) +
                Math.pow(worldPoint.y - lastPoint.y, 2)
            );

            // Higher sampling rate: 0.5px minimum distance for smoother curves
            const minDistance = 0.5;
            if (distance >= minDistance) {
                this.state.currentDrawingPath.push({ x: worldPoint.x, y: worldPoint.y });
                this.updateLiveDrawing();
            }
        }
    }

    private handleGeographyToolPointerUp(_event: PIXI.FederatedPointerEvent): void {
        // Clear live drawing immediately on pointer up
        this.clearLiveDrawing();

        if (this.state.isActivelyErasing) {
            // Stop actively erasing on pointer up
            this.state.isActivelyErasing = false;
            return;
        }

        if (!this.state.isDrawing || !this.state.currentDrawingPath || this.state.currentDrawingPath.length < 2) {
            console.log('[HexEventHandler] Geography drawing ended - insufficient points or not drawing');
            this.state.isDrawing = false;
            this.state.currentDrawingPath = null;
            return;
        }

        // Create a drawing path from the collected points (no smoothing needed with higher sampling)
        const drawingPath = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            points: this.state.currentDrawingPath, // Use raw points - higher density means no smoothing needed
            color: this.state.brushColor,
            strokeWidth: this.state.brushSize
        };

        console.log('[HexEventHandler] Geography drawing complete - created path:', {
            id: drawingPath.id,
            pointCount: drawingPath.points.length,
            color: drawingPath.color,
            strokeWidth: drawingPath.strokeWidth
        });

        // Send the path to the callback
        if (this.config.onNewPath) {
            this.config.onNewPath(drawingPath);
        }

        // Reset drawing state
        this.state.isDrawing = false;
        this.state.currentDrawingPath = null;
    }

    /**
     * Update live drawing - sends current path to be drawn immediately
     */
    private updateLiveDrawing(): void {
        if (this.config.onLiveDrawing && this.state.currentDrawingPath && this.state.currentDrawingPath.length > 0) {
            this.config.onLiveDrawing({
                points: [...this.state.currentDrawingPath], // Copy the array
                color: this.state.brushColor,
                strokeWidth: this.state.brushSize
            });
        }
    }

    /**
     * Clear live drawing
     */
    private clearLiveDrawing(): void {
        if (this.config.onLiveDrawing) {
            this.config.onLiveDrawing(null);
        }
    }

    /**
     * Converts screen coordinates to hex tile
     */
    private getHexAtScreenPoint(screenX: number, screenY: number): HexTile | null {
        // Convert screen to world coordinates
        const worldPoint = this.fillsContainer.toLocal(new PIXI.Point(screenX, screenY));

        // Use grid manager's more accurate conversion if available
        if (this.config.gridManager) {
            const result = this.config.gridManager.worldPixelToHex(worldPoint.x, worldPoint.y);
            return result;
        }

        // Fallback to the previous method if grid manager is not available
        console.log(`[HexEventHandler] Grid manager not available, using fallback method`);

        // Convert world to axial coordinates (orientation-aware)
        const axial = pixelToAxialOriented(worldPoint.x, worldPoint.y, this.config.tileSize, this.config.hexOrientation || 'flat-top');

        // Find closest hex (by rounding q/r)
        const q = Math.round(axial.q);
        const r = Math.round(axial.r);

        // First try exact match
        let foundHex = this.state.hexTiles.find(h => h.coordinates.q === q && h.coordinates.r === r);

        if (foundHex) {
            return foundHex;
        }

        // If exact match fails, try to find the closest hex within a reasonable radius
        let bestHex: HexTile | null = null;
        let bestDistance = Infinity;
        const maxSearchRadius = 2; // Search within 2 hex units

        for (const hex of this.state.hexTiles) {
            // Calculate axial distance
            const dq = Math.abs(hex.coordinates.q - q);
            const dr = Math.abs(hex.coordinates.r - r);
            const ds = Math.abs(hex.coordinates.s - (-q - r));
            const distance = Math.max(dq, dr, ds); // Axial distance is max of coordinate differences

            if (distance <= maxSearchRadius && distance < bestDistance) {
                bestDistance = distance;
                bestHex = hex;
            }
        }

        if (bestHex) {
            console.log(`[HexEventHandler] Found nearby hex at q=${bestHex.coordinates.q}, r=${bestHex.coordinates.r} (distance=${bestDistance})`);
            foundHex = bestHex;
        } else {
            console.log(`[HexEventHandler] No hex found within search radius of q=${q}, r=${r}`);
        }

        return foundHex || null;
    }

    /**
     * Gets the current event handler state
     */
    getState(): HexEventHandlerState {
        return { ...this.state };
    }

    /**
     * Cleans up all event handlers
     */
    destroy(): void {
        this.removePixiEventHandlers();
    }

    /**
     * Updates the hex orientation (NEW)
     */
    setHexOrientation(orientation: HexOrientation): void {
        this.config.hexOrientation = orientation;
    }

    /**
     * Updates the brush settings for geography drawing
     */
    setBrushSettings(color: string, size: number, isErasing: boolean): void {
        this.state.brushColor = color;
        this.state.brushSize = size;

        // If switching to/from erase mode, clear any stuck live drawing
        if (this.state.isErasing !== isErasing) {
            this.clearLiveDrawing();
        }

        this.state.isErasing = isErasing;
    }

    /**
     * Cleanup method - clears any ongoing drawing state
     */
    cleanup(): void {
        this.clearLiveDrawing();
        this.state.isDrawing = false;
        this.state.isActivelyErasing = false;
        this.state.currentDrawingPath = null;
    }

    /**
     * Event handling methods
     */
}
