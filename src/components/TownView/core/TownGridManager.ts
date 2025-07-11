import * as PIXI from 'pixi.js';
import { TownViewportManager, type TownViewportConfig } from './TownViewportManager';
import { TownLayerManager, type TownLayerContainers, type TownLayerManagerConfig } from './TownLayerManager';
import { TownEventHandler, type TownEventHandlerConfig, type TownToolMode } from './TownEventHandler';
import type { TownData, TownSticker } from '../../../types/townTypes';
import type { TownMaterial } from '../../../types/mapTypes';

export interface TownGridManagerConfig {
    cellSize: number;
    viewport: TownViewportConfig;
    layers: TownLayerManagerConfig;
    onCellClick?: (cell: { x: number; y: number }) => void;
    onCellPaint?: (batch: { x: number; y: number; material: string }[]) => void;
    onPaintComplete?: (cell: { x: number; y: number }) => void;
    onStickerPlace?: (position: { x: number; y: number }) => void;
}

export class TownGridManager {
    private config: TownGridManagerConfig;
    private app: PIXI.Application;
    private containers: TownLayerContainers;
    private containerNode: HTMLElement;

    // Managers
    private viewportManager: TownViewportManager;
    private layerManager: TownLayerManager;
    private eventHandler: TownEventHandler;
    private cleanupViewport: (() => void) | null = null;
    private cleanupEvents: (() => void) | null = null;

    // State
    private townData: TownData | null = null;
    private materials: TownMaterial[] = [];
    private stickers: TownSticker[] = [];
    private cellTexture: PIXI.Texture | null = null;
    private selectedCell: { x: number; y: number } | null = null;
    private livePaintOverlay: Map<string, { x: number; y: number; material: string }> = new Map();

    // Performance tracking
    private lastRenderTime = 0;
    private renderRequested = false;
    private lastViewportChangeTime = 0;
    private viewportChangeThrottleMs = 16; // ~60fps
    private lastRenderedBounds: any = null;

