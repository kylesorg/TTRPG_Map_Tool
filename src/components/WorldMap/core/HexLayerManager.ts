import * as PIXI from 'pixi.js';
import { axialToPixelOriented, type HexOrientation } from '../../../utils/hexMath';
import { GRID_ROWS, GRID_COLS } from '../../../utils/constants';
import type { DrawingPath } from '../../../types/mapTypes';

export interface LayerManagerConfig {
    tileSize: number;
    hexOrientation?: HexOrientation; // NEW: Add hex orientation
    viewSettings: {
        showTownNames: boolean;
    };
    gridLineThickness: number;
    gridLineColor: string;
    textScale: number;
}

export interface LayerContainers {
    background: PIXI.Container;
    hexFills: PIXI.Container;
    hexBorders: PIXI.Container;
    geography: PIXI.Container;
    liveDrawing: PIXI.Container;
    townNames: PIXI.Container;
    highlight: PIXI.Container;
}

export class HexLayerManager {
    private config: LayerManagerConfig;
    private containers: LayerContainers;
    private app: PIXI.Application;

    // Layer-specific objects
    private backgroundSprite: PIXI.Sprite | null = null;
    private offscreenDrawingContainer: PIXI.Container | null = null;
    private drawingRenderTexture: PIXI.RenderTexture | null = null;

    // Town name rendering optimization
    private lastTownNamesHash: string = '';
    private lastTextScale: number = -1;

    constructor(config: LayerManagerConfig, containers: LayerContainers, app: PIXI.Application) {
        this.config = config;
        this.containers = containers;
        this.app = app;
        this.initializeLayers();
    }

    /**
     * Updates the configuration
     */
    updateConfig(newConfig: Partial<LayerManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Initializes all layer containers with proper z-index and settings
     */
    private initializeLayers(): void {
        this.app.stage.sortableChildren = true;

        const layerConfig = [
            { container: this.containers.background, name: 'background', zIndex: 1 },
            { container: this.containers.hexFills, name: 'hexFills', zIndex: 2 },
            { container: this.containers.hexBorders, name: 'hexBorders', zIndex: 3 },
            { container: this.containers.geography, name: 'geography', zIndex: 4 },
            { container: this.containers.liveDrawing, name: 'liveDrawing', zIndex: 5 },
            { container: this.containers.townNames, name: 'townNames', zIndex: 6 },
            { container: this.containers.highlight, name: 'highlight', zIndex: 10 }
        ];

        layerConfig.forEach(({ container, name, zIndex }) => {
            container.sortableChildren = true;
            container.zIndex = zIndex;
            (container as any).label = name; // Add label for debugging

            if (!this.app.stage.children.includes(container)) {
                this.app.stage.addChild(container);
            }
        });
    }

    /**
     * Initializes the geography/drawing layer
     */
    initializeGeographyLayer(): void {
        if (!this.offscreenDrawingContainer) {
            this.offscreenDrawingContainer = new PIXI.Container();
        }

        if (!this.drawingRenderTexture) {
            this.drawingRenderTexture = PIXI.RenderTexture.create({
                width: this.app.screen.width,
                height: this.app.screen.height
            });

            // Create a sprite to display the render texture and add it to the geography container
            const geographySprite = new PIXI.Sprite(this.drawingRenderTexture);
            geographySprite.label = 'geographySprite';

            // Clear any existing children and add the sprite
            this.containers.geography.removeChildren();
            this.containers.geography.addChild(geographySprite);

            console.log('[HexLayerManager] Geography layer initialized with render texture sprite:', {
                spriteWidth: geographySprite.width,
                spriteHeight: geographySprite.height,
                spriteVisible: geographySprite.visible,
                spriteAlpha: geographySprite.alpha,
                spritePosition: { x: geographySprite.x, y: geographySprite.y },
                containerVisible: this.containers.geography.visible,
                containerAlpha: this.containers.geography.alpha,
                containerPosition: { x: this.containers.geography.x, y: this.containers.geography.y },
                containerChildren: this.containers.geography.children.length
            });
        }
    }

    /**
     * Sets the visibility of grid lines (hex borders) - now relies on texture generation
     */
    setGridLinesVisibility(_visible: boolean): void {
        // The actual grid line visibility is now controlled by texture generation
        // in the HexGridManager, not by hiding containers
    }

    /**
     * Sets the visibility of geography layer
     */
    setGeographyVisibility(visible: boolean): void {
        this.containers.geography.visible = visible;
        this.containers.liveDrawing.visible = visible;
    }

    /**
     * Sets the visibility of town names
     */
    setTownNamesVisibility(visible: boolean): void {
        this.containers.townNames.visible = visible;
    }

    /**
     * Gets the center coordinates of the hex grid
     */
    private getGridCenterCoordinates(): { q: number; r: number } {
        const centerQ = Math.floor(GRID_COLS / 2);
        const centerR = Math.floor(GRID_ROWS / 2);
        return { q: centerQ, r: centerR };
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.backgroundSprite) {
            this.backgroundSprite.destroy();
            this.backgroundSprite = null;
        }
        if (this.drawingRenderTexture) {
            this.drawingRenderTexture.destroy();
            this.drawingRenderTexture = null;
        }
        if (this.offscreenDrawingContainer) {
            this.offscreenDrawingContainer.destroy();
            this.offscreenDrawingContainer = null;
        }
    }

