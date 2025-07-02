import * as PIXI from 'pixi.js';
import { TownViewportManager, type TownViewportConfig } from './TownViewportManager';
import { TownLayerManager, type TownLayerContainers, type TownLayerManagerConfig } from './TownLayerManager';
import type { TownData, TownSticker } from '../../../types/townTypes';
import type { TownMaterial } from '../../../types/mapTypes';

export interface TownGridManagerConfig {
    cellSize: number;
    viewport: TownViewportConfig;
    layers: TownLayerManagerConfig;
    onCellClick?: (cell: { x: number; y: number }) => void;
    onCellPaint?: (batch: { x: number; y: number; material: string }[]) => void;
    onStickerPlace?: (sticker: TownSticker) => void;
}

export class TownGridManager {
    private config: TownGridManagerConfig;
    private app: PIXI.Application;
    private containers: TownLayerContainers;

    // Managers
    private viewportManager: TownViewportManager;
    private layerManager: TownLayerManager;
    private cleanupViewport: (() => void) | null = null;

    // State
    private townData: TownData | null = null;
    private materials: TownMaterial[] = [];
    private stickers: TownSticker[] = [];
    private cellTexture: PIXI.Texture | null = null;

    // Paint state
    private isPainting = false;
    private paintedCellsBatch = new Map<string, { x: number; y: number; material: string }>();
    private lastPaintedCell: { x: number; y: number } | null = null;
    private selectedMaterial: TownMaterial | null = null;
    private currentTool: 'select' | 'paint' = 'select';

    // Performance tracking
    private lastRenderTime = 0;
    private renderRequested = false;

    constructor(config: TownGridManagerConfig, app: PIXI.Application, containerNode: HTMLElement) {
        this.config = config;
        this.app = app;

        // Create layer containers
        this.containers = this.createLayerContainers();

        // Initialize managers
        const allContainers = Object.values(this.containers);
        this.viewportManager = new TownViewportManager(
            {
                ...config.viewport,
                onViewportChange: () => this.handleViewportChange(),
                onPanStateChange: (isPanning, didPan) => this.handlePanStateChange(isPanning, didPan)
            },
            allContainers,
            containerNode
        );

        this.layerManager = new TownLayerManager(config.layers, this.containers, app);

        // Create basic cell texture
        this.createCellTexture();

        // Setup viewport event listeners
        this.cleanupViewport = this.viewportManager.setupEventListeners();

        console.log('[TownGridManager] Initialized with viewport culling and layer management');
    }

    /**
     * Creates the layer container hierarchy
     */
    private createLayerContainers(): TownLayerContainers {
        const containers: TownLayerContainers = {
            alphaBackground: new PIXI.Container(),
            backgroundImage: new PIXI.Container(),
            cellGrid: new PIXI.Container(),
            gridLines: new PIXI.Container(),
            stickers: new PIXI.Container(),
            highlight: new PIXI.Container()
        };

        // Add all containers to the app stage in the correct order
        Object.values(containers).forEach(container => {
            this.app.stage.addChild(container);
        });

        return containers;
    }

    /**
     * Creates a basic texture for cells
     */
    private createCellTexture(): void {
        const graphics = new PIXI.Graphics();
        graphics.rect(0, 0, this.config.cellSize, this.config.cellSize);
        graphics.fill(0xFFFFFF);

        this.cellTexture = this.app.renderer.generateTexture(graphics);
        graphics.destroy();

        console.log('[TownGridManager] Cell texture created');
    }

    /**
     * Updates town data and triggers re-render
     */
    updateTownData(townData: TownData): void {
        this.townData = townData;
        this.requestRender();
    }

    /**
     * Updates available materials
     */
    updateMaterials(materials: TownMaterial[]): void {
        this.materials = materials;
        this.requestRender();
    }

    /**
     * Updates stickers
     */
    updateStickers(stickers: TownSticker[]): void {
        this.stickers = stickers;
        this.layerManager.renderStickers(this.stickers, true);
    }

    /**
     * Sets layer visibility
     */
    setLayerVisibility(layer: keyof TownLayerContainers, visible: boolean): void {
        this.layerManager.setLayerVisibility(layer, visible);
    }

    /**
     * Sets layer alpha
     */
    setLayerAlpha(layer: keyof TownLayerContainers, alpha: number): void {
        this.layerManager.setLayerAlpha(layer, alpha);
    }

    /**
     * Sets background image
     */
    setBackgroundImage(imageUrl: string, scale: number = 1, offsetX: number = 0, offsetY: number = 0): void {
        this.layerManager.setBackgroundImage(imageUrl, scale, offsetX, offsetY);
    }

    /**
     * Sets the current tool
     */
    setTool(tool: 'select' | 'paint'): void {
        this.currentTool = tool;
    }

    /**
     * Sets the selected material for painting
     */
    setSelectedMaterial(material: TownMaterial | null): void {
        this.selectedMaterial = material;
    }

    /**
     * Starts a paint action
     */
    startPaint(cellX: number, cellY: number): void {
        if (!this.selectedMaterial || this.currentTool !== 'paint') return;

        this.isPainting = true;
        this.paintedCellsBatch.clear();
        this.paintCellLocally(cellX, cellY);
        this.lastPaintedCell = { x: cellX, y: cellY };
    }

