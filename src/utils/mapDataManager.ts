// Comprehensive map data management utility
import type { HexTile, Biome } from '../types/mapTypes';
import type { TownData } from '../types/townTypes';
import type { HexOrientation } from './hexMath';

export interface GeographyLayer {
    id: string;
    type: 'path' | 'area' | 'point';
    coordinates: Array<{ x: number; y: number }>;
    style: {
        color: string;
        strokeWidth: number;
        fillColor?: string;
        opacity: number;
    };
    label?: string;
    notes?: string;
}

export interface BackgroundImageInfo {
    filename: string;
    scale: number;
    offsetX: number;
    offsetY: number;
    visible: boolean;
}

export interface TownMaterialInfo {
    name: string;
    description: string;
    color: string; // RGBA format
    type: 'ground' | 'buildingPart';
}

export interface ComprehensiveMapData {
    // Meta information
    mapKey: string;
    version: string;
    lastUpdated: string; // ISO date string
    createdDate: string; // ISO date string

    // Map configuration
    orientation: HexOrientation;

    // World map data
    worldMap: {
        name: string;
        backgroundImage?: BackgroundImageInfo;
        viewSettings?: {
            gridLinesVisible: boolean;
            gridLineThickness: number;
            gridLineColor: string;
            textScale: number;
            showTownNames: boolean;
        };
        hexes: Record<string, {
            coordinates: { q: number; r: number; s: number };
            biome: string; // Reference to biome name
            originalBiome?: string; // Reference to original biome before town designation
            notes: string;
            encounterNotes: string;
            isTown: boolean;
            townId?: string;
            townName?: string;
            townSize?: string;
        }>;
    };

    // Biome definitions
    biomes: Record<string, {
        name: string;
        description: string;
        color: string; // RGBA format
    }>;

    // Town material definitions
    townMaterials: Record<string, TownMaterialInfo>;

    // Towns data
    towns: Record<string, {
        id: string;
        name: string;
        originHexCoordinates: { q: number; r: number; s: number };
        sizeCategory: string;
        gridDimensions: { width: number; height: number };
        notes: string;
        population: number;
        races: string[];
        backgroundImage?: BackgroundImageInfo;
        grid: Record<string, {
            coordinates: { x: number; y: number };
            material: string; // Reference to material name
            buildingId?: string;
        }>;
        buildings: Record<string, {
            id: string;
            name: string;
            cellIds: string[];
            notes: string;
            art?: string;
        }>;
        stickers: Array<{
            id: string;
            name?: string;
            filename: string;
            position: { x: number; y: number };
            scale: number;
            rotation: number;
            zIndex: number;
        }>;
    }>;

    // Geography layer data
    geography: {
        layers: GeographyLayer[];
        visible: boolean;
    };
}

export class MapDataManager {
    private static currentMapData: ComprehensiveMapData | null = null;
    private static isDirty = false;
    private static lastSaveTime = 0;
    private static saveDebounceMs = 15000; // Save every 15 seconds when dirty

    /**
     * Initialize a new map or load existing data
     */
    static async initializeMap(mapKey?: string, isNewMap = false): Promise<ComprehensiveMapData> {
        if (mapKey && !isNewMap) {
            console.log(`📥 Attempting to load existing map: ${mapKey}`);
            try {
                const result = await this.loadMapData(mapKey, true); // Suppress 404 warnings for new maps
                if (result.success) {
                    this.currentMapData = result.data;
                    this.isDirty = false;
                    console.log(`✅ Successfully loaded existing map: ${mapKey}`);
                    return result.data;
                }
            } catch (error) {
                console.log(`⚠️ Failed to load map ${mapKey}, creating new map instead`);
                // Silently continue to create new map - this is expected for new keys
            }
        } else if (isNewMap) {
            console.log(`🆕 Skipping load attempt for new map: ${mapKey}`);
        }

        // Create new map data
        console.log(`📝 Creating new map data${mapKey ? ` for key: ${mapKey}` : ''}`);
        const newMapData: ComprehensiveMapData = {
            mapKey: mapKey || this.generateMapKey(),
            version: '2.0.0',
            lastUpdated: new Date().toISOString(),
            createdDate: new Date().toISOString(),
            orientation: 'flat-top',
            worldMap: {
                name: 'Unnamed World',
                hexes: {}
            },
            biomes: {},
            townMaterials: {},
            towns: {},
            geography: {
                layers: [],
                visible: true
            }
        };

        this.currentMapData = newMapData;
        this.isDirty = true;
        return newMapData;
    }