    /**
     * Renders drawing paths (geography features like roads and rivers)
     */
    renderDrawingPaths(drawingPaths: DrawingPath[], visible: boolean = true): void {
        // Render drawing paths

        // Set geography layer visibility
        this.containers.geography.visible = visible;

        if (!visible || drawingPaths.length === 0) {
            this.containers.geography.removeChildren();
            return;
        }

        // Geography layer visibility check passed

        // Clear existing drawings
        this.containers.geography.removeChildren();

        // Draw paths directly to the geography container (no render texture)
        drawingPaths.forEach((path, index) => {
            console.log(`[HexLayerManager] Rendering path ${index}:`, {
                id: path.id,
                type: path.type,
                pointCount: path.points.length,
                color: path.color,
                strokeWidth: path.strokeWidth
            });

            const graphics = new PIXI.Graphics();
            const pathColor = path.color || '#000000'; // Default to black
            const strokeWidth = Math.max(path.strokeWidth || 2, 2); // Minimum 2px width

            // Using drawing color and stroke width

            // Handle erasing
            if (pathColor === '#FFFFFF') {
                graphics.blendMode = 'erase';
            }

            // Draw the path with better quality
            if (path.points.length > 0) {
                console.log('[HexLayerManager] Drawing path points:', {
                    firstPoint: path.points[0],
                    lastPoint: path.points[path.points.length - 1],
                    totalPoints: path.points.length
                });

                // Use PIXI's graphics API for smoother lines
                graphics.stroke({
                    width: strokeWidth,
                    color: pathColor,
                    cap: 'round',      // Round line caps for smoother ends
                    join: 'round',     // Round line joins for smoother corners
                    miterLimit: 10     // Better miter handling
                });

                // Draw the path using moveTo and lineTo
                graphics.moveTo(path.points[0].x, path.points[0].y);
                for (let i = 1; i < path.points.length; i++) {
                    graphics.lineTo(path.points[i].x, path.points[i].y);
                }

                console.log('[HexLayerManager] Graphics object after drawing:', {
                    bounds: graphics.getBounds(),
                    visible: graphics.visible,
                    alpha: graphics.alpha
                });
            }

            // Add directly to geography container
            this.containers.geography.addChild(graphics);
        });

        console.log('[HexLayerManager] Added paths directly to geography container, total children:', this.containers.geography.children.length);
    }

    /**
     * Renders a live drawing preview path
     */
    renderDrawingPreview(previewData: { points: { x: number; y: number }[], color: string, strokeWidth: number } | null): void {
        // Render drawing preview

        // Clear existing preview
        this.containers.liveDrawing.removeChildren();

        // If no preview data, we're just clearing
        if (!previewData || previewData.points.length < 2) {
            return;
        }

        // Create graphics for preview path
        const graphics = new PIXI.Graphics();
        const pathColor = previewData.color || '#000000';
        const strokeWidth = Math.max(previewData.strokeWidth || 2, 2);

        console.log('[HexLayerManager] Drawing preview path with color:', pathColor, 'strokeWidth:', strokeWidth);

        // Draw the preview path with slightly reduced opacity and improved quality
        if (previewData.points.length > 0) {
            // Use improved stroke settings for smooth preview lines
            graphics.stroke({
                width: strokeWidth,
                color: pathColor,
                alpha: 0.7,        // Slightly transparent for preview
                cap: 'round',      // Round line caps for smoother ends
                join: 'round',     // Round line joins for smoother corners
                miterLimit: 10     // Better miter handling
            });

            graphics.moveTo(previewData.points[0].x, previewData.points[0].y);
            for (let i = 1; i < previewData.points.length; i++) {
                graphics.lineTo(previewData.points[i].x, previewData.points[i].y);
            }

            // Add to live drawing container
            this.containers.liveDrawing.addChild(graphics);
            console.log('[HexLayerManager] Added preview path to liveDrawing container');
        }
    }

    /**
     * Gets all containers for viewport management
     */
    getAllContainers(): PIXI.Container[] {
        return [
            this.containers.background,
            this.containers.hexFills,
            this.containers.hexBorders,
            this.containers.geography,
            this.containers.liveDrawing,
            this.containers.townNames,
            this.containers.highlight
        ];
    }

