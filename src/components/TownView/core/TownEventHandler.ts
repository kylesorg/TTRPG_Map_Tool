import * as PIXI from 'pixi.js';
import type { TownData } from '../../../types/townTypes';
import type { TownMaterial } from '../../../types/mapTypes';

export type TownToolMode = 'select' | 'paint' | 'sticker';

export interface TownEventHandlerConfig {
    cellSize: number;
    onCellClick: (cell: { x: number; y: number }) => void;
    onPaintCellBatch: (batch: Array<{ x: number; y: number; material: string }>) => void;
    onPaintCellLive?: (cell: { x: number; y: number; material: string }) => void;
    onPaintComplete?: (lastPaintedCell: { x: number; y: number }) => void;
    onStickerPlace?: (position: { x: number; y: number }) => void;
}

export interface TownEventHandlerState {
    currentTool: TownToolMode;
    selectedMaterial: TownMaterial | null;
    isPanning: boolean;
    didPan: boolean;
    // Paint tool state
    isPainting: boolean;
    lastPaintedCell: { x: number; y: number } | null;
    paintBatch: Map<string, { x: number; y: number; material: string }>;
}

export class TownEventHandler {
    private config: TownEventHandlerConfig;
    private state: TownEventHandlerState;
    private cellContainer: PIXI.Container;
    private townData: TownData | null = null;

    constructor(
        config: TownEventHandlerConfig,
        cellContainer: PIXI.Container
    ) {
        this.config = config;
        this.cellContainer = cellContainer;
        this.state = {
            currentTool: 'select',
            selectedMaterial: null,
            isPanning: false,
            didPan: false,
            isPainting: false,
            lastPaintedCell: null,
            paintBatch: new Map()
        };

        // Note: Direct batch calls for now, throttling can be added later if needed
    }

