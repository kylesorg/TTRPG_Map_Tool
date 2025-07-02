import type { Biome } from '../types/mapTypes';

export const TILE_SIZE = 12; // Reduced from 50
export const TOWN_COLOR = "#FFD700"; // Gold color for towns, for example

export const UNASSIGNED_BIOME: Biome = { name: "Unassigned", color: "transparent", description: "An unassigned area." };

// ALL_BIOMES_ARRAY will be populated dynamically after fetching biomes.json
// For now, it can be initialized with UNASSIGNED_BIOME or be an empty array
// depending on how you plan to handle the async loading.
export let ALL_BIOMES_ARRAY: Biome[] = [UNASSIGNED_BIOME];

// Function to update ALL_BIOMES_ARRAY after loading from JSON
export const setAllBiomes = (loadedBiomes: Biome[]) => {
    ALL_BIOMES_ARRAY = [UNASSIGNED_BIOME, ...loadedBiomes];
};

// Grid dimensions
export const GRID_ROWS = 335; // WAS 500
export const GRID_COLS = 596; // WAS 500
export const HEX_BUFFER = 2; // Number of hexes to render outside the viewport
export const SIMPLIFIED_HEX_ZOOM_THRESHOLD = 0.3; // Zoom level below which simplified hexes are rendered (WAS 0.1)
export const VIEW_MARGIN_HEXES = 6; // Number of hexes for margin when calculating min zoom to see whole map
export const MAX_ZOOM_LEVEL = 5; // Maximum zoom in level

// Initial visible area constants
export const INITIAL_VISIBLE_ROWS = 20;
export const INITIAL_VISIBLE_COLS = 20;

// Constants for pre-rendered image tiles
export const INTERACTIVE_ZOOM_THRESHOLD = 0.1; // Zoom level to switch to image tiles
export const PRE_RENDERED_ZOOM_LEVELS = [0.05, 0.025]; // Zoom levels for pre-rendered tiles
export const TILE_HEX_DIMENSIONS_WIDTH = 50; // Width of a tile in hexes
export const TILE_HEX_DIMENSIONS_HEIGHT = 50; // Height of a tile in hexes