    /**
     * Renders town names on the map
     */
    renderTownNames(hexTiles: any[]): void {
        // Filter for towns and render their names
        const towns = hexTiles.filter(hex => hex.isTown && hex.townName);

        // Create a hash of the current town data to check if re-render is needed
        const currentHash = towns.map(town => `${town.id}:${town.townName}:${town.coordinates.q}:${town.coordinates.r}`).join('|');
        const scaleChanged = this.lastTextScale !== this.config.textScale;

        // Only re-render if towns changed or text scale changed
        if (currentHash === this.lastTownNamesHash && !scaleChanged) {
            return; // No changes, skip re-render
        }

        this.lastTownNamesHash = currentHash;
        this.lastTextScale = this.config.textScale;

        // Clear existing text
        this.containers.townNames.removeChildren();

        towns.forEach(town => {
            const townName = town.townName || 'Unnamed Town';
            // Use the new PIXI v8 syntax to avoid deprecation warning
            const text = new PIXI.Text({
                text: townName,
                style: {
                    fontFamily: 'Arial',
                    fontSize: 60 * this.config.textScale, // 5x bigger default size (was 12, now 60)
                    fill: 0xffffff,
                    stroke: { color: 0x000000, width: 8 }, // Even thicker stroke for better visibility (was 6, now 8)
                    align: 'center'
                }
            });

            // Position the text above the hex
            const hexCenter = this.getHexCenterPosition(town.coordinates.q, town.coordinates.r);
            text.x = hexCenter.x;
            text.y = hexCenter.y - (this.config.tileSize * 3.5); // Move much higher above the hex (3.5 * 12 = 42 pixels above center)
            text.anchor.set(0.5, 0.5); // Center the text

            this.containers.townNames.addChild(text);
        });

        console.log(`[HexLayerManager] Rendered ${towns.length} town names (scale: ${this.config.textScale})`);
    }

    /**
     * Gets the center position of a hex in pixel coordinates
     */
    private getHexCenterPosition(q: number, r: number): { x: number; y: number } {
        return axialToPixelOriented(q, r, this.config.tileSize, this.config.hexOrientation || 'flat-top');
    }

    /**
     * Background image methods (placeholders for now)
     */
    clearBackgroundImage(): void {
        if (this.backgroundSprite) {
            this.containers.background.removeChild(this.backgroundSprite);
            this.backgroundSprite.destroy();
            this.backgroundSprite = null;
        }
    }

    setBackgroundImageVisibility(visible: boolean): void {
        if (this.backgroundSprite) {
            this.backgroundSprite.visible = visible;
        }
    }

    setBackgroundImageScale(scale: number): void {
        if (this.backgroundSprite) {
            this.backgroundSprite.scale.set(scale);
        }
    }

    setBackgroundImageOffset(offsetX: number, offsetY: number): void {
        if (this.backgroundSprite) {
            this.backgroundSprite.position.set(offsetX, offsetY);
        }
    }

    /**
     * Loads a background image
     */
    async loadBackgroundImage(imageUrl: string): Promise<void> {
        try {
            // Clear previous background if it exists
            if (this.backgroundSprite) {
                this.containers.background.removeChild(this.backgroundSprite);
                this.backgroundSprite.destroy();
                this.backgroundSprite = null;
            }

            const texture = await PIXI.Assets.load(imageUrl);
            this.backgroundSprite = new PIXI.Sprite(texture);

            // Center the sprite anchor point
            this.backgroundSprite.anchor.set(0.5);

            // Position at the actual hex grid center
            const { q: centerQ, r: centerR } = this.getGridCenterCoordinates();
            const centerPixel = axialToPixelOriented(centerQ, centerR, this.config.tileSize, this.config.hexOrientation);
            this.backgroundSprite.position.set(centerPixel.x, centerPixel.y);

            // Add to background container
            this.containers.background.addChild(this.backgroundSprite);
        } catch (error) {
            console.error('[HexLayerManager] Failed to load background image:', error);
        }
    }

    /**
     * Resize handler (placeholder)
     */
    handleResize(_width: number, _height: number): void {
        // Placeholder implementation
    }

    /**
     * Grid line and text configuration (placeholders)
     */
    setGridLineThickness(_thickness: number): void {
        // Handled by texture generation now
    }

    setGridLineColor(_color: string): void {
        // Handled by texture generation now
    }

    setTextScale(scale: number): void {
        // Update the text scale in the configuration
        this.config.textScale = scale;
        // Force re-render by resetting the scale tracking
        this.lastTextScale = -1;
        console.log(`[HexLayerManager] Text scale updated to: ${scale}`);
    }

    setHexOrientation(_orientation: HexOrientation): void {
        // Placeholder implementation
    }

    updateBackgroundImageForOrientation(): void {
        // Placeholder implementation
    }
}