    /**
     * Updates the event handler state
     */
    updateState(newState: Partial<TownEventHandlerState>): void {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Updates the town data
     */
    updateTownData(townData: TownData): void {
        this.townData = townData;
    }

    /**
     * Updates the panning state from viewport manager
     */
    updatePanningState(isPanning: boolean, didPan: boolean): void {
        this.state.isPanning = isPanning;
        this.state.didPan = didPan;

        // If we start panning while painting, stop painting
        if (isPanning && this.state.isPainting) {
            this.endPainting();
        }
    }

    /**
     * Converts screen coordinates to world coordinates (for sticker placement)
     */
    private screenToWorld(screenX: number, screenY: number, canvas: HTMLCanvasElement): { x: number; y: number } | null {
        // Convert screen coordinates to canvas coordinates
        const rect = canvas.getBoundingClientRect();
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;

        // Convert canvas coordinates to local container coordinates
        const localPos = this.cellContainer.toLocal(new PIXI.Point(canvasX, canvasY));

        return { x: localPos.x, y: localPos.y };
    }

    /**
     * Converts screen coordinates to cell coordinates
     */
    private screenToCell(screenX: number, screenY: number, canvas: HTMLCanvasElement): { x: number; y: number } | null {
        if (!this.townData) return null;

        // Convert screen coordinates to canvas coordinates
        const rect = canvas.getBoundingClientRect();
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;

        // Convert canvas coordinates to local container coordinates
        const localPos = this.cellContainer.toLocal(new PIXI.Point(canvasX, canvasY));

        // Calculate cell coordinates
        const cellX = Math.floor(localPos.x / this.config.cellSize);
        const cellY = Math.floor(localPos.y / this.config.cellSize);

        // Check bounds
        const { width, height } = this.townData.gridDimensions;
        if (cellX >= 0 && cellX < width && cellY >= 0 && cellY < height) {
            return { x: cellX, y: cellY };
        }

        return null;
    }

    /**
     * Handles pointer down events
     */
    handlePointerDown(e: PointerEvent, canvas: HTMLCanvasElement): void {
        // Only handle events that occurred on the canvas
        if (e.target !== canvas) return;

        if (this.state.currentTool === 'paint' && this.state.selectedMaterial) {
            const cell = this.screenToCell(e.clientX, e.clientY, canvas);
            if (cell) {
                this.startPainting(cell);
            }
        } else if (this.state.currentTool === 'sticker') {
            const worldPos = this.screenToWorld(e.clientX, e.clientY, canvas);
            if (worldPos && this.config.onStickerPlace) {
                this.config.onStickerPlace(worldPos);
            }
        }
    }

    /**
     * Handles pointer move events
     */
    handlePointerMove(e: PointerEvent, canvas: HTMLCanvasElement): void {
        if (!this.state.isPainting) return;

        const cell = this.screenToCell(e.clientX, e.clientY, canvas);
        if (!cell) return;

        this.continuePainting(cell);
    }

    /**
     * Handles pointer up events
     */
    handlePointerUp(e: PointerEvent, canvas: HTMLCanvasElement): void {
        const cell = this.screenToCell(e.clientX, e.clientY, canvas);

        // Handle cell selection for select tool (only if no panning occurred)
        if (this.state.currentTool === 'select' && !this.state.didPan && cell && e.target === canvas) {
            this.config.onCellClick(cell);
        }

        // End painting if in progress
        if (this.state.isPainting) {
            this.endPainting();
        }
    }

    /**
     * Starts a painting action
     */
    private startPainting(cell: { x: number; y: number }): void {
        if (!this.state.selectedMaterial) return;

        this.state.isPainting = true;
        this.state.paintBatch.clear();
        this.paintCell(cell);
        this.state.lastPaintedCell = cell;
    }

    /**
     * Continues painting (for drag operations)
     */
    private continuePainting(cell: { x: number; y: number }): void {
        if (!this.state.isPainting || !this.state.selectedMaterial) return;

        if (this.state.lastPaintedCell) {
            // Paint line between last and current cell using Bresenham's algorithm
            const points = this.getLineBetweenCells(this.state.lastPaintedCell, cell);
            points.forEach(point => this.paintCell(point));
        } else {
            this.paintCell(cell);
        }

        this.state.lastPaintedCell = cell;
    }

    /**
     * Ends painting and sends batch update
     */
    private endPainting(): void {
        if (!this.state.isPainting) return;

        this.state.isPainting = false;

        // Send batch update
        if (this.state.paintBatch.size > 0) {
            const batch = Array.from(this.state.paintBatch.values());
            this.config.onPaintCellBatch(batch);

            // Call completion callback if available
            if (this.config.onPaintComplete && this.state.lastPaintedCell) {
                this.config.onPaintComplete(this.state.lastPaintedCell);
            }
        }

        // Reset state
        this.state.paintBatch.clear();
        this.state.lastPaintedCell = null;
    }

    /**
     * Paints a single cell (adds to batch)
     */
    private paintCell(cell: { x: number; y: number }): void {
        if (!this.state.selectedMaterial || !this.townData) return;

        const cellKey = `${cell.x},${cell.y}`;

        // Don't paint the same cell twice in one batch
        if (this.state.paintBatch.has(cellKey)) return;

        // Validate cell bounds
        const { width, height } = this.townData.gridDimensions;
        if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
            return;
        }

        const paintData = {
            x: cell.x,
            y: cell.y,
            material: this.state.selectedMaterial.style
        };

        // Add to batch
        this.state.paintBatch.set(cellKey, paintData);

        // Call live paint callback for immediate visual feedback
        if (this.config.onPaintCellLive) {
            this.config.onPaintCellLive(paintData);
        }
    }

    /**
     * Gets line points between two cells using Bresenham's algorithm
     */
    private getLineBetweenCells(
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const sx = start.x < end.x ? 1 : -1;
        const sy = start.y < end.y ? 1 : -1;
        let err = dx - dy;

        let x = start.x;
        let y = start.y;

        while (true) {
            points.push({ x, y });

            if (x === end.x && y === end.y) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return points;
    }

    /**
     * Gets the current paint batch for external access
     */
    getCurrentPaintBatch(): Map<string, { x: number; y: number; material: string }> {
        return new Map(this.state.paintBatch);
    }

    /**
     * Forces the end of painting (for cleanup)
     */
    forceEndPainting(): void {
        if (this.state.isPainting) {
            this.endPainting();
        }
    }

    /**
     * Gets the current tool
     */
    getCurrentTool(): TownToolMode {
        return this.state.currentTool;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.forceEndPainting();
        this.state.paintBatch.clear();
    }
}
