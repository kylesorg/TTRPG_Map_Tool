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
    onStickerPlace?: (sticker: TownSticker) => void;
}

export class TownGridManager {
    private config: TownGridManagerConfig;
    private app: PIXI.Application;
    private containers: TownLayerContainers;

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

        // Initialize event handler
        const eventConfig: TownEventHandlerConfig = {
            cellSize: config.cellSize,
            onCellClick: (cell) => {
                if (config.onCellClick) {
                    config.onCellClick(cell);
                }
            },
            onPaintCellBatch: (batch) => {
                if (config.onCellPaint) {
                    config.onCellPaint(batch);
                }
                // Update cell visuals immediately
                this.updateCellVisuals(batch);
            },
            onPaintComplete: (lastCell) => {
                // Select the last painted cell
                if (config.onCellClick) {
                    config.onCellClick(lastCell);
                }
            }
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
    setTool(tool: TownToolMode): void {
        this.eventHandler.updateState({ currentTool: tool });
    }

    /**
     * Sets the selected material for painting
     */
    setSelectedMaterial(material: TownMaterial | null): void {
        this.eventHandler.updateState({ selectedMaterial: material });
    }

    /**
     * Updates cell visuals immediately for paint batch
     */
    private updateCellVisuals(batch: Array<{ x: number; y: number; material: string }>): void {
        const cellSprites = this.layerManager.getCellSprites();
        if (!cellSprites) return;

        batch.forEach(({ x, y, material }) => {
            const cellKey = `${x},${y}`;
            const sprite = cellSprites.get(cellKey);
            const materialData = this.materials.find(m => m.style === material);
            
            if (sprite && materialData) {
                sprite.tint = new PIXI.Color(materialData.color).toNumber();
            }
        });
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
     * Handles viewport changes (pan/zoom)
     */
    private handleViewportChange(): void {
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
