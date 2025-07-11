// Basic Hexagonal Grid Math Utilities

import type { HexCoordinates, DrawingPath } from '../types/mapTypes';

// ====================================================================
// FLAT-TOP HEX MATH FUNCTIONS
// ====================================================================

// Axial coordinates to pixel coordinates (flat top)
export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
    const x = size * (3 / 2 * q);
    const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return { x, y };
}

// Pixel coordinates to axial coordinates (approximate, flat top)
export function pixelToAxial(x: number, y: number, size: number): HexCoordinates {
    const q_frac = (2 / 3 * x) / size;
    const r_frac = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
    return hexRound({ q: q_frac, r: r_frac, s: -q_frac - r_frac });
}

// Hex rounding for fractional hex coordinates
export function hexRound(hex: HexCoordinates): HexCoordinates {
    let q = Math.round(hex.q);
    let r = Math.round(hex.r);
    let s = Math.round(hex.s);

    const q_diff = Math.abs(q - hex.q);
    const r_diff = Math.abs(r - hex.r);
    const s_diff = Math.abs(s - hex.s);

    if (q_diff > r_diff && q_diff > s_diff) {
        q = -r - s;
    } else if (r_diff > s_diff) {
        r = -q - s;
    } else {
        s = -q - r;
    }
    return { q, r, s };
}

// Offset coordinate conversion (even-q for flat-topped)
// col = q
// row = r + (q + (q & 1)) / 2
export function axialToEvenQ(q: number, r: number): { col: number; row: number } {
    const col = q;
    const row = r + (q + (q & 1)) / 2;
    return { col, row };
}

export function evenQToAxial(col: number, row: number): { q: number; r: number } {
    const q = col;
    const r = row - (col + (col & 1)) / 2;
    return { q, r };
}

// Using the even-q conversion for labeling for flat-topped hexagons:
export function hexToLabel(hex: HexCoordinates): { labelX: number; labelY: number } {
    const { col, row } = axialToEvenQ(hex.q, hex.r);
    // Assuming labelX is column-like (q) and labelY is row-like (visual row in even-q)
    return { labelX: col, labelY: row };
}

export function labelToHex(labelX: number, labelY: number): HexCoordinates {
    const { q, r } = evenQToAxial(labelX, labelY); // labelX is col, labelY is row
    return { q, r, s: -q - r };
}

// Converts user-defined (X,Y) coordinates to axial (q,r,s) coordinates
// userX: 0 at left, increases to the right (standard X axis)
// userY: 0 at bottom, increases upwards (standard Y axis)
export function userToAxial(
    userX: number,
    userY: number,
    gridRows: number,
    gridCols: number = gridRows,
    orientation: HexOrientation = 'flat-top'
): HexCoordinates {
    if (orientation === 'flat-top') {
        return userToAxialFlatTop(userX, userY, gridRows);
    } else {
        return userToAxialPointyTop(userX, userY, gridRows, gridCols);
    }
}

// Flat-top conversion (original logic using even-q)
function userToAxialFlatTop(userX: number, userY: number, gridRows: number): HexCoordinates {
    // Convert user (X,Y) to visual offset coordinates (vCol, vRow_from_top)
    // vCol is equivalent to q in an even-q offset system
    // vRow_from_top is equivalent to r in an even-q offset system (before axial conversion)
    const vCol = userX;  // userX maps to column (horizontal)
    const vRow_from_top = (gridRows - 1) - userY;  // userY maps to row (vertical, flipped)

    // Convert visual even-q (vCol, vRow_from_top) to an intermediate axial (q', r')
    // q_axial = q_offset
    // r_axial = r_offset - (q_offset + (q_offset & 1)) / 2
    const q_prime = vCol;
    const r_prime = vRow_from_top - (vCol + (vCol & 1)) / 2;

    // Apply the r-offset used in gridHelpers.ts to align the grid's origin
    const r_axial_offset = -(gridRows - 1);

    const q_axial = q_prime;
    const r_axial = r_prime + r_axial_offset;
    const s_axial = -q_axial - r_axial;

    return { q: q_axial, r: r_axial, s: s_axial };
}

