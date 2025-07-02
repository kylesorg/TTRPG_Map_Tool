import * as PIXI from 'pixi.js';
import type { TownCell, TownSticker } from '../../../types/townTypes';

export interface TownLayerManagerConfig {
    cellSize: number;
    viewSettings: {
        showGridLines: boolean;
    };
    gridLineThickness: number;
    gridLineColor: string;
}

export interface TownLayerContainers {
    alphaBackground: PIXI.Container;
    backgroundImage: PIXI.Container;
    cellGrid: PIXI.Container;
    gridLines: PIXI.Container;
    stickers: PIXI.Container;
    highlight: PIXI.Container;
}

export class TownLayerManager {
    private config: TownLayerManagerConfig;
    private containers: TownLayerContainers;
    private app: PIXI.Application;

    // Layer-specific objects
    private backgroundSprite: PIXI.Sprite | null = null;
    private gridGraphics: PIXI.Graphics | null = null;
    private cellSprites = new Map<string, PIXI.Sprite>();

    constructor(config: TownLayerManagerConfig, containers: TownLayerContainers, app: PIXI.Application) {
        this.config = config;
        this.containers = containers;
        this.app = app;
        this.initializeLayers();
    }

    /**
     * Updates the configuration
     */
    updateConfig(newConfig: Partial<TownLayerManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Initialize all layers with proper z-indexing
     */
    private initializeLayers(): void {
        // Set z-indexes for proper layer ordering (bottom to top)
        this.containers.alphaBackground.zIndex = 0;
        this.containers.backgroundImage.zIndex = 1;
        this.containers.cellGrid.zIndex = 2;
        this.containers.gridLines.zIndex = 3;
        this.containers.stickers.zIndex = 4;
        this.containers.highlight.zIndex = 5;

        // Ensure containers are properly sorted
        const allContainers = Object.values(this.containers);
        allContainers.forEach(container => {
            if (container.parent) {
                container.parent.sortChildren();
            }
        });

        console.log('[TownLayerManager] Layers initialized with z-indexing');
    }

    /**
     * Sets up alpha background layer
     */
    setAlphaBackground(color: number = 0xFFFFFF, alpha: number = 1.0): void {
        this.containers.alphaBackground.removeChildren();

        const background = new PIXI.Graphics();
        background.rect(0, 0, this.app.screen.width, this.app.screen.height);
        background.fill({ color, alpha });

        this.containers.alphaBackground.addChild(background);
        console.log('[TownLayerManager] Alpha background set:', { color, alpha });
    }

    /**
     * Sets up background image layer
     */
    setBackgroundImage(imageUrl: string, scale: number = 1, offsetX: number = 0, offsetY: number = 0): void {
        this.containers.backgroundImage.removeChildren();

        if (!imageUrl) return;

        const texture = PIXI.Texture.from(imageUrl);
        this.backgroundSprite = new PIXI.Sprite(texture);
        this.backgroundSprite.scale.set(scale);
        this.backgroundSprite.position.set(offsetX, offsetY);

        this.containers.backgroundImage.addChild(this.backgroundSprite);
        console.log('[TownLayerManager] Background image set:', { imageUrl, scale, offsetX, offsetY });
    }

    /**
     * Renders the cell grid layer with viewport culling
     */
    renderCellGrid(
        cells: Record<string, TownCell>,
        materials: any[],
        visibleBounds: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number; },
        cellTexture: PIXI.Texture
    ): void {
        // Clear existing cells
        this.containers.cellGrid.removeChildren();
        this.cellSprites.clear();

        let visibleCellCount = 0;

        console.log('[TownLayerManager] Rendering cell grid with bounds:', visibleBounds);

        // Only render visible cells for performance
        for (let y = Math.max(0, visibleBounds.minCellY); y <= visibleBounds.maxCellY; y++) {
            for (let x = Math.max(0, visibleBounds.minCellX); x <= visibleBounds.maxCellX; x++) {
                const cellKey = `${x},${y}`;
                const cellData = cells[cellKey];

                // Find material for this cell
                const material = materials.find(m => m.style === cellData?.material) ||
                    materials.find(m => m.style === 'default');
                const tint = material ? new PIXI.Color(material.color).toNumber() : 0xFFFFFF;

                // Create sprite
                const sprite = new PIXI.Sprite(cellTexture);
                sprite.width = this.config.cellSize;
                sprite.height = this.config.cellSize;
                sprite.x = x * this.config.cellSize;
                sprite.y = y * this.config.cellSize;
                sprite.tint = tint;

                this.containers.cellGrid.addChild(sprite);
                this.cellSprites.set(cellKey, sprite);
                visibleCellCount++;
            }
        }

        console.log('[TownLayerManager] Rendered', visibleCellCount, 'visible cells');
    }

