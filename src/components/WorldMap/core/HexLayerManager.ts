import * as PIXI from 'pixi.js';
import { axialToPixelOriented, type HexOrientation } from '../../../utils/hexMath';
import { GRID_ROWS, GRID_COLS } from '../../../utils/constants';
import type { DrawingPath } from '../../../types/mapTypes';
import type { GeographyImageData } from '../../../utils/geographyImageManager';

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
            { container: this.containers.background, name: 'background', zIndex: 1 }, // Background image layer - under hex fills
            { container: this.containers.hexFills, name: 'hexFills', zIndex: 2 }, // Hex biome fills (with transparency options)
            { container: this.containers.hexBorders, name: 'hexBorders', zIndex: 3 }, // Hex border lines
            { container: this.containers.geography, name: 'geography', zIndex: 4 }, // Geography/drawing layer
            { container: this.containers.liveDrawing, name: 'liveDrawing', zIndex: 5 }, // Live drawing preview
            { container: this.containers.townNames, name: 'townNames', zIndex: 6 }, // Town names
            { container: this.containers.highlight, name: 'highlight', zIndex: 10 } // Selection highlight
        ];

        layerConfig.forEach(({ container, name, zIndex }) => {
            container.sortableChildren = true;
            container.zIndex = zIndex;
            (container as any).label = name; // Add label for debugging

            if (!this.app.stage.children.includes(container)) {
                this.app.stage.addChild(container);
            }
        });

        // Enable sorting by zIndex on the main stage
        this.app.stage.sortableChildren = true;
        this.app.stage.sortChildren();
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
        // Set geography layer visibility
        this.containers.geography.visible = visible;

        if (!visible || drawingPaths.length === 0) {
            this.containers.geography.removeChildren();
            return;
        }

        // Clear existing drawings
        this.containers.geography.removeChildren();

        // Draw paths directly to the geography container
        drawingPaths.forEach((path) => {
            const graphics = new PIXI.Graphics();
            const pathColor = path.color || '#000000'; // Default to black
            const strokeWidth = Math.max(path.strokeWidth || 2, 2); // Minimum 2px width

            // Handle erasing
            if (pathColor === '#FFFFFF') {
                graphics.blendMode = 'erase';
            }

            // Draw the path with better quality
            if (path.points.length > 0) {
                // Set stroke style - use the correct PIXI v8 API
                graphics.setStrokeStyle({
                    width: strokeWidth,
                    color: pathColor,
                    cap: 'round',
                    join: 'round'
                });

                // Begin path and draw the path using moveTo and lineTo
                graphics.beginPath();
                graphics.moveTo(path.points[0].x, path.points[0].y);
                for (let i = 1; i < path.points.length; i++) {
                    graphics.lineTo(path.points[i].x, path.points[i].y);
                }
                graphics.stroke(); // Actually draw the stroke
            }

            // Add directly to geography container
            this.containers.geography.addChild(graphics);
        });

        // Expose debug function globally for testing
        (window as any).debugGeography = () => this.debugGeographyContainer();
    }

    /**
     * Renders a live drawing path - updates in real-time as user draws
     */
    renderLiveDrawing(liveDrawingData: { points: { x: number; y: number }[], color: string, strokeWidth: number } | null): void {
        // Clear existing live drawing
        this.containers.liveDrawing.removeChildren();

        // If no drawing data, we're just clearing
        if (!liveDrawingData || liveDrawingData.points.length < 1) {
            return;
        }

        // Create graphics for live drawing path
        const graphics = new PIXI.Graphics();
        const pathColor = liveDrawingData.color || '#000000';
        const strokeWidth = Math.max(liveDrawingData.strokeWidth || 2, 2);

        // Draw the live path with full opacity for immediate feedback
        if (liveDrawingData.points.length > 0) {
            // Set stroke style for live drawing - use the correct PIXI v8 API
            graphics.setStrokeStyle({
                width: strokeWidth,
                color: pathColor,
                alpha: 1.0,        // Full opacity for live drawing
                cap: 'round',      // Round line caps for smoother ends
                join: 'round'      // Round line joins for smoother corners
            });

            // Begin path and draw
            graphics.beginPath();
            graphics.moveTo(liveDrawingData.points[0].x, liveDrawingData.points[0].y);
            for (let i = 1; i < liveDrawingData.points.length; i++) {
                graphics.lineTo(liveDrawingData.points[i].x, liveDrawingData.points[i].y);
            }
            graphics.stroke(); // Actually draw the stroke

            // Add to live drawing container
            this.containers.liveDrawing.addChild(graphics);
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
    }

    /**
     * Gets the center position of a hex in pixel coordinates
     */
    private getHexCenterPosition(q: number, r: number): { x: number; y: number } {
        return axialToPixelOriented(q, r, this.config.tileSize, this.config.hexOrientation || 'flat-top');
    }

    /**
     * Background image methods
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
            // Calculate the base center position
            const { q: centerQ, r: centerR } = this.getGridCenterCoordinates();
            const centerPixel = axialToPixelOriented(centerQ, centerR, this.config.tileSize, this.config.hexOrientation || 'flat-top');

            // Apply offset to the center position
            const finalX = centerPixel.x + offsetX;
            const finalY = centerPixel.y + offsetY;
            this.backgroundSprite.position.set(finalX, finalY);
        }
    }

    /**
     * Loads a background image
     */
    async loadBackgroundImage(imageUrl: string): Promise<void> {
        // Load background image (only log errors, not normal operation)

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

            // Position at the center hex of the grid
            const { q: centerQ, r: centerR } = this.getGridCenterCoordinates();
            const centerPixel = axialToPixelOriented(centerQ, centerR, this.config.tileSize, this.config.hexOrientation || 'flat-top');
            this.backgroundSprite.position.set(centerPixel.x, centerPixel.y);

            // Add to background container
            this.containers.background.addChild(this.backgroundSprite);

            // Ensure proper layer ordering
            this.app.stage.sortChildren();

        } catch (error) {
            console.error('[HexLayerManager] Failed to load background image:', error);
        }
    }

    /**
     * Debug method to test background image positioning
     */
    debugBackgroundImagePosition(): void {
        if (!this.backgroundSprite) {
            console.log('[HexLayerManager] No background sprite loaded');
            return;
        }

        const gridCenter = this.getGridCenterCoordinates();
        const centerPixel = axialToPixelOriented(gridCenter.q, gridCenter.r, this.config.tileSize, this.config.hexOrientation || 'flat-top');

        console.log('[HexLayerManager] Background Image Debug:', {
            gridCenter,
            centerPixel,
            spritePosition: { x: this.backgroundSprite.x, y: this.backgroundSprite.y },
            spriteVisible: this.backgroundSprite.visible,
            containerPosition: { x: this.containers.background.x, y: this.containers.background.y }
        });

        // Expose this function globally for manual testing
        (window as any).debugBackgroundImage = () => this.debugBackgroundImagePosition();
    }

    /**
     * Debug method to get geography container state
     */
    debugGeographyContainer(): any {
        return {
            childCount: this.containers.geography.children.length,
            visible: this.containers.geography.visible,
            alpha: this.containers.geography.alpha,
            position: {
                x: this.containers.geography.x,
                y: this.containers.geography.y
            },
            scale: {
                x: this.containers.geography.scale.x,
                y: this.containers.geography.scale.y
            },
            children: this.containers.geography.children.map((child, index) => ({
                index,
                type: child.constructor.name,
                visible: child.visible,
                alpha: child.alpha,
                bounds: child.getBounds(),
                localBounds: child.getLocalBounds()
            }))
        };
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
    }

    setHexOrientation(orientation: HexOrientation): void {
        this.config.hexOrientation = orientation;

        // Reposition background image if it exists
        if (this.backgroundSprite) {
            const { q: centerQ, r: centerR } = this.getGridCenterCoordinates();
            const centerPixel = axialToPixelOriented(centerQ, centerR, this.config.tileSize, orientation);
            this.backgroundSprite.position.set(centerPixel.x, centerPixel.y);
        }
    }

    updateBackgroundImageForOrientation(): void {
        // This method is called when orientation changes to reposition the background image
        if (this.backgroundSprite) {
            const { q: centerQ, r: centerR } = this.getGridCenterCoordinates();
            const centerPixel = axialToPixelOriented(centerQ, centerR, this.config.tileSize, this.config.hexOrientation || 'flat-top');
            this.backgroundSprite.position.set(centerPixel.x, centerPixel.y);
        }
    }

    /**
     * Loads and displays a geography image
     */
    async loadGeographyImage(imageData: GeographyImageData | null, visible: boolean = true): Promise<void> {
        // Set geography layer visibility
        this.containers.geography.visible = visible;

        // Clear existing geography content (paths or images)
        this.containers.geography.removeChildren();

        if (!visible || !imageData) {
            return;
        }

        try {
            // Create an image element from the base64 data
            const img = new Image();
            img.src = imageData.imageDataUrl;

            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load geography image'));
            });

            // Create a PIXI texture from the image
            const texture = PIXI.Texture.from(img);
            const sprite = new PIXI.Sprite(texture);

            // Position the image at the origin (0,0) since it's pre-centered
            sprite.position.set(imageData.offsetX, imageData.offsetY);
            sprite.scale.set(imageData.scale);
            sprite.anchor.set(0.5); // Center the sprite

            // Add to geography container
            this.containers.geography.addChild(sprite);

            console.log('[HexLayerManager] Geography image loaded and displayed:', {
                size: { width: imageData.width, height: imageData.height },
                position: { x: imageData.offsetX, y: imageData.offsetY },
                scale: imageData.scale
            });

        } catch (error) {
            console.error('[HexLayerManager] Failed to load geography image:', error);
        }
    }
}