    /**
     * Continues a paint action (drag painting)
     */
    continuePaint(cellX: number, cellY: number): void {
        if (!this.isPainting || !this.selectedMaterial) return;

        if (this.lastPaintedCell) {
            // Paint line between last and current cell
            const points = this.getLine(this.lastPaintedCell.x, this.lastPaintedCell.y, cellX, cellY);
            points.forEach(point => this.paintCellLocally(point.x, point.y));
        } else {
            this.paintCellLocally(cellX, cellY);
        }
        this.lastPaintedCell = { x: cellX, y: cellY };
    }

    /**
     * Ends a paint action and calls the batch update callback
     */
    endPaint(): { x: number; y: number } | null {
        if (!this.isPainting) return null;

        this.isPainting = false;

        if (this.paintedCellsBatch.size > 0 && this.config.onCellPaint) {
            this.config.onCellPaint(Array.from(this.paintedCellsBatch.values()));
        }

        const lastCell = this.lastPaintedCell;
        this.lastPaintedCell = null;
        return lastCell;
    }

    /**
     * Paints a single cell locally (visual update)
     */
    private paintCellLocally(cellX: number, cellY: number): void {
        if (!this.selectedMaterial || !this.townData) return;

        const cellKey = `${cellX},${cellY}`;

        // Don't paint the same cell twice in one batch
        if (this.paintedCellsBatch.has(cellKey)) return;

        // Validate cell is within bounds
        if (cellX < 0 || cellY < 0 ||
            cellX >= this.townData.gridDimensions.width ||
            cellY >= this.townData.gridDimensions.height) {
            return;
        }

        // Find the cell sprite and update its color
        const cellSprites = this.layerManager.getCellSprites();
        const sprite = cellSprites?.get(cellKey);
        if (sprite) {
            sprite.tint = new PIXI.Color(this.selectedMaterial.color).toNumber();
        }

        // Add to batch for state update
        this.paintedCellsBatch.set(cellKey, {
            x: cellX,
            y: cellY,
            material: this.selectedMaterial.style
        });
    }

    /**
     * Get line points between two cells (Bresenham's line algorithm)
     */
    private getLine(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0;
        let y = y0;

        while (true) {
            points.push({ x, y });

            if (x === x1 && y === y1) break;

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
     * Handles viewport changes (pan/zoom)
     */
    private handleViewportChange(): void {
        this.requestRender();
    }

    /**
     * Handles pan state changes
     */
    private handlePanStateChange(isPanning: boolean, didPan: boolean): void {
        // Could be used for cursor changes or other UI feedback
        console.log('[TownGridManager] Pan state changed:', { isPanning, didPan });
    }

    /**
     * Requests a render on the next animation frame
     */
    private requestRender(): void {
        if (this.renderRequested) return;

        this.renderRequested = true;
        requestAnimationFrame(() => {
            this.render();
            this.renderRequested = false;
        });
    }

    /**
     * Main render method with viewport culling
     */
    private render(): void {
        if (!this.townData || !this.cellTexture) return;

        const startTime = performance.now();

        // Get visible cell bounds for culling
        const visibleBounds = this.viewportManager.getVisibleCellBounds(
            this.app.screen.width,
            this.app.screen.height,
            this.config.cellSize
        );

        // Add buffer to visible bounds to reduce pop-in
        const buffer = 2;
        const bufferedBounds = {
            minCellX: visibleBounds.minCellX - buffer,
            maxCellX: visibleBounds.maxCellX + buffer,
            minCellY: visibleBounds.minCellY - buffer,
            maxCellY: visibleBounds.maxCellY + buffer
        };

        // Render layers with culling
        this.layerManager.renderCellGrid(
            this.townData.grid,
            this.materials,
            bufferedBounds,
            this.cellTexture
        );

        this.layerManager.renderGridLines(
            this.config.layers.viewSettings.showGridLines,
            bufferedBounds,
            this.townData.gridDimensions.width,
            this.townData.gridDimensions.height
        );

        const renderTime = performance.now() - startTime;
        this.lastRenderTime = renderTime;

        console.log(`[TownGridManager] Render completed in ${renderTime.toFixed(2)}ms`);
    }

    /**
     * Gets current performance metrics
     */
    getPerformanceMetrics(): { lastRenderTime: number } {
        return {
            lastRenderTime: this.lastRenderTime
        };
    }

    /**
     * Gets the viewport manager for external access
     */
    getViewportManager(): TownViewportManager {
        return this.viewportManager;
    }

    /**
     * Gets the layer manager for external access
     */
    getLayerManager(): TownLayerManager {
        return this.layerManager;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        if (this.cleanupViewport) {
            this.cleanupViewport();
            this.cleanupViewport = null;
        }

        this.viewportManager.destroy();
        this.layerManager.destroy();

        Object.values(this.containers).forEach(container => {
            container.removeFromParent();
            container.destroy();
        });

        if (this.cellTexture) {
            this.cellTexture.destroy();
            this.cellTexture = null;
        }

        console.log('[TownGridManager] Destroyed');
    }
}
