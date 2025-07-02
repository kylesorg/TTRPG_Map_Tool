import * as PIXI from 'pixi.js';
import { type HexOrientation, getHexOrientation } from './hexMath'; // NEW: Import hex orientation utilities

export interface HexTextureSet {
    fill: PIXI.Texture;
    border: PIXI.Texture;
    highlight: PIXI.Texture;
}

/**
 * Generates hexagon points for texture creation
 * @param center Center coordinate for the hex
 * @param radius Radius of the hex
 * @param orientation Hex orientation (flat-top or pointy-top)
 */
function generateHexPoints(center: number, radius: number, orientation: HexOrientation = 'flat-top'): [number, number][] {
    const points: [number, number][] = [];
    const orientationConfig = getHexOrientation(orientation);

    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i + (orientationConfig.polygonAngleOffset * Math.PI / 180);
        points.push([
            center + radius * Math.cos(angle),
            center + radius * Math.sin(angle)
        ]);
    }
    return points;
}

/**
 * Creates a hex fill texture
 */
function createHexFillTexture(
    app: PIXI.Application,
    points: [number, number][],
    fillColor: string = 'rgba(255, 255, 255, 1)'
): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    graphics.beginPath();
    graphics.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < 6; i++) {
        graphics.lineTo(points[i][0], points[i][1]);
    }
    graphics.closePath();
    graphics.fill({ color: fillColor });

    return app.renderer.generateTexture(graphics);
}

/**
 * Creates a hex border texture
 */
function createHexBorderTexture(
    app: PIXI.Application,
    points: [number, number][],
    borderWidth: number = 2,
    borderColor: string = 'rgba(0, 0, 0, 0.8)'
): PIXI.Texture {
    const graphics = new PIXI.Graphics();

    // If borderWidth is 0, create a transparent texture
    if (borderWidth <= 0) {
        graphics.setStrokeStyle({ width: 1, color: 'rgba(0, 0, 0, 0)' });
    } else {
        graphics.setStrokeStyle({ width: borderWidth, color: borderColor });
    }

    graphics.beginPath();
    graphics.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < 6; i++) {
        graphics.lineTo(points[i][0], points[i][1]);
    }
    graphics.closePath();
    graphics.stroke();

    return app.renderer.generateTexture(graphics);
}

/**
 * Creates a hex highlight texture
 */
function createHexHighlightTexture(
    app: PIXI.Application,
    points: [number, number][],
    borderWidth: number = 4,
    highlightColor: string = 'rgba(255, 255, 0, 1)'
): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    graphics.setStrokeStyle({ width: borderWidth, color: highlightColor });
    graphics.beginPath();
    graphics.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < 6; i++) {
        graphics.lineTo(points[i][0], points[i][1]);
    }
    graphics.closePath();
    graphics.stroke();

    return app.renderer.generateTexture(graphics);
}

/**
 * Generates all hex textures needed for the grid
 */
export function generateHexTextures(
    app: PIXI.Application,
    tileSize: number,
    options: {
        borderWidth?: number;
        fillColor?: string;
        borderColor?: string;
        highlightColor?: string;
        orientation?: HexOrientation; // NEW: Add orientation option
    } = {}
): HexTextureSet {
    const {
        borderWidth = 2,
        fillColor = 'rgba(255, 255, 255, 1)',
        borderColor = 'rgba(0, 0, 0, 0.8)',
        highlightColor = 'rgba(255, 255, 0, 1)',
        orientation = 'flat-top' // NEW: Default to flat-top for backwards compatibility
    } = options;

    // Calculate texture size and center - keep size consistent regardless of border width
    const maxBorderWidth = 5; // Maximum expected border width
    const size = tileSize * 2 + maxBorderWidth * 2;
    const center = size / 2;

    // When borderWidth is 0, make the fill slightly larger to eliminate gaps
    const fillRadius = borderWidth === 0 ? tileSize + 1 : tileSize;

    // Generate hex points (orientation-aware)
    const fillPoints = generateHexPoints(center, fillRadius, orientation);
    const borderPoints = generateHexPoints(center, tileSize, orientation);

    try {
        // Create all textures
        const fillTexture = createHexFillTexture(app, fillPoints, fillColor);
        const borderTexture = createHexBorderTexture(app, borderPoints, borderWidth, borderColor);
        const highlightTexture = createHexHighlightTexture(app, borderPoints, borderWidth * 2, highlightColor);

        return {
            fill: fillTexture,
            border: borderTexture,
            highlight: highlightTexture
        };
    } catch (error) {
        console.error('[generateHexTextures] Error creating textures:', error);
        throw error;
    }
}
