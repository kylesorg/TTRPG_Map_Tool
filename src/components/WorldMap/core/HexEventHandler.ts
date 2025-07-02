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
    onDrawingPreview?: (previewPath: { points: { x: number; y: number }[], color: string, strokeWidth: number } | null) => void;
    onErasePaths?: (erasePoint: { x: number; y: number }, eraseRadius: number) => void;
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
    // Throttled preview for live drawing feedback
    private throttledDrawingPreview: ((previewData: { points: { x: number; y: number }[], color: string, strokeWidth: number } | null) => void) | null = null;
    // Throttled erase function to prevent spam
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

        // Create throttled preview function - update every 25ms for smooth feedback (40fps)
        if (this.config.onDrawingPreview) {
            this.throttledDrawingPreview = throttle(this.config.onDrawingPreview, 25);
        }

        // Create throttled erase function - limit erase calls to 50ms intervals (20fps) to prevent spam
        if (this.config.onErasePaths) {
            this.throttledErase = throttle(this.config.onErasePaths, 50);
        }

        // Create throttled erase function - update every 100ms to reduce spam
        if (this.config.onErasePaths) {
            this.throttledErase = throttle(this.config.onErasePaths, 100);
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
            console.log('[HexEventHandler] Geography drawing interrupted by panning');
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
        const hitAreaSize = 10000;
        this.fillsContainer.hitArea = new PIXI.Rectangle(-hitAreaSize, -hitAreaSize, hitAreaSize * 2, hitAreaSize * 2);

        this.fillsContainer.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            const { x, y } = event.data.global;
            console.log('[HexEventHandler] Pointer down:', { x, y, tool: this.state.currentTool, button: event.data.button });

            // Only handle left-click (button 0) for tool interactions
            if (event.data.button === 0) {
                this.handleToolPointerDown(event, x, y);
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
                console.log('[HexEventHandler] Unknown tool:', this.state.currentTool);
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
        console.log('[HexEventHandler] Paint tool activated - current state:', {
            currentTool: this.state.currentTool,
            isPanning: this.state.isPanning,
            didPan: this.state.didPan
        });

        // Don't paint if we're panning or if we panned
        if (this.state.isPanning || this.state.didPan) {
            console.log('[HexEventHandler] Paint blocked by panning state');
            return;
        }

        const { x, y } = event.data.global;
        const hex = this.getHexAtScreenPoint(x, y);

        if (hex) {
            console.log('[HexEventHandler] Starting paint on hex:', hex.id, '- calling onPaintHexBatch at', Date.now());
            this.state.isPainting = true;
            this.state.lastPaintedHex = hex;
            this.config.onPaintHexBatch([{ hexId: hex.id }], this.state.currentTool);
        } else {
            console.log('[HexEventHandler] No hex found at click location');
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
                    console.log('[HexEventHandler] Paint complete - using fresh hex data:', {
                        hexId: freshHex.id,
                        biomeName: freshHex.biome?.name,
                        biomeColor: freshHex.biome?.color
                    });
                    this.config.onPaintComplete(freshHex);
                } else {
                    console.log('[HexEventHandler] Paint complete - fresh hex not found, using cached hex');
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
                const eraseRadius = this.state.brushSize * 2; // Make erase radius larger than brush size
                this.throttledErase(worldPoint, eraseRadius);
            }
        } else {
            // Drawing mode - start a new drawing path
            this.state.isDrawing = true;
            this.state.currentDrawingPath = [{ x: worldPoint.x, y: worldPoint.y }];

            console.log('[HexEventHandler] Started geography drawing at:', {
                x: worldPoint.x,
                y: worldPoint.y,
                isDrawing: this.state.isDrawing
            });

            // Show initial preview
            this.updateDrawingPreview();
        }
    }

    private handleGeographyToolPointerMove(event: PIXI.FederatedPointerEvent): void {
        const worldPoint = this.fillsContainer.toLocal(event.global);

        if (this.state.isActivelyErasing) {
            // Continue erasing while moving (only when mouse is down)
            if (this.throttledErase) {
                const eraseRadius = this.state.brushSize * 2;
                this.throttledErase(worldPoint, eraseRadius);
            }
        } else if (this.state.isDrawing && this.state.currentDrawingPath) {
            // Continue drawing - add point only if it's far enough from the last point
            const lastPoint = this.state.currentDrawingPath[this.state.currentDrawingPath.length - 1];
            const distance = Math.sqrt(
                Math.pow(worldPoint.x - lastPoint.x, 2) +
                Math.pow(worldPoint.y - lastPoint.y, 2)
            );

            // Only add point if it's at least 2 pixels away from the last point
            // This reduces noise and creates smoother lines
            const minDistance = 2;
            if (distance >= minDistance) {
                this.state.currentDrawingPath.push({ x: worldPoint.x, y: worldPoint.y });
                this.updateDrawingPreview();
            }
        }
    }

    private handleGeographyToolPointerUp(_event: PIXI.FederatedPointerEvent): void {
        if (this.state.isActivelyErasing) {
            // Stop actively erasing on pointer up
            this.state.isActivelyErasing = false;
            return;
        }

        // Clear preview first
        this.clearDrawingPreview();

        if (!this.state.isDrawing || !this.state.currentDrawingPath || this.state.currentDrawingPath.length < 2) {
            console.log('[HexEventHandler] Geography drawing ended - insufficient points or not drawing');
            this.state.isDrawing = false;
            this.state.currentDrawingPath = null;
            return;
        }

        // Create a drawing path from the collected points with smoothing
        const smoothedPoints = this.smoothPath(this.state.currentDrawingPath);
        const drawingPath = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'road' as const, // Default to road for now
            points: smoothedPoints,
            color: this.state.brushColor,
            strokeWidth: this.state.brushSize
        };

        console.log('[HexEventHandler] Geography drawing complete - created path:', {
            id: drawingPath.id,
            type: drawingPath.type,
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
    }    /**
     * Converts screen coordinates to hex tile
     */
    private getHexAtScreenPoint(screenX: number, screenY: number): HexTile | null {
        // Convert screen to world coordinates
        const worldPoint = this.fillsContainer.toLocal(new PIXI.Point(screenX, screenY));

        // Convert world to axial coordinates (orientation-aware)
        const axial = pixelToAxialOriented(worldPoint.x, worldPoint.y, this.config.tileSize, this.config.hexOrientation || 'flat-top');

        // Find closest hex (by rounding q/r)
        const q = Math.round(axial.q);
        const r = Math.round(axial.r);

        const foundHex = this.state.hexTiles.find(h => h.coordinates.q === q && h.coordinates.r === r);
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
        this.state.isErasing = isErasing;
        console.log('[HexEventHandler] Updated brush settings:', { color, size, isErasing });
    }

    /**
     * Updates the drawing preview with current path
     */
    private updateDrawingPreview(): void {
        if (this.throttledDrawingPreview && this.state.currentDrawingPath && this.state.currentDrawingPath.length > 0) {
            this.throttledDrawingPreview({
                points: [...this.state.currentDrawingPath],
                color: this.state.brushColor,
                strokeWidth: this.state.brushSize
            });
        }
    }

    /**
     * Clears the drawing preview
     */
    private clearDrawingPreview(): void {
        if (this.throttledDrawingPreview) {
            this.throttledDrawingPreview(null);
        }
    }

    /**
     * Smooths a path using a simple averaging algorithm
     */
    private smoothPath(points: { x: number; y: number }[]): { x: number; y: number }[] {
        if (points.length <= 2) return points;

        const smoothed: { x: number; y: number }[] = [];

        // Keep first point
        smoothed.push(points[0]);

        // Smooth middle points using weighted average
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];

            // Weighted average: 25% previous, 50% current, 25% next
            const smoothX = prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25;
            const smoothY = prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25;

            smoothed.push({ x: smoothX, y: smoothY });
        }

        // Keep last point
        smoothed.push(points[points.length - 1]);

        return smoothed;
    }

    /**
     * Event handling methods
     */
}
