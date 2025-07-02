import type { HexCoordinates } from './mapTypes';

export type TownSizeCategory = 'Small' | 'Medium' | 'Large';

export interface TownGridDimensions {
    width: number;  // in cells
    height: number; // in cells
}

export const TOWN_SIZE_DETAILS: ReadonlyMap<TownSizeCategory, TownGridDimensions> = new Map([
    ['Small', { width: 220, height: 124 }],
    ['Medium', { width: 330, height: 186 }],
    ['Large', { width: 440, height: 248 }],
]);

export interface TownCellCoordinates {
    x: number; // cell index from left, equivalent to col
    y: number; // cell index from top, equivalent to row
}

export interface Building {
    id: string;
    name: string;
    occupiesCells: TownCellCoordinates[];
    notes: string;
    art?: string;
}

export interface TownCell {
    id: string; // unique identifier, perhaps `${x},${y}`
    coordinates: TownCellCoordinates;
    material: string; // e.g., 'grass', 'stone_building'. The primary paintable property.
    buildingId?: string;
}

export interface TownData {
    id: string;
    name: string;
    originHexCoordinates: HexCoordinates;
    sizeCategory: TownSizeCategory; // Added
    gridDimensions: TownGridDimensions; // Added
    icon?: string;
    notes: string;
    population: number;
    races: string[];
    grid: Record<string, TownCell>; // Key will be `${x},${y}`
    buildings: Record<string, Building>;
}

export interface SelectedTownCell {
    townId: string;
    x: number; // Renamed from col to x
    y: number; // Renamed from row to y
}

export interface TownSticker {
    id: string;
    imageUrl: string;
    position: { x: number; y: number };
    scale: number;
    rotation: number;
    zIndex: number;
}