    /**
     * Get current map data
     */
    static getCurrentMapData(): ComprehensiveMapData | null {
        return this.currentMapData;
    }

    /**
     * Update map data and mark as dirty
     */
    static updateMapData(updates: Partial<ComprehensiveMapData>): void {
        if (!this.currentMapData) return;

        this.currentMapData = {
            ...this.currentMapData,
            ...updates,
            lastUpdated: new Date().toISOString()
        };

        this.markDirty();
    }

    /**
     * Mark data as needing save
     */
    static markDirty(): void {
        this.isDirty = true;
        this.scheduleSave();
    }

    /**
     * Schedule automatic save
     */
    private static scheduleSave(): void {
        const now = performance.now();
        if (now - this.lastSaveTime < this.saveDebounceMs) {
            return; // Too soon to save again
        }

        setTimeout(() => {
            if (this.isDirty && this.currentMapData) {
                this.saveMapData(this.currentMapData.mapKey);
            }
        }, this.saveDebounceMs);
    }

    /**
     * Force immediate save
     */
    static async forceSave(): Promise<boolean> {
        if (!this.currentMapData || !this.isDirty) return true;

        try {
            const result = await this.saveMapData(this.currentMapData.mapKey);
            return result.success;
        } catch (error) {
            console.error('Failed to force save map data:', error);
            return false;
        }
    }

    /**
     * Save map data to server
     */
    private static async saveMapData(mapKey: string): Promise<{ success: boolean; message: string }> {
        if (!this.currentMapData) {
            return { success: false, message: 'No map data to save' };
        }

        try {
            const formData = new FormData();
            formData.append('mapKey', mapKey);
            formData.append('mapData', JSON.stringify(this.currentMapData));

            const response = await fetch('/api/map/save', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                this.isDirty = false;
                this.lastSaveTime = performance.now();
                const result = await response.json();
                console.log('✅ Map data saved:', result);
                return { success: true, message: 'Map saved successfully' };
            } else {
                const error = await response.json();
                return { success: false, message: error.message || 'Save failed' };
            }
        } catch (error) {
            console.error('Save map data failed:', error);
            return { success: false, message: 'Network error during save' };
        }
    }

    /**
     * Load map data from server
     */
    static async loadMapData(mapKey: string, suppressNotFoundWarning = false): Promise<{ success: boolean; data: ComprehensiveMapData; message?: string }> {
        try {
            const response = await fetch(`/api/map/load/${mapKey}`);

            if (response.ok) {
                const result = await response.json();
                console.log('📖 Map data loaded:', result);

                this.currentMapData = result.mapData;
                this.isDirty = false;

                return {
                    success: true,
                    data: result.mapData,
                    message: 'Map loaded successfully'
                };
            } else {
                const error = await response.json();
                return {
                    success: false,
                    data: {} as ComprehensiveMapData,
                    message: error.message || 'Map not found'
                };
            }
        } catch (error) {
            if (!suppressNotFoundWarning) {
                console.error('Load map data failed:', error);
            }
            return {
                success: false,
                data: {} as ComprehensiveMapData,
                message: 'Network error during load'
            };
        }
    }

    /**
     * Check if a map exists without loading the full data
     */
    static async checkMapExists(mapKey: string): Promise<boolean> {
        try {
            const response = await fetch(`/api/map/check/${mapKey}`);
            const result = await response.json();
            return result.exists;
        } catch (error) {
            console.error('Error checking map existence:', error);
            return false;
        }
    }