// Pointy-top conversion using even-r offset coordinates
function userToAxialPointyTop(userX: number, userY: number, gridRows: number, gridCols: number): HexCoordinates {
    // For pointy-top rectangular grid, use even-r offset coordinates
    // Calculate the same offsets used in generatePointyTopGrid
    const q_axial_offset = -Math.floor(gridCols / 2);
    const r_axial_offset = -Math.floor(gridRows / 2);

    // Convert user coordinates to even-r offset coordinates
    // Flip Y so that userY=0 is at bottom (matches generatePointyTopGrid)
    const offsetCol = userX;
    const offsetRow = (gridRows - 1) - userY;  // Flip Y axis

    // Convert even-r offset to axial coordinates
    const q_axial = offsetCol - (offsetRow + (offsetRow & 1)) / 2 + q_axial_offset;
    const r_axial = offsetRow + r_axial_offset;
    const s_axial = -q_axial - r_axial;

    return { q: q_axial, r: r_axial, s: s_axial };
}

// ====================================================================
// POINTY-TOP HEX MATH FUNCTIONS (NEW - ADDITIVE ONLY)
// ====================================================================

// Axial coordinates to pixel coordinates (pointy top)
// Back to standard pointy-top math - this creates perfect tessellation
export function axialToPixelPointy(q: number, r: number, size: number): { x: number; y: number } {
    // Standard pointy-top hex grid math
    const x = size * Math.sqrt(3) * (q + r / 2);
    const y = size * (3 / 2) * r;
    return { x, y };
}

// Pixel coordinates to axial coordinates (approximate, pointy top)
// Back to standard pointy-top inverse math
export function pixelToAxialPointy(x: number, y: number, size: number): HexCoordinates {
    // Standard pointy-top hex grid inverse math
    const q_frac = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
    const r_frac = (2 / 3 * y) / size;
    return hexRound({ q: q_frac, r: r_frac, s: -q_frac - r_frac });
}

// ====================================================================
// HEX ORIENTATION CONFIGURATION SYSTEM
// ====================================================================

export type HexOrientation = 'flat-top' | 'pointy-top';

export interface HexOrientationConfig {
    type: HexOrientation;
    axialToPixel: (q: number, r: number, size: number) => { x: number; y: number };
    pixelToAxial: (x: number, y: number, size: number) => HexCoordinates;
    polygonAngleOffset: number; // degrees to add to vertex calculations
}

// Orientation configurations
export const HEX_ORIENTATIONS: Record<HexOrientation, HexOrientationConfig> = {
    'flat-top': {
        type: 'flat-top',
        axialToPixel: axialToPixel,
        pixelToAxial: pixelToAxial,
        polygonAngleOffset: 0 // 0, 60, 120, 180, 240, 300
    },
    'pointy-top': {
        type: 'pointy-top',
        axialToPixel: axialToPixelPointy,
        pixelToAxial: pixelToAxialPointy,
        polygonAngleOffset: 30 // 30, 90, 150, 210, 270, 330
    }
};

// Helper function to get orientation config
export function getHexOrientation(orientation: HexOrientation): HexOrientationConfig {
    return HEX_ORIENTATIONS[orientation];
}

// Helper functions that use orientation
export function axialToPixelOriented(
    q: number,
    r: number,
    size: number,
    orientation: HexOrientation = 'flat-top'
): { x: number; y: number } {
    const config = getHexOrientation(orientation);
    return config.axialToPixel(q, r, size);
}

export function pixelToAxialOriented(
    x: number,
    y: number,
    size: number,
    orientation: HexOrientation = 'flat-top'
): HexCoordinates {
    const config = getHexOrientation(orientation);
    return config.pixelToAxial(x, y, size);
}

/**
 * Converts axial coordinates back to user coordinates (labelX, labelY)
 * This is the inverse of the coordinate conversion in generateTestHexGrid
 */
export function axialToUserCoordinates(
    q_axial: number,
    r_axial: number,
    gridRows: number,
    gridCols: number,
    orientation: HexOrientation = 'flat-top'
): { labelX: number; labelY: number } | null {
    if (orientation === 'flat-top') {
        // Reverse the flat-top conversion from generateFlatTopGrid
        const r_axial_offset = -(gridRows - 1);

        // Convert back from axial to intermediate coordinates
        const q_prime = q_axial;
        const r_prime = r_axial - r_axial_offset;

        // Convert back from intermediate to visual offset coordinates
        const vCol = q_prime;
        const vRow_from_top = r_prime + (vCol + (vCol & 1)) / 2;

        // Convert back to user coordinates
        const userX = vCol;
        const userY = (gridRows - 1) - vRow_from_top;

        // Check bounds
        if (userX >= 0 && userX < gridCols && userY >= 0 && userY < gridRows) {
            return { labelX: userX, labelY: userY };
        }
    } else {
        // Reverse the pointy-top conversion from generatePointyTopGrid
        const q_axial_offset = -Math.floor(gridCols / 2);
        const r_axial_offset = -Math.floor(gridRows / 2);

        // Convert back from axial to offset coordinates
        const offsetCol = q_axial - q_axial_offset + (r_axial - r_axial_offset + (r_axial - r_axial_offset & 1)) / 2;
        const offsetRow = r_axial - r_axial_offset;

        // Convert back to user coordinates
        const userX = offsetCol;
        const userY = (gridRows - 1) - offsetRow;

        // Check bounds
        if (userX >= 0 && userX < gridCols && userY >= 0 && userY < gridRows) {
            return { labelX: userX, labelY: userY };
        }
    }

    return null; // Out of bounds
}

