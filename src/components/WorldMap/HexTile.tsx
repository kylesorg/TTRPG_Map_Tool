import React from 'react';
import type { HexTile as HexTileData } from '../../types/mapTypes';
import { TILE_SIZE, TOWN_COLOR, SIMPLIFIED_HEX_ZOOM_THRESHOLD } from '../../utils/constants';
import { axialToPixelOriented, getHexOrientation, type HexOrientation } from '../../utils/hexMath';

interface HexTileProps {
    tile: HexTileData;
    onClick: (tile: HexTileData, event: React.MouseEvent) => void;
    onMouseDown?: (tile: HexTileData, event: React.MouseEvent) => void;
    onMouseEnter?: (tile: HexTileData, event: React.MouseEvent) => void;
    currentZoomLevel: number; // Added prop
    hexOrientation?: HexOrientation; // NEW: Hex orientation prop (optional for backwards compatibility)
}

const HexTile: React.FC<HexTileProps> = ({ tile, onClick, onMouseDown, onMouseEnter, currentZoomLevel, hexOrientation = 'flat-top' }) => {
    const { q, r } = tile.coordinates;

    // Use orientation-aware coordinate conversion (NEW - backwards compatible)
    const { x, y } = axialToPixelOriented(q, r, TILE_SIZE, hexOrientation);
    const orientationConfig = getHexOrientation(hexOrientation);

    const handleClick = (event: React.MouseEvent) => {
        onClick(tile, event);
    };

    const handleMouseDown = (event: React.MouseEvent) => {
        if (onMouseDown) {
            onMouseDown(tile, event);
        }
    };

    const handleMouseEnter = (event: React.MouseEvent) => {
        if (onMouseEnter) {
            onMouseEnter(tile, event);
        }
    };

    const fillColor = tile.isTown ? TOWN_COLOR : tile.biome.color;

    // Level of Detail (LOD) Logic
    if (currentZoomLevel < SIMPLIFIED_HEX_ZOOM_THRESHOLD) {
        // Render a simplified version (e.g., a small rectangle)
        const simplifiedSize = TILE_SIZE * 0.5; // Adjust as needed
        return (
            <rect
                x={x - simplifiedSize / 2}
                y={y - simplifiedSize / 2}
                width={simplifiedSize}
                height={simplifiedSize}
                fill={fillColor}
                onClick={handleClick} // Keep basic interaction if desired
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
                style={{ cursor: 'pointer' }}
            />
        );
    }

    // Full detail rendering (orientation-aware polygon)
    const points = Array.from({ length: 6 }, (_, i) => {
        const angle_deg = 60 * i + orientationConfig.polygonAngleOffset; // Use orientation-specific angle offset
        const angle_rad = (Math.PI / 180) * angle_deg;
        return `${x + TILE_SIZE * Math.cos(angle_rad)},${y + TILE_SIZE * Math.sin(angle_rad)}`;
    }).join(' ');

    return (
        <g
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
            style={{ cursor: 'pointer' }}
        >
            <polygon points={points} fill={fillColor} stroke="#555" strokeWidth="1" />
            {/* Display user-facing labels if available, otherwise axial q,r for debugging */}
            {currentZoomLevel > 0.5 && ( // Only show labels if zoomed in enough
                <text x={x} y={y + TILE_SIZE * 0.1} textAnchor="middle" fontSize={TILE_SIZE * 0.25} fill="#111">
                    {`${tile.labelX !== undefined ? tile.labelX : 'q' + tile.coordinates.q},${tile.labelY !== undefined ? tile.labelY : 'r' + tile.coordinates.r}`}
                </text>
            )}
        </g>
    );
};

export default React.memo(HexTile);