    /**
     * List all available maps
     */
    static async listAvailableMaps(): Promise<{ success: boolean; maps: any[]; message?: string }> {
        try {
            const response = await fetch('/api/map/list');

            if (response.ok) {
                const result = await response.json();
                return {
                    success: true,
                    maps: result.maps
                };
            } else {
                return {
                    success: false,
                    maps: [],
                    message: 'Failed to load map list'
                };
            }
        } catch (error) {
            console.error('List maps failed:', error);
            return {
                success: false,
                maps: [],
                message: 'Network error'
            };
        }
    }

    /**
     * Generate a unique map key
     */
    private static generateMapKey(): string {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Convert current app state to comprehensive map data
     */
    static convertAppStateToMapData(
        hexGrid: Map<string, HexTile>,
        towns: Map<string, TownData>,
        biomes: Biome[],
        townMaterials: any[],
        worldMapName: string,
        orientation: HexOrientation,
        backgroundImageInfo?: BackgroundImageInfo
    ): ComprehensiveMapData {
        // Convert hexes
        const hexesData: Record<string, any> = {};
        hexGrid.forEach((hex, hexId) => {
            hexesData[hexId] = {
                coordinates: hex.coordinates,
                biome: hex.biome.name,
                originalBiome: hex.originalBiome?.name,
                notes: hex.notes || '',
                encounterNotes: hex.encounterNotes || '',
                isTown: hex.isTown,
                townId: hex.townId,
                townName: hex.townName,
                townSize: hex.townSize
            };
        });

        // Convert biomes
        const biomesData: Record<string, any> = {};
        biomes.forEach(biome => {
            biomesData[biome.name] = {
                name: biome.name,
                description: biome.description || '',
                color: biome.color
            };
        });

        // Convert town materials
        const townMaterialsData: Record<string, TownMaterialInfo> = {};
        townMaterials.forEach(material => {
            townMaterialsData[material.name] = {
                name: material.name,
                description: material.name, // Could be enhanced
                color: material.color,
                type: material.type
            };
        });

        // Convert towns
        const townsData: Record<string, any> = {};
        towns.forEach((town, townId) => {
            townsData[townId] = {
                id: town.id,
                name: town.name,
                originHexCoordinates: town.originHexCoordinates,
                sizeCategory: town.sizeCategory,
                gridDimensions: town.gridDimensions,
                notes: town.notes,
                population: town.population,
                races: town.races,
                grid: town.grid,
                buildings: town.buildings,
                stickers: [] // Will be populated separately
            };
        });

        return {
            mapKey: this.currentMapData?.mapKey || this.generateMapKey(),
            version: '2.0.0',
            lastUpdated: new Date().toISOString(),
            createdDate: this.currentMapData?.createdDate || new Date().toISOString(),
            orientation,
            worldMap: {
                name: worldMapName,
                backgroundImage: backgroundImageInfo,
                hexes: hexesData
            },
            biomes: biomesData,
            townMaterials: townMaterialsData,
            towns: townsData,
            geography: {
                layers: [],
                visible: true
            }
        };
    }

    /**
     * Update just the orientation and save immediately (quick update)
     */
    static async updateOrientation(mapKey: string, orientation: HexOrientation): Promise<boolean> {
        try {
            console.log(`[MapDataManager] Updating orientation to ${orientation} for map ${mapKey}`);

            // Load current map data from file
            const result = await this.loadMapData(mapKey);
            if (!result.success || !result.data) {
                console.error(`[MapDataManager] Failed to load map data for orientation update: ${mapKey}`);
                return false;
            }

            // Update the orientation and timestamp
            result.data.orientation = orientation;
            result.data.lastUpdated = new Date().toISOString();

            // Set as current map data temporarily for saving
            const previousMapData = this.currentMapData;
            this.currentMapData = result.data;

            // Save immediately
            const saveResult = await this.saveMapData(mapKey);

            // Restore previous map data if it was different
            if (previousMapData && previousMapData.mapKey !== mapKey) {
                this.currentMapData = previousMapData;
            }

            if (saveResult.success) {
                console.log(`[MapDataManager] ✅ Orientation updated and saved for map ${mapKey}`);
                return true;
            } else {
                console.error(`[MapDataManager] Failed to save orientation update: ${saveResult.message}`);
                return false;
            }
        } catch (error) {
            console.error(`[MapDataManager] Error updating orientation:`, error);
            return false;
        }
    }
}
