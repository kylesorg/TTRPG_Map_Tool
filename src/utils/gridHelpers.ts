import type { HexTile as HexTileData } from '../types/mapTypes';
import { UNASSIGNED_BIOME } from './constants';
import type { HexOrientation } from './hexMath';

// Generates a rectangular grid of hexagons.
// User-defined (X,Y) coordinates: (0,0) is bottom-left.
// X increases to the right, Y increases upwards.
export function generateTestHexGrid(
    gridRows: number,
    gridCols: number,
    orientation: HexOrientation = 'flat-top'
): HexTileData[] {
    if (orientation === 'flat-top') {
        return generateFlatTopGrid(gridRows, gridCols);
    } else {
        return generatePointyTopGrid(gridRows, gridCols);
    }
}

// Generates a flat-top hex grid (original logic)
function generateFlatTopGrid(gridRows: number, gridCols: number): HexTileData[] {
    const hexes: HexTileData[] = [];
    // userX: 0 at bottom, increases upwards to gridRows-1 (this is the vertical loop)
    // userY: 0 at left, increases to the right to gridCols-1 (this is the horizontal loop)

    // Calculate the r-offset to make userX=0,userY=0 map to q_axial=0, r_axial=0
    const r_axial_offset = -(gridRows - 1);

    for (let userX = 0; userX < gridRows; userX++) {
        for (let userY = 0; userY < gridCols; userY++) {
            // Convert user (X,Y) to visual offset coordinates (vCol, vRow_from_top)
            // vCol is equivalent to q in an even-q offset system
            // vRow_from_top is equivalent to r in an even-q offset system (before axial conversion)
            const vCol = userY;
            const vRow_from_top = (gridRows - 1) - userX;

            // Convert visual even-q (vCol, vRow_from_top) to an intermediate axial (q', r')
            // q_axial = q_offset
            // r_axial = r_offset - (q_offset + (q_offset & 1)) / 2
            const q_prime = vCol;
            const r_prime = vRow_from_top - (vCol + (vCol & 1)) / 2;

            // Apply the r-offset to align the grid's origin
            const q_axial = q_prime;
            const r_axial = r_prime + r_axial_offset;

            const currentCoordinates = {
                q: q_axial,
                r: r_axial,
                s: -q_axial - r_axial,
            };

            hexes.push({
                id: `${q_axial},${r_axial}`,
                coordinates: currentCoordinates,
                biome: UNASSIGNED_BIOME,
                isTown: false,
                notes: '',
                encounters: [],
                labelX: userY,  // userY is horizontal (left-right) so it should be X
                labelY: userX,  // userX is vertical (up-down) so it should be Y
            });
        }
    }
    return hexes;
}

// Generates a pointy-top hex grid using even-r offset coordinates for rectangular layout
function generatePointyTopGrid(gridRows: number, gridCols: number): HexTileData[] {
    const hexes: HexTileData[] = [];

    // For pointy-top hexes in a rectangular grid, we use even-r offset coordinates
    // userX: 0 at left, increases to the right (columns)
    // userY: 0 at bottom, increases upwards (rows)

    // Calculate offset to center the grid around origin
    const q_axial_offset = -Math.floor(gridCols / 2);
    const r_axial_offset = -Math.floor(gridRows / 2);

    for (let userY = 0; userY < gridRows; userY++) {
        for (let userX = 0; userX < gridCols; userX++) {
            // Convert user coordinates to even-r offset coordinates
            // Flip Y so that userY=0 is at bottom (visual bottom = gridRows-1-userY)
            const offsetCol = userX;
            const offsetRow = (gridRows - 1) - userY;  // Flip Y axis

            // Convert even-r offset to axial coordinates
            // q_axial = q_offset - (r_offset + (r_offset & 1)) / 2
            // r_axial = r_offset
            const q_axial = offsetCol - (offsetRow + (offsetRow & 1)) / 2 + q_axial_offset;
            const r_axial = offsetRow + r_axial_offset;
            const s_axial = -q_axial - r_axial;

            const currentCoordinates = {
                q: q_axial,
                r: r_axial,
                s: s_axial,
            };

            hexes.push({
                id: `${q_axial},${r_axial}`,
                coordinates: currentCoordinates,
                biome: UNASSIGNED_BIOME,
                isTown: false,
                notes: '',
                encounters: [],
                labelX: userX,  // userX is horizontal (left-right)
                labelY: userY,  // userY is vertical (bottom-top)
            });
        }
    }
    return hexes;
}

// Calculates the axial ID of the hex at the user-perceived center of the grid.
export function getInitialCenterHexId(
    gridRows: number,
    gridCols: number,
    orientation: HexOrientation = 'flat-top'
): string {
    // Determine user-perceived center
    const userX_center = Math.floor(gridCols / 2);
    const userY_center = Math.floor(gridRows / 2);

    if (orientation === 'flat-top') {
        // Convert user-perceived center to the axial ID (flat-top logic)
        const r_axial_offset = -(gridRows - 1);
        const vCol_center = userX_center;  // Fixed: userX maps to horizontal (was userY_center)
        const vRow_from_top_center = (gridRows - 1) - userY_center;  // Fixed: userY maps to vertical (was userX_center)
        const q_prime_center = vCol_center;
        const r_prime_center = vRow_from_top_center - ((vCol_center + (vCol_center & 1)) / 2);
        const q_axial_center = q_prime_center;
        const r_axial_center = r_prime_center + r_axial_offset;

        return `${q_axial_center},${r_axial_center}`;
    } else {
        // For pointy-top, use the same logic as generatePointyTopGrid
        const q_axial_offset = -Math.floor(gridCols / 2);
        const r_axial_offset = -Math.floor(gridRows / 2);

        const offsetCol = userX_center;
        const offsetRow = (gridRows - 1) - userY_center;  // Flip Y axis to match generatePointyTopGrid

        const q_axial_center = offsetCol - (offsetRow + (offsetRow & 1)) / 2 + q_axial_offset;
        const r_axial_center = offsetRow + r_axial_offset;

        return `${q_axial_center},${r_axial_center}`;
    }
}