    constructor(config: TownGridManagerConfig, app: PIXI.Application, containerNode: HTMLElement) {
        this.config = config;
        this.app = app;
        this.containerNode = containerNode;

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

        this.layerManager = new TownLayerManager({
            ...config.layers,
            gridWidth: 0, // Will be updated when townData is set
            gridHeight: 0 // Will be updated when townData is set
        }, this.containers, app);

        // Initialize event handler
        const eventConfig: TownEventHandlerConfig = {
            cellSize: config.cellSize,
            onCellClick: (cell) => config.onCellClick?.(cell),
            onPaintCellBatch: (batch) => {
                // Clear live paint overlay when batch is finalized
                this.livePaintOverlay.clear();
                // Call parent callback for final batch update
                config.onCellPaint?.(batch);
            },
            onPaintCellLive: (paintData) => {
                // Add to live paint overlay
                const cellKey = `${paintData.x},${paintData.y}`;
                this.livePaintOverlay.set(cellKey, paintData);

                // Update visuals immediately for live feedback
                this.updateCellVisuals([paintData]);

                // Re-render highlight to ensure it's visible on top of painted cells
                this.refreshHighlight();
            },
            onPaintComplete: (lastCell) => {
                // Use dedicated paint complete callback if available, otherwise fall back to cell click
                if (config.onPaintComplete) {
                    config.onPaintComplete(lastCell);
                } else if (config.onCellClick) {
                    config.onCellClick(lastCell);
                }
            },
            onStickerPlace: (position) => config.onStickerPlace?.(position)
        };
        this.eventHandler = new TownEventHandler(eventConfig, this.containers.cellGrid);

        // Create basic cell texture
        this.createCellTexture();

        // Setup viewport event listeners
        this.cleanupViewport = this.viewportManager.setupEventListeners();

        // Setup event handler listeners
        this.cleanupEvents = this.setupEventListeners(containerNode);

        console.log('[TownGridManager] Initialized with viewport culling, layer management, and event handling');
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
        this.eventHandler.updateTownData(townData);

        // Update layer manager config with grid dimensions
        this.layerManager.updateConfig({
            gridWidth: townData.gridDimensions.width,
            gridHeight: townData.gridDimensions.height
        });

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
    async updateStickers(stickers: TownSticker[]): Promise<void> {
        this.stickers = stickers;
        await this.layerManager.renderStickers(this.stickers, true);
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
    async setBackgroundImage(imageUrl: string, scale: number = 1, offsetX: number = 0, offsetY: number = 0): Promise<void> {
        await this.layerManager.setBackgroundImage(imageUrl, scale, offsetX, offsetY);
    }

    /**
     * Sets background image scale
     */
    setBackgroundImageScale(scale: number): void {
        console.log('[TownGridManager] setBackgroundImageScale called:', scale);
        this.layerManager.setBackgroundImageScale(scale);
    }

    /**
     * Sets background image offset
     */
    setBackgroundImageOffset(offsetX: number, offsetY: number): void {
        console.log('[TownGridManager] setBackgroundImageOffset called:', { offsetX, offsetY });
        this.layerManager.setBackgroundImageOffset(offsetX, offsetY);
    }

    /**
     * Sets background image visibility
     */
    setBackgroundImageVisibility(visible: boolean): void {
        console.log('[TownGridManager] setBackgroundImageVisibility called:', visible);
        this.layerManager.setBackgroundImageVisibility(visible);
    }

    /**
     * Clears background image
     */
    clearBackgroundImage(): void {
        console.log('[TownGridManager] clearBackgroundImage called');
        this.layerManager.clearBackgroundImage();
    }

    /**
     * Sets the current tool
     */
    setTool(tool: TownToolMode): void {
        this.eventHandler.updateState({ currentTool: tool });
        this.viewportManager.setTool(tool);
        this.updateCursor();
    }

    /**
     * Sets the cursor for the container
     */
    setCursor(cursor: string): void {
        if (this.containerNode) {
            this.containerNode.style.cursor = cursor;
        }
    }

    /**
     * Sets the selected material for painting
     */
    setSelectedMaterial(material: TownMaterial | null): void {
        this.eventHandler.updateState({ selectedMaterial: material });
    }

    /**
     * Sets the selected cell and updates highlight
     */
    setSelectedCell(cell: { x: number; y: number } | null): void {
        this.selectedCell = cell;
        if (cell) {
            this.layerManager.renderHighlight({
                cellX: cell.x,
                cellY: cell.y,
                color: 0xFFD700, // Yellow highlight
                alpha: 0.5
            });
        } else {
            this.layerManager.renderHighlight(null);
        }
    }

    /**
     * Refreshes the current selection highlight (useful after painting)
     */
    private refreshHighlight(): void {
        if (this.selectedCell) {
            this.layerManager.renderHighlight({
                cellX: this.selectedCell.x,
                cellY: this.selectedCell.y,
                color: 0xFFD700, // Yellow highlight
                alpha: 0.5
            });
        }
    }

    /**
     * Updates cell visuals immediately for paint batch
     */
    /**
     * Updates cell visuals for live painting feedback
     */
    private updateCellVisuals(_batch: Array<{ x: number; y: number; material: string }>): void {
        // For live painting, we re-render the cell grid with live overlay
        this.renderCellGridWithLivePaint();
    }

    /**
     * Updates cursor based on current tool
     */
    private updateCursor(): void {
        const currentTool = this.eventHandler.getCurrentTool();
        let cursor = 'default';

        switch (currentTool) {
            case 'select':
                cursor = 'grab';
                break;
            case 'paint':
                cursor = 'url(\'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNCIgZmlsbD0iIzAwMCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+\') 8 8, crosshair';
                break;
            case 'sticker':
                cursor = 'crosshair';
                break;
        }

        this.setCursor(cursor);
    }

    /**
     * Sets up event listeners for pointer interactions
     */
    private setupEventListeners(containerNode: HTMLElement): () => void {
        const onPointerDown = (e: PointerEvent) => {
            if (this.app.canvas) {
                this.eventHandler.handlePointerDown(e, this.app.canvas);
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            if (this.app.canvas) {
                this.eventHandler.handlePointerMove(e, this.app.canvas);
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            if (this.app.canvas) {
                this.eventHandler.handlePointerUp(e, this.app.canvas);
            }
        };

        // Add event listeners
        containerNode.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        // Return cleanup function
        return () => {
            containerNode.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }

    /**
     * Handles viewport changes (pan/zoom) with throttling
     */
    private handleViewportChange(): void {
        const now = performance.now();
        if (now - this.lastViewportChangeTime < this.viewportChangeThrottleMs) {
            return; // Skip if too frequent
        }
        this.lastViewportChangeTime = now;
        this.requestRender();
    }

    /**
     * Handles pan state changes
     */
    private handlePanStateChange(isPanning: boolean, didPan: boolean): void {
        // Update event handler with panning state
        this.eventHandler.updatePanningState(isPanning, didPan);
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
     * Main render method with viewport culling and optimization
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

        // Check if bounds have significantly changed to optimize rendering
        const boundsChanged = !this.lastRenderedBounds ||
            Math.abs(this.lastRenderedBounds.minCellX - bufferedBounds.minCellX) > 1 ||
            Math.abs(this.lastRenderedBounds.maxCellX - bufferedBounds.maxCellX) > 1 ||
            Math.abs(this.lastRenderedBounds.minCellY - bufferedBounds.minCellY) > 1 ||
            Math.abs(this.lastRenderedBounds.maxCellY - bufferedBounds.maxCellY) > 1;

        if (!boundsChanged && this.livePaintOverlay.size === 0) {
            // Skip rendering if bounds haven't changed and no live painting
            return;
        }

        this.lastRenderedBounds = { ...bufferedBounds };

        // Render layers with culling
        this.layerManager.renderCellGrid(
            this.townData.grid,
            this.materials,
            bufferedBounds,
            this.cellTexture
        );

        // Apply live paint overlay after regular rendering
        this.applyLivePaintOverlay();

        this.layerManager.renderGridLines(
            this.config.layers.viewSettings.showGridLines,
            bufferedBounds,
            this.townData.gridDimensions.width,
            this.townData.gridDimensions.height
        );

        const renderTime = performance.now() - startTime;
        this.lastRenderTime = renderTime;

        // Only log slow renders to reduce console spam
        if (renderTime > 10) {
            console.log(`[TownGridManager] Render completed in ${renderTime.toFixed(2)}ms`);
        }
    }

    /**
     * Applies live paint overlay after regular rendering
     */
    private applyLivePaintOverlay(): void {
        if (this.livePaintOverlay.size === 0) return;

        // Simply render a new cell grid with live paint data merged
        this.renderCellGridWithLivePaint();
    }

    /**
     * Renders cell grid with live paint overlay
     */
    private renderCellGridWithLivePaint(): void {
        if (!this.townData || !this.cellTexture) return;

        const visibleBounds = this.viewportManager.getVisibleCellBounds(
            this.app.screen.width,
            this.app.screen.height,
            this.config.cellSize
        );

        // Create merged cell data with live paint overlay
        const mergedCells: Record<string, any> = { ...this.townData.grid };

        // Apply live paint overlay to merged data
        this.livePaintOverlay.forEach((paintData) => {
            const cellKey = `${paintData.x},${paintData.y}`;
            mergedCells[cellKey] = {
                ...mergedCells[cellKey],
                material: paintData.material
            };
        });

        // Render with merged data
        this.layerManager.renderCellGrid(
            mergedCells,
            this.materials,
            visibleBounds,
            this.cellTexture
        );
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

        if (this.cleanupEvents) {
            this.cleanupEvents();
            this.cleanupEvents = null;
        }

        this.eventHandler.destroy();
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