// ====================================================================
// DRAWING PATH TRANSFORMATION FUNCTIONS
// ====================================================================

/**
 * Transforms drawing paths from one hex orientation to another.
 * This is needed when switching between flat-top and pointy-top modes
 * so that geography lines appear in the correct positions.
 */
export function transformDrawingPathsForOrientation(
    paths: DrawingPath[],
    fromOrientation: HexOrientation,
    toOrientation: HexOrientation,
    tileSize: number,
    gridRows: number,
    gridCols: number
): DrawingPath[] {
    if (fromOrientation === toOrientation) {
        return paths; // No transformation needed
    }

    return paths.map(path => ({
        ...path,
        points: path.points.map(point =>
            transformPointForOrientation(
                point,
                fromOrientation,
                toOrientation,
                tileSize,
                gridRows,
                gridCols
            )
        )
    }));
}

/**
 * Transforms a single point from one hex orientation to another
 */
function transformPointForOrientation(
    point: { x: number; y: number },
    fromOrientation: HexOrientation,
    toOrientation: HexOrientation,
    tileSize: number,
    _gridRows: number,
    _gridCols: number
): { x: number; y: number } {
    if (fromOrientation === toOrientation) {
        return point;
    }

    // Step 1: Convert pixel point to axial coordinates using the source orientation
    const fromConfig = getHexOrientation(fromOrientation);
    const axial = fromConfig.pixelToAxial(point.x, point.y, tileSize);

    // Step 2: Convert axial coordinates back to pixel using the target orientation
    const toConfig = getHexOrientation(toOrientation);
    return toConfig.axialToPixel(axial.q, axial.r, tileSize);
}

/**
 * Alternative transformation that preserves relative positions within the grid bounds.
 * This method normalizes coordinates to [0,1] range and then scales to new orientation.
 */
export function transformDrawingPathsRelative(
    paths: DrawingPath[],
    fromOrientation: HexOrientation,
    toOrientation: HexOrientation,
    tileSize: number,
    gridRows: number,
    gridCols: number
): DrawingPath[] {
    if (fromOrientation === toOrientation) {
        return paths;
    }

    // Calculate the bounds for both orientations
    const fromBounds = calculateGridBounds(fromOrientation, tileSize, gridRows, gridCols);
    const toBounds = calculateGridBounds(toOrientation, tileSize, gridRows, gridCols);

    return paths.map(path => ({
        ...path,
        points: path.points.map(point => {
            // Normalize point to [0,1] range based on source bounds
            const normalizedX = (point.x - fromBounds.minX) / (fromBounds.maxX - fromBounds.minX);
            const normalizedY = (point.y - fromBounds.minY) / (fromBounds.maxY - fromBounds.minY);

            // Scale to target bounds
            const transformedX = toBounds.minX + normalizedX * (toBounds.maxX - toBounds.minX);
            const transformedY = toBounds.minY + normalizedY * (toBounds.maxY - toBounds.minY);

            return { x: transformedX, y: transformedY };
        })
    }));
}

/**
 * Calculate the pixel bounds of a hex grid for a given orientation
 */
function calculateGridBounds(
    orientation: HexOrientation,
    tileSize: number,
    gridRows: number,
    gridCols: number
): { minX: number; maxX: number; minY: number; maxY: number } {
    const config = getHexOrientation(orientation);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Sample points around the grid perimeter to find bounds
    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            // Convert user coordinates to axial then to pixel
            const axial = userToAxial(col, row, gridRows, gridCols, orientation);
            const pixel = config.axialToPixel(axial.q, axial.r, tileSize);

            minX = Math.min(minX, pixel.x);
            maxX = Math.max(maxX, pixel.x);
            minY = Math.min(minY, pixel.y);
            maxY = Math.max(maxY, pixel.y);
        }
    }

    return { minX, maxX, minY, maxY };
}