    /**
     * Renders grid lines layer
     */
    renderGridLines(
        visible: boolean,
        visibleBounds: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number; },
        townWidth: number,
        townHeight: number
    ): void {
        if (!this.gridGraphics) {
            this.gridGraphics = new PIXI.Graphics();
            this.containers.gridLines.addChild(this.gridGraphics);
        }

        this.gridGraphics.clear();

        if (!visible) return;

        const lineStyle = {
            width: this.config.gridLineThickness,
            color: this.config.gridLineColor,
            alpha: 0.4
        };

        // Only draw visible grid lines for performance
        const startX = Math.max(0, visibleBounds.minCellX);
        const endX = Math.min(townWidth, visibleBounds.maxCellX + 1);
        const startY = Math.max(0, visibleBounds.minCellY);
        const endY = Math.min(townHeight, visibleBounds.maxCellY + 1);

        // Vertical lines
        for (let x = startX; x <= endX; x++) {
            this.gridGraphics.moveTo(x * this.config.cellSize, startY * this.config.cellSize);
            this.gridGraphics.lineTo(x * this.config.cellSize, endY * this.config.cellSize);
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y++) {
            this.gridGraphics.moveTo(startX * this.config.cellSize, y * this.config.cellSize);
            this.gridGraphics.lineTo(endX * this.config.cellSize, y * this.config.cellSize);
        }

        this.gridGraphics.stroke(lineStyle);
        console.log('[TownLayerManager] Grid lines rendered for bounds:', visibleBounds);
    }

    /**
     * Renders stickers layer
     */
    renderStickers(stickers: TownSticker[], visible: boolean = true): void {
        this.containers.stickers.removeChildren();
        this.containers.stickers.visible = visible;

        if (!visible || stickers.length === 0) return;

        stickers.forEach((sticker, index) => {
            console.log(`[TownLayerManager] Rendering sticker ${index}:`, sticker);

            const texture = PIXI.Texture.from(sticker.imageUrl);
            const sprite = new PIXI.Sprite(texture);

            sprite.position.set(sticker.position.x, sticker.position.y);
            sprite.scale.set(sticker.scale);
            sprite.rotation = sticker.rotation;
            sprite.zIndex = sticker.zIndex || 0;

            this.containers.stickers.addChild(sprite);
        });

        // Sort stickers by zIndex
        this.containers.stickers.sortChildren();
        console.log('[TownLayerManager] Rendered', stickers.length, 'stickers');
    }

    /**
     * Renders highlight layer (selection, hover effects)
     */
    renderHighlight(highlightData: { cellX: number; cellY: number; color: number; alpha: number } | null): void {
        this.containers.highlight.removeChildren();

        if (!highlightData) return;

        const highlight = new PIXI.Graphics();
        highlight.rect(
            highlightData.cellX * this.config.cellSize,
            highlightData.cellY * this.config.cellSize,
            this.config.cellSize,
            this.config.cellSize
        );
        highlight.fill({ color: highlightData.color, alpha: highlightData.alpha });

        this.containers.highlight.addChild(highlight);
    }

    /**
     * Sets the visibility of a specific layer
     */
    setLayerVisibility(layer: keyof TownLayerContainers, visible: boolean): void {
        this.containers[layer].visible = visible;
        console.log(`[TownLayerManager] Layer ${layer} visibility set to:`, visible);
    }

    /**
     * Sets the alpha of a specific layer
     */
    setLayerAlpha(layer: keyof TownLayerContainers, alpha: number): void {
        this.containers[layer].alpha = alpha;
        console.log(`[TownLayerManager] Layer ${layer} alpha set to:`, alpha);
    }

    /**
     * Gets all containers for viewport management
     */
    getAllContainers(): PIXI.Container[] {
        return [
            this.containers.alphaBackground,
            this.containers.backgroundImage,
            this.containers.cellGrid,
            this.containers.gridLines,
            this.containers.stickers,
            this.containers.highlight
        ];
    }

    /**
     * Get cell sprites for painting functionality
     */
    getCellSprites(): Map<string, PIXI.Sprite> {
        return this.cellSprites;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        Object.values(this.containers).forEach(container => {
            container.removeChildren();
        });

        this.backgroundSprite = null;
        this.gridGraphics = null;

        console.log('[TownLayerManager] Destroyed');
    }
}
