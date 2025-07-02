import type { TownSizeCategory } from './townTypes';
export type { ToolMode } from './sharedTypes';

export interface HexCoordinates {
    q: number;
    r: number;
    s: number;
}

export interface Biome {
    name: string;
    color: string;
    description?: string; // Added description
    image?: string; // This can be removed if not used
}

export type BiomeName =
    | 'Beach'
    | 'Desert'
    | 'Forest'
    | 'Grassland'
    | 'Highlands'
    | 'Lake'
    | 'Ocean'
    | 'Polar Tundra'
    | 'Swamp'
    | 'Town'
    | 'Tropical'
    | 'Void/Cosmic'
    | 'Volcanic';

export interface Encounter {
    id: string;
    name: string;
    description: string;
    properties?: Record<string, any>;
}

export interface DrawingPathPoint {
    x: number;
    y: number;
}

export type DrawingType = 'road' | 'river' | 'landmark';

export interface DrawingPath {
    id: string;
    type: DrawingType;
    points: { x: number; y: number }[];
    color?: string;
    strokeWidth?: number;
}

export interface DrawingSettings {
    type: DrawingType;
    color: string;
    strokeWidth: number;
}

export interface HexTile {
    id: string; // Unique identifier, perhaps `${q},${r}` or user label `${labelX},${labelY}`
    coordinates: HexCoordinates; // Axial (q, r, s)
    biome: Biome; // Biome is now an object and NOT optional
    originalBiome?: Biome; // Added to store biome before town designation
    encounters: Encounter[];
    notes: string;
    isTown: boolean;
    townId?: string;
    townName?: string; // Added for town label
    townSize?: TownSizeCategory; // Added: To store selected town size directly on hex for convenience
    encounterNotes?: string; // Added for encounter notes
    labelX?: number; // User-facing X label (e.g., row from bottom, 0-indexed)
    labelY?: number; // User-facing Y label (e.g., col from left, 0-indexed)
}

export interface WorldMapData {
    id: string;
    name: string;
    hexes: Record<string, HexTile>; // Using a Record for easier lookup by hex ID
    drawingLayer: DrawingPath[];
    // metadata like creationDate, lastModified, etc.
}

export interface TownMaterial {
    name: string;
    style: string; // This will be used as the key for cell appearance
    color: string; // UI color for the selector button
    type: 'ground' | 'buildingPart';
}
