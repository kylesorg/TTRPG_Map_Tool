import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './App.css';

import HexGridWebGL from './components/WorldMap/HexGridWebGL';
import HexDetailPanel from './components/WorldMap/HexDetailPanel';
import WorldMapTools from './components/WorldMap/WorldMapTools';
import type { HexTile, Biome, ToolMode, TownMaterial, DrawingPath, DrawingType } from './types/mapTypes';
import type { TownData, TownSizeCategory, TownCellCoordinates, TownCell, SelectedTownCell, TownSticker } from './types/townTypes';
import { TOWN_SIZE_DETAILS } from './types/townTypes';
import TownGridWebGLV2 from './components/TownView/TownGridWebGLV2';
import TownCellDetailPanel from './components/TownView/TownCellDetailPanel';
import TownMaterialSelector from './components/TownView/TownMaterialSelector';
import TownImageTools from './components/TownView/TownImageTools';
import { generateTestHexGrid, getInitialCenterHexId } from './utils/gridHelpers';
import { GRID_ROWS, GRID_COLS, UNASSIGNED_BIOME, setAllBiomes as setGlobalBiomes } from './utils/constants';
import { userToAxial, type HexOrientation } from './utils/hexMath';
import { MapDataManager, type ComprehensiveMapData } from './utils/mapDataManager';
import { generateUniqueMapKey, isDefaultKey } from './utils/mapKeyGenerator';

function App() {
  const [hexGrid, setHexGrid] = useState<Map<string, HexTile>>(() => new Map());
  const [hexGridVersion, setHexGridVersion] = useState(0); // Force re-renders
  const [selectedHex, setSelectedHex] = useState<HexTile | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolMode>('select');
  const [currentTownTool, setCurrentTownTool] = useState<'select' | 'paint' | 'sticker'>('select');
  const [currentSelectedBiome, setCurrentSelectedBiome] = useState<Biome>(UNASSIGNED_BIOME);
  const [currentSelectedTownMaterial, setCurrentSelectedTownMaterial] = useState<TownMaterial | null>(null);
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(true);
  const [isTownToolsPanelOpen] = useState(true); // Removed setter
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'worldEdit' | 'view' | 'importExport'>('worldEdit');
  const [biomesLoaded, setBiomesLoaded] = useState(false);
  const [availableBiomes, setAvailableBiomes] = useState<Biome[]>([UNASSIGNED_BIOME]);
  const defaultHexInitiallySetRef = useRef(false);
  const currentSelectedBiomeRef = useRef<Biome>(UNASSIGNED_BIOME);
  const [drawingLayer, setDrawingLayer] = useState<DrawingPath[]>([]);

  const [viewSettings, setViewSettings] = useState({
    showTownNames: true,
  });

  const [currentZoomLevel, setCurrentZoomLevel] = useState(1);
  const [renderedHexesCount, setRenderedHexesCount] = useState(0);

  const [gotoX, setGotoX] = useState<string>('');
  const [gotoY, setGotoY] = useState<string>('');
  const [centerOnHexId, setCenterOnHexId] = useState<string | null>(null);
  const [isInitialCenteringPending, setIsInitialCenteringPending] = useState(false);

  // Hex orientation state (NEW - additive only, defaults to current behavior)
  const [hexOrientation, setHexOrientation] = useState<HexOrientation>('flat-top');

  // Map data management
  const [currentMapKey, setCurrentMapKey] = useState<string>('default_map');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true); // Track if we're in initial app load
  const [hasUserMadeEdits, setHasUserMadeEdits] = useState<boolean>(false); // Track if user has made actual edits
  const mapDataManagerRef = useRef<MapDataManager | null>(null);

  // Initialize map data manager
  useEffect(() => {
    if (!mapDataManagerRef.current) {
      mapDataManagerRef.current = new MapDataManager();
    }
  }, []);

  // Geography tool state
  const [brushSize, setBrushSize] = useState(3.125); // Default to medium brush size
  const [brushColor, setBrushColor] = useState('#000000'); // Default to black
  const [isErasing, setIsErasing] = useState(false);

  // New layer visibility and opacity state
  const [gridLinesVisible, setGridLinesVisible] = useState(true);
  const [gridLineThickness, setGridLineThickness] = useState(1); // Add grid line thickness
  const [gridLineColor, setGridLineColor] = useState('rgba(102, 102, 102, 1)'); // Add grid line color (gray by default)
  const [textScale, setTextScale] = useState(1); // Add text scale for town names
  const [geographyVisible, setGeographyVisible] = useState(true);

  // Background image state
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundImageScale, setBackgroundImageScale] = useState(1);
  const [backgroundImageOffsetX, setBackgroundImageOffsetX] = useState(0);
  const [backgroundImageOffsetY, setBackgroundImageOffsetY] = useState(0);
  const [backgroundImageVisible, setBackgroundImageVisible] = useState(true);

  // Town background image and sticker state
  const [townBackgroundImageUrl, setTownBackgroundImageUrl] = useState<string | null>(null);
  const [townBackgroundImageScale, setTownBackgroundImageScale] = useState(1);
  const [townBackgroundImageOffsetX, setTownBackgroundImageOffsetX] = useState(0);
  const [townBackgroundImageOffsetY, setTownBackgroundImageOffsetY] = useState(0);
  const [townBackgroundImageVisible, setTownBackgroundImageVisible] = useState(true);
  const [townStickers, setTownStickers] = useState<TownSticker[]>([]);
  const [selectedTownSticker, setSelectedTownSticker] = useState<TownSticker | null>(null);
  const [townStickersVisible, setTownStickersVisible] = useState(true);

  // Town related state
  const [towns, setTowns] = useState<Map<string, TownData>>(new Map());
  const [currentView, setCurrentView] = useState<'world' | 'town'>('world');
  const [activeTownId, setActiveTownId] = useState<string | null>(null);
  const [selectedTownCell, setSelectedTownCell] = useState<SelectedTownCell | null>(null);
  const [townCopied, setTownCopied] = useState(false);

  const [townViewDisplay, setTownViewDisplay] = useState({ zoom: 1, visibleCells: 0 });

  // Town materials state
  const DEFAULT_TOWN_MATERIALS: TownMaterial[] = [
    { name: 'Default', style: 'default', color: 'rgba(255, 255, 255, 0)', type: 'ground' }, // Fully transparent
    { name: 'Grass', style: 'grass', color: '#90EE90', type: 'ground' },
    { name: 'Road', style: 'road', color: '#8B4513', type: 'ground' },
    { name: 'Path', style: 'path', color: '#D2B48C', type: 'ground' },
    { name: 'Stone', style: 'stone', color: '#696969', type: 'ground' },
    { name: 'Wood', style: 'wood', color: '#DEB887', type: 'ground' },
    { name: 'Dirt', style: 'dirt', color: '#8B4513', type: 'ground' },
  ];
  const [availableTownMaterials, setAvailableTownMaterials] = useState<TownMaterial[]>(DEFAULT_TOWN_MATERIALS);

  const handleBiomeColorChange = useCallback((biomeName: string, newColor: string) => {
    const newAvailableBiomes = availableBiomes.map(b =>
      b.name === biomeName ? { ...b, color: newColor } : b
    ).sort((a, b) => a.name.localeCompare(b.name));
    setAvailableBiomes(newAvailableBiomes);

    const updatedBiomeObject = newAvailableBiomes.find(b => b.name === biomeName);
    if (!updatedBiomeObject) return;

    if (currentSelectedBiome?.name === biomeName) {
      setCurrentSelectedBiome(updatedBiomeObject);
    }

    setHexGrid(prevGrid => {
      const newGrid = new Map(prevGrid);
      let selectedHexNeedsUpdate = false;

      newGrid.forEach((hex, id) => {
        let updatedHex = { ...hex };
        let changed = false;

        if (hex.biome.name === biomeName) {
          updatedHex.biome = updatedBiomeObject;
          changed = true;
        }
        if (hex.isTown && hex.originalBiome?.name === biomeName) {
          updatedHex.originalBiome = updatedBiomeObject;
          changed = true;
        }

        if (changed) {
          newGrid.set(id, updatedHex);
          if (selectedHex?.id === id) {
            selectedHexNeedsUpdate = true;
          }
        }
      });

      if (selectedHexNeedsUpdate) {
        const newSelectedHex = newGrid.get(selectedHex!.id);
        if (newSelectedHex) {
          setSelectedHex(newSelectedHex);
        }
      }

      return newGrid;
    });
  }, [availableBiomes, currentSelectedBiome, selectedHex]);

  const handleTownMaterialColorChange = useCallback((materialName: string, newColor: string) => {
    const newAvailableMaterials = availableTownMaterials.map(m =>
      m.name === materialName ? { ...m, color: newColor } : m
    );
    setAvailableTownMaterials(newAvailableMaterials);

    const updatedMaterial = newAvailableMaterials.find(m => m.name === materialName);
    if (!updatedMaterial) return;

    if (currentSelectedTownMaterial?.name === materialName) {
      setCurrentSelectedTownMaterial(updatedMaterial);
    }
  }, [availableTownMaterials, currentSelectedTownMaterial]);

  const handleBiomeAdd = useCallback((biomeName: string, color: string) => {
    const newBiome: Biome = { name: biomeName, color };
    setAvailableBiomes(prev => [...prev, newBiome].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const handleBiomeRename = useCallback((oldName: string, newName: string) => {
    // Update available biomes
    const newAvailableBiomes = availableBiomes.map(b =>
      b.name === oldName ? { ...b, name: newName } : b
    ).sort((a, b) => a.name.localeCompare(b.name));
    setAvailableBiomes(newAvailableBiomes);

    // Update current selected biome if it matches
    if (currentSelectedBiome?.name === oldName) {
      setCurrentSelectedBiome({ ...currentSelectedBiome, name: newName });
    }

    // Update all hexes with this biome
    setHexGrid(prevGrid => {
      const newGrid = new Map(prevGrid);
      let selectedHexNeedsUpdate = false;

      newGrid.forEach((hex, id) => {
        let updatedHex = { ...hex };
        let changed = false;

        if (hex.biome.name === oldName) {
          updatedHex.biome = { ...hex.biome, name: newName };
          changed = true;
        }
        if (hex.isTown && hex.originalBiome?.name === oldName) {
          updatedHex.originalBiome = { ...hex.originalBiome, name: newName };
          changed = true;
        }

        if (changed) {
          newGrid.set(id, updatedHex);
          if (selectedHex?.id === id) {
            selectedHexNeedsUpdate = true;
          }
        }
      });

      if (selectedHexNeedsUpdate) {
        const newSelectedHex = newGrid.get(selectedHex!.id);
        if (newSelectedHex) {
          setSelectedHex(newSelectedHex);
        }
      }

      return newGrid;
    });
  }, [availableBiomes, currentSelectedBiome, selectedHex]);

  const handleBiomeDelete = useCallback((biomeName: string) => {
    // Can't delete "Unassigned" biome
    if (biomeName === 'Unassigned') return;

    // Remove from available biomes
    setAvailableBiomes(prev => prev.filter(b => b.name !== biomeName));

    // Find unassigned biome
    const unassignedBiome = availableBiomes.find(b => b.name === 'Unassigned');
    if (!unassignedBiome) return;

    // If deleting the currently selected biome, switch to unassigned
    if (currentSelectedBiome?.name === biomeName) {
      setCurrentSelectedBiome(unassignedBiome);
    }

    // Update all hexes with this biome to "Unassigned"
    setHexGrid(prevGrid => {
      const newGrid = new Map(prevGrid);
      let selectedHexNeedsUpdate = false;

      newGrid.forEach((hex, id) => {
        let updatedHex = { ...hex };
        let changed = false;

        if (hex.biome.name === biomeName) {
          updatedHex.biome = unassignedBiome;
          changed = true;
        }
        if (hex.isTown && hex.originalBiome?.name === biomeName) {
          updatedHex.originalBiome = unassignedBiome;
          changed = true;
        }

        if (changed) {
          newGrid.set(id, updatedHex);
          if (selectedHex?.id === id) {
            selectedHexNeedsUpdate = true;
          }
        }
      });

      if (selectedHexNeedsUpdate) {
        const newSelectedHex = newGrid.get(selectedHex!.id);
        if (newSelectedHex) {
          setSelectedHex(newSelectedHex);
        }
      }

      return newGrid;
    });
  }, [availableBiomes, currentSelectedBiome, selectedHex]);

  const handleViewSettingChange = (setting: keyof typeof viewSettings, value: boolean) => {
    setViewSettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleNewPath = useCallback((newPath: DrawingPath) => {
    console.log('App.tsx: handleNewPath called with:', newPath);
    setDrawingLayer(prev => {
      const newLayer = [...prev, newPath];
      console.log('App.tsx: Updated drawingLayer state:', newLayer);
      return newLayer;
    });
  }, []);

  const handleErasePaths = useCallback((erasePoint: { x: number; y: number }, eraseRadius: number) => {
    setDrawingLayer(prev => {
      const updatedPaths: DrawingPath[] = [];
      let pathsModified = 0;

      prev.forEach(path => {
        const newSegments: DrawingPath[] = [];
        let currentSegment: { x: number; y: number }[] = [];

        for (let i = 0; i < path.points.length; i++) {
          const point = path.points[i];
          const distance = Math.sqrt(
            Math.pow(point.x - erasePoint.x, 2) +
            Math.pow(point.y - erasePoint.y, 2)
          );

          if (distance > eraseRadius) {
            // Point is outside erase radius, keep it
            currentSegment.push(point);
          } else {
            // Point is within erase radius, end current segment
            if (currentSegment.length > 1) {
              newSegments.push({
                id: `${path.id}_seg_${newSegments.length}`,
                type: path.type,
                points: [...currentSegment],
                color: path.color,
                strokeWidth: path.strokeWidth
              });
            }
            currentSegment = [];
            pathsModified++;
          }
        }

        // Add final segment if it has points
        if (currentSegment.length > 1) {
          newSegments.push({
            id: `${path.id}_seg_${newSegments.length}`,
            type: path.type,
            points: [...currentSegment],
            color: path.color,
            strokeWidth: path.strokeWidth
          });
        }

        // Add all valid segments
        updatedPaths.push(...newSegments);
      });

      if (pathsModified > 0) {
        console.log('App.tsx: Erased', pathsModified, 'path segments');
      }

      return updatedPaths;
    });
  }, []);

  const handleToolChange = useCallback((tool: ToolMode) => {
    setCurrentTool(tool);
  }, []);

  const handleSelectTownCell = useCallback((cell: SelectedTownCell | null) => {
    setSelectedTownCell(cell);
  }, []);

  const handleUpdateTownCellBatch = useCallback((batch: { x: number; y: number; material: string }[]) => {
    if (!activeTownId) return;

    setTowns(prevTowns => {
      const newTownsMap = new Map(prevTowns);
      const town = newTownsMap.get(activeTownId);
      if (town) {
        const updatedGrid = { ...town.grid };
        batch.forEach(update => {
          const cellKey = `${update.x},${update.y}`;
          const existingCell = updatedGrid[cellKey];
          if (existingCell) {
            const updatedCell: TownCell = {
              ...existingCell,
              material: update.material,
            };
            updatedGrid[cellKey] = updatedCell;
          }
        });
        newTownsMap.set(activeTownId, { ...town, grid: updatedGrid });
      }
      return newTownsMap;
    });
  }, [activeTownId]);

  const handleUpdateTownCellMaterial = useCallback((coords: TownCellCoordinates, newMaterialStyle: string) => {
    if (!activeTownId) return;

    setTowns(prevTowns => {
      const newTownsMap = new Map(prevTowns);
      const currentTown = newTownsMap.get(activeTownId!);
      if (currentTown) {
        const cellKey = `${coords.x},${coords.y}`;
        const existingCell = currentTown.grid[cellKey];
        if (existingCell) {
          const updatedCell: TownCell = {
            ...existingCell,
            material: newMaterialStyle,
          };
          const updatedGrid = { ...currentTown.grid, [cellKey]: updatedCell };
          newTownsMap.set(activeTownId!, { ...currentTown, grid: updatedGrid });
        }
      }
      return newTownsMap;
    });
  }, [activeTownId]);

  // Town sticker handlers
  const handleStickerAdd = useCallback((sticker: TownSticker) => {
    setTownStickers(prev => [...prev, sticker]);
  }, []);

  const handleStickerUpdate = useCallback((sticker: TownSticker) => {
    setTownStickers(prev => prev.map(s => s.id === sticker.id ? sticker : s));
  }, []);

  const handleStickerDelete = useCallback((stickerId: string) => {
    setTownStickers(prev => prev.filter(s => s.id !== stickerId));
    if (selectedTownSticker?.id === stickerId) {
      setSelectedTownSticker(null);
    }
  }, [selectedTownSticker]);

  const handleBackgroundImageUpdate = useCallback((imageUrl: string | null) => {
    setTownBackgroundImageUrl(imageUrl);
  }, []);

  // Map data management functions
  const handleLoadMap = useCallback(async (mapKey: string): Promise<boolean> => {
    try {
      // Set initial load state when loading a map
      setIsInitialLoad(true);
      setHasUserMadeEdits(false); // Reset edit tracking for loaded map

      const result = await MapDataManager.loadMapData(mapKey);
      if (!result.success || !result.data) {
        console.error('Failed to load map data');
        setIsInitialLoad(false);
        return false;
      }

      const mapData = result.data;

      // Update all app state with loaded data
      setCurrentMapKey(mapKey);

      // Update hex grid
      if (mapData.worldMap?.hexes) {
        const hexMap = new Map<string, HexTile>();
        Object.entries(mapData.worldMap.hexes).forEach(([hexId, hexData]) => {
          // Find the biome object from available biomes
          const biomeObj = availableBiomes.find(b => b.name === hexData.biome) || UNASSIGNED_BIOME;
          const originalBiomeObj = hexData.originalBiome ?
            availableBiomes.find(b => b.name === hexData.originalBiome) : undefined;

          const hex: HexTile = {
            id: hexId,
            coordinates: hexData.coordinates,
            biome: biomeObj,
            originalBiome: originalBiomeObj,
            encounters: [], // Initialize with empty encounters
            notes: hexData.notes || '',
            encounterNotes: hexData.encounterNotes || '',
            isTown: hexData.isTown || false,
            townName: hexData.townName,
            townSize: hexData.townSize as any
          };
          hexMap.set(hexId, hex);
        });
        setHexGrid(hexMap);
        setHexGridVersion(prev => prev + 1);
      }

      // Update biomes
      if (mapData.biomes) {
        const biomes = Object.values(mapData.biomes);
        setAvailableBiomes(biomes);
        setGlobalBiomes(biomes.filter(b => b.name !== UNASSIGNED_BIOME.name));
      }

      // Update town data (simplified - skip for now due to type complexity)
      if (mapData.towns) {
        // Skip town loading for now - will need proper type conversion
        console.log('Town data found but skipping load due to type compatibility');
      }

      // Update background image
      if (mapData.worldMap?.backgroundImage) {
        const bgImg = mapData.worldMap.backgroundImage;
        setBackgroundImageUrl(`/map_data/map_${mapKey}/${bgImg.filename}`);
        setBackgroundImageScale(bgImg.scale);
        setBackgroundImageOffsetX(bgImg.offsetX);
        setBackgroundImageOffsetY(bgImg.offsetY);
        setBackgroundImageVisible(bgImg.visible);
      }

      // Update geography layer
      if (mapData.geography?.layers) {
        // Convert geography layers to drawing paths format
        const paths: DrawingPath[] = mapData.geography.layers.map(layer => ({
          id: layer.id,
          type: 'road' as DrawingType,
          points: layer.coordinates,
          color: layer.style.color,
          strokeWidth: layer.style.strokeWidth
        }));
        setDrawingLayer(paths);
      }

      // Update hex orientation
      if (mapData.orientation) {
        setHexOrientation(mapData.orientation);
      }

      // Mark load as complete after a brief delay
      setTimeout(() => {
        setIsInitialLoad(false);
        console.log('🚀 Map load complete - auto-save and unsaved change tracking now enabled');
      }, 100);

      console.log('Map loaded successfully:', mapKey);
      return true;
    } catch (error) {
      console.error('Error loading map:', error);
      setIsInitialLoad(false);
      return false;
    }
  }, [availableBiomes]);

  const handleSaveMap = useCallback(async (): Promise<boolean> => {
    // Skip if already saving
    if (isSaving) {
      console.log('⏳ Save already in progress, skipping...');
      return false;
    }

    const saveStartTime = performance.now();
    console.log('💾 Starting map save process...', { mapKey: currentMapKey, hexCount: hexGrid.size });

    try {
      setIsSaving(true);

      // Ensure we have a valid, non-default map key
      let saveMapKey = currentMapKey;
      let isNewMap = false;
      console.log(`🔍 Save process: mapKey=${saveMapKey}, isDefaultKey=${isDefaultKey(currentMapKey)}`);

      if (isDefaultKey(currentMapKey)) {
        console.log('🔑 Generating new unique map key for first save...');
        const keyGenStart = performance.now();
        saveMapKey = await generateUniqueMapKey();
        console.log(`✅ Generated new map key: ${saveMapKey} (${(performance.now() - keyGenStart).toFixed(2)}ms)`);
        setCurrentMapKey(saveMapKey);
        isNewMap = true;
      }

      // Initialize map data manager with the save key
      const initStart = performance.now();
      await MapDataManager.initializeMap(saveMapKey, isNewMap);
      console.log(`📁 Map data manager initialized (${(performance.now() - initStart).toFixed(2)}ms)`);

      // Compile comprehensive map data in the expected format
      const compileStart = performance.now();
      const hexesData: Record<string, any> = {};
      hexGrid.forEach((hex, hexId) => {
        hexesData[hexId] = {
          coordinates: hex.coordinates,
          biome: hex.biome.name,
          originalBiome: hex.originalBiome?.name,
          notes: hex.notes,
          encounterNotes: hex.encounterNotes,
          isTown: hex.isTown,
          townName: hex.townName,
          townSize: hex.townSize
        };
      });

      const biomesData: Record<string, any> = {};
      availableBiomes.forEach(biome => {
        biomesData[biome.name] = biome;
      });

      const townMaterialsData: Record<string, any> = {};
      availableTownMaterials.forEach(material => {
        townMaterialsData[material.name] = material;
      });

      const townsData: Record<string, any> = {};
      towns.forEach((town, townId) => {
        townsData[townId] = town;
      });

      const mapData: ComprehensiveMapData = {
        mapKey: saveMapKey,
        version: '2.0.0',
        lastUpdated: new Date().toISOString(),
        createdDate: new Date().toISOString(),
        orientation: hexOrientation,
        worldMap: {
          name: `Map ${saveMapKey}`,
          backgroundImage: backgroundImageUrl ? {
            filename: backgroundImageUrl.split('/').pop() || '',
            scale: backgroundImageScale,
            offsetX: backgroundImageOffsetX,
            offsetY: backgroundImageOffsetY,
            visible: backgroundImageVisible
          } : undefined,
          hexes: hexesData
        },
        biomes: biomesData,
        townMaterials: townMaterialsData,
        towns: townsData,
        geography: {
          layers: drawingLayer.map(path => ({
            id: path.id,
            type: 'path' as const,
            coordinates: path.points,
            style: {
              color: path.color || '#000000',
              strokeWidth: path.strokeWidth || 2,
              opacity: 1
            }
          })),
          visible: geographyVisible
        }
      };
      console.log(`📊 Map data compiled (${(performance.now() - compileStart).toFixed(2)}ms)`, {
        hexes: Object.keys(hexesData).length,
        biomes: Object.keys(biomesData).length,
        towns: Object.keys(townsData).length
      });

      // Update the map data in the manager
      const updateStart = performance.now();
      MapDataManager.updateMapData(mapData);
      console.log(`🔄 Map data updated in manager (${(performance.now() - updateStart).toFixed(2)}ms)`);

      // Force save
      const saveApiStart = performance.now();
      const success = await MapDataManager.forceSave();
      console.log(`📤 API save completed (${(performance.now() - saveApiStart).toFixed(2)}ms)`);

      if (success) {
        const totalTime = performance.now() - saveStartTime;
        console.log(`✅ Map saved successfully: ${saveMapKey} (Total: ${totalTime.toFixed(2)}ms)`);
        setHasUnsavedChanges(false);
        setHasUserMadeEdits(false); // Reset edit tracking after successful save
        return true;
      } else {
        console.error('❌ Failed to save map');
        return false;
      }
    } catch (error) {
      const totalTime = performance.now() - saveStartTime;
      console.error(`❌ Error saving map (${totalTime.toFixed(2)}ms):`, error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, hexOrientation, availableBiomes, availableTownMaterials, backgroundImageUrl, backgroundImageScale, backgroundImageOffsetX, backgroundImageOffsetY, backgroundImageVisible, hexGrid, towns, drawingLayer, geographyVisible, currentMapKey]);

  // New function to save map with specific key (for auto-save and new map creation)
  const handleSaveMapWithKey = useCallback(async (mapKey: string, isNewMap: boolean = false): Promise<boolean> => {
    // Skip if already saving
    if (isSaving) {
      console.log('⏳ Save already in progress, skipping...');
      return false;
    }

    const saveStartTime = performance.now();
    console.log('💾 Starting map save process...', { mapKey, hexCount: hexGrid.size, isNewMap });

    try {
      setIsSaving(true);

      // Initialize map data manager with the save key
      const initStart = performance.now();
      await MapDataManager.initializeMap(mapKey, isNewMap);
      console.log(`📁 Map data manager initialized (${(performance.now() - initStart).toFixed(2)}ms)`);

      // Compile comprehensive map data in the expected format
      const compileStart = performance.now();
      const hexesData: Record<string, any> = {};
      hexGrid.forEach((hex, hexId) => {
        hexesData[hexId] = {
          coordinates: hex.coordinates,
          biome: hex.biome.name,
          originalBiome: hex.originalBiome?.name,
          notes: hex.notes,
          encounterNotes: hex.encounterNotes,
          isTown: hex.isTown,
          townName: hex.townName,
          townSize: hex.townSize
        };
      });

      const biomesData: Record<string, any> = {};
      availableBiomes.forEach(biome => {
        biomesData[biome.name] = biome;
      });

      const townMaterialsData: Record<string, any> = {};
      availableTownMaterials.forEach(material => {
        townMaterialsData[material.name] = material;
      });

      const townsData: Record<string, any> = {};
      towns.forEach((town, townId) => {
        townsData[townId] = town;
      });

      const mapData: ComprehensiveMapData = {
        mapKey: mapKey,
        version: '2.0.0',
        lastUpdated: new Date().toISOString(),
        createdDate: new Date().toISOString(),
        orientation: hexOrientation,
        worldMap: {
          name: `Map ${mapKey}`,
          backgroundImage: backgroundImageUrl ? {
            filename: backgroundImageUrl.split('/').pop() || '',
            scale: backgroundImageScale,
            offsetX: backgroundImageOffsetX,
            offsetY: backgroundImageOffsetY,
            visible: backgroundImageVisible
          } : undefined,
          hexes: hexesData
        },
        biomes: biomesData,
        townMaterials: townMaterialsData,
        towns: townsData,
        geography: {
          layers: drawingLayer.map(path => ({
            id: path.id,
            type: 'path' as const,
            coordinates: path.points,
            style: {
              color: path.color || '#000000',
              strokeWidth: path.strokeWidth || 2,
              opacity: 1
            }
          })),
          visible: geographyVisible
        }
      };
      console.log(`📊 Map data compiled (${(performance.now() - compileStart).toFixed(2)}ms)`, {
        hexes: Object.keys(hexesData).length,
        biomes: Object.keys(biomesData).length,
        towns: Object.keys(townsData).length
      });

      // Update the map data in the manager
      const updateStart = performance.now();
      MapDataManager.updateMapData(mapData);
      console.log(`🔄 Map data updated in manager (${(performance.now() - updateStart).toFixed(2)}ms)`);

      // Force save
      const saveApiStart = performance.now();
      const success = await MapDataManager.forceSave();
      console.log(`📤 API save completed (${(performance.now() - saveApiStart).toFixed(2)}ms)`);

      if (success) {
        const totalTime = performance.now() - saveStartTime;
        console.log(`✅ Map saved successfully: ${mapKey} (Total: ${totalTime.toFixed(2)}ms)`);
        return true;
      } else {
        console.error('❌ Failed to save map');
        return false;
      }
    } catch (error) {
      const totalTime = performance.now() - saveStartTime;
      console.error(`❌ Error saving map (${totalTime.toFixed(2)}ms):`, error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, hexOrientation, availableBiomes, availableTownMaterials, backgroundImageUrl, backgroundImageScale, backgroundImageOffsetX, backgroundImageOffsetY, backgroundImageVisible, hexGrid, towns, drawingLayer, geographyVisible]);

  const handleNewMap = useCallback(async () => {
    // First, save current map if it has changes and isn't a default key
    if (hasUnsavedChanges && !isDefaultKey(currentMapKey)) {
      const shouldSave = window.confirm('Save current map before creating new one?');
      if (shouldSave) {
        await handleSaveMap();
      }
    }

    // Set initial load state during reset
    setIsInitialLoad(true);
    setHasUserMadeEdits(false); // Reset edit tracking for new map

    // Reset to a fresh default state
    setCurrentMapKey('default_map');
    setHexGrid(new Map());
    setTowns(new Map());
    setDrawingLayer([]);
    setBackgroundImageUrl(null);
    setBackgroundImageScale(1);
    setBackgroundImageOffsetX(0);
    setBackgroundImageOffsetY(0);
    setBackgroundImageVisible(true);
    setHasUnsavedChanges(false);
    setHexGridVersion(prev => prev + 1);

    // Reload default biomes from biomes.json
    try {
      const response = await fetch('/biomes.json');
      const defaultBiomesData: Biome[] = await response.json();
      const allDefaultBiomes = [UNASSIGNED_BIOME, ...defaultBiomesData].sort((a, b) => a.name.localeCompare(b.name));
      setAvailableBiomes(allDefaultBiomes);
      setGlobalBiomes(defaultBiomesData);

      // Reset selected biome to unassigned
      setCurrentSelectedBiome(UNASSIGNED_BIOME);

      console.log('🔄 Default biomes reloaded for new map');
    } catch (error) {
      console.error('Failed to reload default biomes:', error);
    }

    // Regenerate the initial hex grid
    const initialHexArray = generateTestHexGrid(GRID_ROWS, GRID_COLS, hexOrientation);
    const initialHexMap = new Map<string, HexTile>();
    initialHexArray.forEach(hex => initialHexMap.set(hex.id, hex));
    setHexGrid(initialHexMap);

    // Mark initial load as complete after a brief delay
    setTimeout(() => {
      setIsInitialLoad(false);
      console.log('🚀 New map initial load complete - auto-save and unsaved change tracking now enabled');
    }, 100);

    console.log('New map created - reset to default state');
  }, [hasUnsavedChanges, currentMapKey, handleSaveMap, hexOrientation]);

  const handleGoTo = () => {
    const col = parseInt(gotoX, 10);
    const row = parseInt(gotoY, 10);
    if (!isNaN(col) && !isNaN(row)) {
      const axialCoords = userToAxial(col, row, GRID_ROWS, GRID_COLS, hexOrientation);
      if (axialCoords) {
        const hexIdToGo = `${axialCoords.q},${axialCoords.r}`;
        const targetHex = hexGrid.get(hexIdToGo);
        if (targetHex) {
          setSelectedHex(targetHex);
          setCenterOnHexId(hexIdToGo);
          setIsDetailsPanelOpen(true);
        } else alert("Hex not found.");
      } else alert("Invalid coordinates.");
    } else alert("Invalid coordinates.");
  };

  const handleVisibleHexesChange = useCallback((count: number, zoom: number) => {
    setRenderedHexesCount(count);
    setCurrentZoomLevel(zoom);
  }, []);

  useEffect(() => {
    fetch('/biomes.json')
      .then(response => response.json())
      .then((data: Biome[]) => {
        const allBiomes = [UNASSIGNED_BIOME, ...data].sort((a, b) => a.name.localeCompare(b.name));
        setAvailableBiomes(allBiomes);
        setGlobalBiomes(data);
        setBiomesLoaded(true);
        const initialHexArray = generateTestHexGrid(GRID_ROWS, GRID_COLS, hexOrientation);
        const initialHexMap = new Map<string, HexTile>();
        initialHexArray.forEach(hex => initialHexMap.set(hex.id, hex));
        setHexGrid(initialHexMap);

        if (initialHexMap.size > 0 && !defaultHexInitiallySetRef.current) {
          const calculatedCenterHexId = getInitialCenterHexId(GRID_ROWS, GRID_COLS, hexOrientation);
          let hexToSelectAndCenter = initialHexMap.get(calculatedCenterHexId) || Array.from(initialHexMap.values())[0];
          if (hexToSelectAndCenter) {
            setSelectedHex(hexToSelectAndCenter);
            setCenterOnHexId(hexToSelectAndCenter.id);
            setIsInitialCenteringPending(true);
            setIsDetailsPanelOpen(true);
            defaultHexInitiallySetRef.current = true;
          }
        }

        // Mark initial load as complete after grid generation
        setTimeout(() => {
          setIsInitialLoad(false);
          console.log('🚀 Initial load complete - auto-save and unsaved change tracking now enabled');
        }, 100);
      })
      .catch(error => console.error("Could not load biomes:", error));
  }, []);

  useEffect(() => {
    if (selectedHex) {
      setGotoX((selectedHex.labelX ?? '').toString());
      setGotoY((selectedHex.labelY ?? '').toString());
    }
  }, [selectedHex]);

  const handleJumpToTown = useCallback((hexId: string) => {
    const targetHex = hexGrid.get(hexId);
    if (targetHex) {
      setSelectedHex(targetHex);
      setCenterOnHexId(hexId);
      setIsDetailsPanelOpen(true);
    }
  }, [hexGrid]);

  const handleHexClick = useCallback((hex: HexTile) => {
    setSelectedHex(hex);
    setIsDetailsPanelOpen(true);
  }, []);

  const handleDesignateTown = useCallback((hexId: string, townName: string, townSize: TownSizeCategory) => {
    const hexToDesignate = hexGrid.get(hexId);
    if (!hexToDesignate || hexToDesignate.isTown) return;

    const newTownId = `town_${hexId}`;
    const gridDimensions = TOWN_SIZE_DETAILS.get(townSize);
    if (!gridDimensions) return;

    const initialTownGrid: Record<string, TownCell> = {};
    const defaultMaterial = availableTownMaterials.find(m => m.style === 'default') || availableTownMaterials[0];

    for (let y = 0; y < gridDimensions.height; y++) {
      for (let x = 0; x < gridDimensions.width; x++) {
        const cellId = `${x},${y}`;
        initialTownGrid[cellId] = {
          id: cellId,
          coordinates: { x, y },
          material: defaultMaterial.style,
        };
      }
    }

    const newTown: TownData = {
      id: newTownId,
      name: townName,
      originHexCoordinates: hexToDesignate.coordinates,
      sizeCategory: townSize,
      gridDimensions: gridDimensions,
      notes: '',
      population: 0,
      races: [],
      grid: initialTownGrid,
      buildings: {},
    };

    setTowns(prev => new Map(prev).set(newTownId, newTown));

    setHexGrid(prevMap => {
      const newMap = new Map(prevMap);
      const currentHex = newMap.get(hexId);
      if (currentHex) {
        const townBiome = availableBiomes.find(b => b.name === 'Town');
        const updatedHex: HexTile = {
          ...currentHex,
          isTown: true,
          townId: newTownId,
          townName: townName,
          townSize: townSize,
          originalBiome: currentHex.biome,
          biome: townBiome ? { ...townBiome, color: '#000000' } : currentHex.biome,
        };
        newMap.set(hexId, updatedHex);
        if (selectedHex?.id === hexId) setSelectedHex(updatedHex);
      }
      return newMap;
    });
    setCurrentTool('select');
  }, [hexGrid, selectedHex, availableBiomes, availableTownMaterials]);

  const handleUndesignateTown = useCallback((hexId: string) => {
    const hexToUndesignate = hexGrid.get(hexId);
    if (!hexToUndesignate?.isTown || !hexToUndesignate.townId) return;

    if (!window.confirm(`Are you sure you want to remove \"${hexToUndesignate.townName}\"?`)) return;

    const townIdToRemove = hexToUndesignate.townId;
    setHexGrid(prevMap => {
      const newMap = new Map(prevMap);
      const currentHex = newMap.get(hexId);
      if (currentHex) {
        const updatedHex: HexTile = {
          ...currentHex,
          isTown: false,
          townId: undefined,
          townName: undefined,
          townSize: undefined,
          biome: currentHex.originalBiome || UNASSIGNED_BIOME,
          originalBiome: undefined,
        };
        newMap.set(hexId, updatedHex);
        if (selectedHex?.id === hexId) setSelectedHex(updatedHex);
      }
      return newMap;
    });

    setTowns(prevTowns => {
      const newTownsMap = new Map(prevTowns);
      newTownsMap.delete(townIdToRemove);
      return newTownsMap;
    });
  }, [hexGrid, selectedHex, UNASSIGNED_BIOME]);

  const handlePaintHexBatch = useCallback((batch: Array<{ hexId: string }>, tool: ToolMode) => {
    const activeBiome = currentSelectedBiomeRef.current; // Use ref for most up-to-date value

    if (tool !== 'paint') {
      return;
    }

    if (!activeBiome) {
      return;
    }

    if (activeBiome.name === UNASSIGNED_BIOME.name || activeBiome.color === 'transparent') {
      return;
    }
    setHexGrid(prevMap => {
      const newMap = new Map(prevMap);
      let hasChanges = false;

      batch.forEach(item => {
        const currentHex = newMap.get(item.hexId);
        if (currentHex && !currentHex.isTown) {
          newMap.set(item.hexId, { ...currentHex, biome: activeBiome });
          hasChanges = true;
        }
      });

      if (selectedHex && batch.some(h => h.hexId === selectedHex.id)) {
        const updatedSelectedHexData = newMap.get(selectedHex.id);
        if (updatedSelectedHexData) {
          setSelectedHex(updatedSelectedHexData);
        }
      }

      if (hasChanges) {
        setHexGridVersion(prev => prev + 1); // Force re-render
      }
      return hasChanges ? newMap : prevMap;
    });
  }, [selectedHex, UNASSIGNED_BIOME.name]);

  const handlePaintComplete = useCallback((lastPaintedHex: HexTile) => {
    setSelectedHex(lastPaintedHex);
    setIsDetailsPanelOpen(true);
  }, []);

  const handleHexCentered = useCallback(() => {
    if (isInitialCenteringPending) {
      setIsInitialCenteringPending(false);
    }
    if (centerOnHexId) {
      setCenterOnHexId(null);
    }
  }, [isInitialCenteringPending, centerOnHexId]);

  const handleUpdateHexNotes = useCallback((updatedNotes: string) => {
    if (!selectedHex) return;
    setHexGrid(prevMap => {
      const newMap = new Map(prevMap);
      const currentHex = newMap.get(selectedHex.id);
      if (currentHex) {
        const updatedHex = { ...currentHex, notes: updatedNotes };
        newMap.set(selectedHex.id, updatedHex);
        setSelectedHex(updatedHex);
      }
      return newMap;
    });
  }, [selectedHex]);

  const handleUpdateEncounterNotes = useCallback((updatedEncounterNotes: string) => {
    if (!selectedHex) return;
    setHexGrid(prevMap => {
      const newMap = new Map(prevMap);
      const currentHex = newMap.get(selectedHex.id);
      if (currentHex) {
        const updatedHex = { ...currentHex, encounterNotes: updatedEncounterNotes };
        newMap.set(selectedHex.id, updatedHex);
        setSelectedHex(updatedHex);
      }
      return newMap;
    });
  }, [selectedHex]);

  const handleEnterTown = useCallback((townId: string) => {
    const townData = towns.get(townId);
    if (townData) {
      setActiveTownId(townId);
      setCurrentView('town');
      setCurrentTownTool('select');

      // Select the center cell by default to show the details panel
      const centerX = Math.floor(townData.gridDimensions.width / 2);
      const centerY = Math.floor(townData.gridDimensions.height / 2);
      setSelectedTownCell({ x: centerX, y: centerY, townId: townId });

      setIsDetailsPanelOpen(false); // Keep this for world map panel state management
    }
  }, [towns]);

  const handleExitTownView = useCallback(() => {
    const exitedTownId = activeTownId;
    setCurrentView('world');
    setActiveTownId(null);
    setCurrentTool('select'); // Ensure world tool is reset
    setSelectedTownCell(null);

    if (exitedTownId) {
      const exitedTownHex = Array.from(hexGrid.values()).find(hex => hex.townId === exitedTownId);
      if (exitedTownHex) {
        setSelectedHex(exitedTownHex);
        setCenterOnHexId(exitedTownHex.id);
        setIsDetailsPanelOpen(true);
      }
    }
  }, [hexGrid, activeTownId]);

  const handleRenameTown = useCallback((townId: string, newName: string) => {
    // Find the hex that corresponds to this town
    const townHex = Array.from(hexGrid.values()).find(hex => hex.townId === townId);
    if (!townHex) return;

    // Update the hex grid with the new town name
    setHexGrid(prevGrid => {
      const newGrid = new Map(prevGrid);
      const updatedHex = { ...townHex, townName: newName };
      newGrid.set(townHex.id, updatedHex);
      return newGrid;
    });

    // Update the town data as well
    setTowns(prevTowns => {
      const newTowns = new Map(prevTowns);
      const townData = newTowns.get(townId);
      if (townData) {
        const updatedTownData = { ...townData, name: newName };
        newTowns.set(townId, updatedTownData);
      }
      return newTowns;
    });

    // Force a re-render
    setHexGridVersion(prev => prev + 1);
  }, [hexGrid]);

  // Mark as unsaved on any relevant change (but not during initial load)
  useEffect(() => {
    if (!isSaving && !isInitialLoad) {
      setHasUnsavedChanges(true);
      setHasUserMadeEdits(true); // User has made actual edits
    }
    // eslint-disable-next-line
  }, [hexGrid, towns, availableBiomes, drawingLayer, backgroundImageUrl, currentMapKey]);

  const hexListForGrid = useMemo(() => {
    const hexArray = Array.from(hexGrid.values());
    // console.log('[App] Creating hexListForGrid, count:', hexArray.length, 'hexGrid.size:', hexGrid.size, 'version:', hexGridVersion);
    return hexArray;
  }, [hexGrid, hexGridVersion]);
  const townListForTools = useMemo(() => Array.from(hexGrid.values()).filter(hex => hex.isTown), [hexGrid]);

  // Keep the ref in sync with the state
  useEffect(() => {
    currentSelectedBiomeRef.current = currentSelectedBiome;
  }, [currentSelectedBiome]);  // Keep track of the current selected hex coordinates for orientation changes
  const selectedHexCoordsRef = useRef<{ x: number | undefined; y: number | undefined } | null>(null);

  useEffect(() => {
    selectedHexCoordsRef.current = selectedHex ? { x: selectedHex.labelX, y: selectedHex.labelY } : null;
  }, [selectedHex]);

  // Regenerate grid when orientation changes (but not during initial biome loading)
  useEffect(() => {
    if (biomesLoaded && defaultHexInitiallySetRef.current) {
      // Set initial load state during orientation change
      setIsInitialLoad(true);

      // Remember the current selection's user coordinates before changing orientation
      const currentUserCoords = selectedHexCoordsRef.current;

      // Create a map of user coordinates to hex data to preserve biome assignments
      const existingHexData = new Map<string, { biome: Biome; isTown: boolean; notes: string; encounters: any[] }>();
      if (hexGrid.size > 0) {
        Array.from(hexGrid.values()).forEach(hex => {
          const coordKey = `${hex.labelX},${hex.labelY}`;
          existingHexData.set(coordKey, {
            biome: hex.biome,
            isTown: hex.isTown,
            notes: hex.notes,
            encounters: hex.encounters
          });
        });

      }

      const newHexArray = generateTestHexGrid(GRID_ROWS, GRID_COLS, hexOrientation);
      const newHexMap = new Map<string, HexTile>();

      // Restore hex data based on user coordinates
      newHexArray.forEach(hex => {
        const coordKey = `${hex.labelX},${hex.labelY}`;
        const existingData = existingHexData.get(coordKey);
        if (existingData) {
          // Preserve the existing hex data
          hex.biome = existingData.biome;
          hex.isTown = existingData.isTown;
          hex.notes = existingData.notes;
          hex.encounters = existingData.encounters;
        }
        newHexMap.set(hex.id, hex);
      });

      setHexGrid(newHexMap);
      setHexGridVersion(prev => prev + 1);

      if (newHexMap.size > 0) {
        let hexToSelect: HexTile | null = null;

        // Try to find the hex at the same user coordinates as before
        if (currentUserCoords && currentUserCoords.x !== undefined && currentUserCoords.y !== undefined) {
          hexToSelect = Array.from(newHexMap.values()).find(hex =>
            hex.labelX === currentUserCoords.x && hex.labelY === currentUserCoords.y
          ) || null;

        }

        // If no previous selection or can't find equivalent, use center hex
        if (!hexToSelect) {
          const calculatedCenterHexId = getInitialCenterHexId(GRID_ROWS, GRID_COLS, hexOrientation);
          hexToSelect = newHexMap.get(calculatedCenterHexId) || Array.from(newHexMap.values())[0];

        }

        if (hexToSelect) {
          setSelectedHex(hexToSelect);
          setCenterOnHexId(hexToSelect.id);
          setIsInitialCenteringPending(true);
          setIsDetailsPanelOpen(true);
        }
      } else {
        // No hexes available, reset everything
        setSelectedHex(null);
        setIsDetailsPanelOpen(false);
      }

      // Mark orientation change as complete after a brief delay
      setTimeout(() => {
        setIsInitialLoad(false);
        console.log('🚀 Orientation change complete - auto-save and unsaved change tracking now enabled');
      }, 100);
    }
  }, [hexOrientation, biomesLoaded]);

  // Smart auto-save with batching and collision avoidance
  useEffect(() => {
    const autoSaveTimer = setTimeout(async () => {
      // Skip if currently saving or during initial load
      if (isSaving || isInitialLoad) {
        if (isInitialLoad) {
          console.log('⏳ Auto-save skipped - initial load in progress');
        } else {
          console.log('⏳ Auto-save skipped - save already in progress');
        }
        return;
      }

      // Only auto-save if we have meaningful data AND user has made actual edits
      if (hexGrid.size > 0 && hasUserMadeEdits) {
        if (isDefaultKey(currentMapKey)) {
          // For default keys, generate a new map key and save immediately
          console.log('🆕 Changes detected on default map - generating new map key and saving...');
          try {
            const newMapKey = await generateUniqueMapKey();

            // Perform the save operation directly with the new key
            console.log('💾 Starting immediate save for new map:', newMapKey);
            const saveSuccess = await handleSaveMapWithKey(newMapKey, true); // true = isNewMap

            if (saveSuccess) {
              setCurrentMapKey(newMapKey);
              setHasUnsavedChanges(false);
              setHasUserMadeEdits(false);
              console.log(`✅ New map saved and key updated: ${newMapKey}`);
            }
          } catch (error) {
            console.error('❌ Failed to generate new map key and save:', error);
            setHasUnsavedChanges(true);
          }
        } else if (hasUnsavedChanges) {
          // For non-default keys with changes, trigger auto-save
          console.log('💾 Auto-save triggered for existing map:', currentMapKey);
          try {
            await handleSaveMap();
          } catch (error) {
            console.error('❌ Auto-save failed:', error);
          }
        }
      }
    }, 3000); // 3-second debounce for auto-save

    return () => clearTimeout(autoSaveTimer);
  }, [hexGrid, towns, availableBiomes, drawingLayer, backgroundImageUrl, currentMapKey, hasUnsavedChanges, isSaving, isInitialLoad, hasUserMadeEdits, handleSaveMap, handleSaveMapWithKey]);

  // Remove the old periodic save - we now have smart batching in the main auto-save

  if (currentView === 'town' && activeTownId) {
    const currentTownData = towns.get(activeTownId);
    if (!currentTownData) {
      return (
        <div className="app-container town-view-active">
          <h2>Error: Town not found!</h2>
          <button onClick={handleExitTownView}>Return to World Map</button>
        </div>
      );
    }

    const selectedTownCellData = selectedTownCell ? currentTownData.grid[`${selectedTownCell.x},${selectedTownCell.y}`] : null;

    return (
      <div className="town-view-active">
        {isTownToolsPanelOpen && (
          <div className="town-tools-left-panel floating-panel">
            <div className="tabs">
              <button className={activeTab === 'worldEdit' ? 'active' : ''} onClick={() => setActiveTab('worldEdit')}>Town Edit</button>
              <button className={activeTab === 'view' ? 'active' : ''} onClick={() => setActiveTab('view')}>View</button>
              <button className={activeTab === 'importExport' ? 'active' : ''} onClick={() => setActiveTab('importExport')}>Import/Export</button>
            </div>

            {/* Map Key Display */}
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              fontSize: '12px',
              color: '#ccc',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>
                <strong style={{ color: '#fff' }}>Map:</strong> {currentMapKey || 'default_map'}
                {hasUnsavedChanges && !isDefaultKey(currentMapKey || 'default_map') && (
                  <span style={{
                    marginLeft: '8px',
                    padding: '2px 6px',
                    backgroundColor: '#ffc107',
                    color: '#000',
                    fontSize: '9px',
                    borderRadius: '3px',
                    fontWeight: 'bold'
                  }}>
                    UNSAVED
                  </span>
                )}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentMapKey || 'default_map');
                  setTownCopied(true);
                  setTimeout(() => setTownCopied(false), 5000);
                }}
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  backgroundColor: townCopied ? '#28a745' : '#444',
                  color: townCopied ? '#fff' : '#ccc',
                  border: '1px solid #666',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s'
                }}
                title="Copy map key to clipboard"
              >
                {townCopied ? '✔ Copied' : 'Copy'}
              </button>
            </div>
            {activeTab === 'worldEdit' && (
              <>
                <div className="tool-section">
                  <h4>Town: {currentTownData.name}</h4>
                  <p style={{ textTransform: 'capitalize', margin: '-8px 0 8px 0', fontSize: '0.8em', color: '#aaa' }}>
                    {currentTownData.sizeCategory} ({currentTownData.gridDimensions.width}x{currentTownData.gridDimensions.height})
                  </p>
                  <button onClick={handleExitTownView} className="panel-button">Exit Town View</button>
                </div>
                <div className="tool-section">
                  <h4>Tools</h4>
                  <button onClick={() => setCurrentTownTool('select')} className={`panel-button ${currentTownTool === 'select' ? 'active' : ''}`}>Select Cell</button>
                  <button onClick={() => { setCurrentTownTool('paint'); if (!currentSelectedTownMaterial) setCurrentSelectedTownMaterial(availableTownMaterials[0]); }} className={`panel-button ${currentTownTool === 'paint' ? 'active' : ''}`}>Paint Cell</button>
                  <button onClick={() => setCurrentTownTool('sticker')} className={`panel-button ${currentTownTool === 'sticker' ? 'active' : ''}`}>Place Sticker</button>
                </div>
                {currentTownTool === 'paint' && (
                  <TownMaterialSelector
                    availableMaterials={availableTownMaterials}
                    onMaterialSelect={setCurrentSelectedTownMaterial}
                    selectedMaterialName={currentSelectedTownMaterial?.name}
                    onMaterialColorChange={handleTownMaterialColorChange}
                  />
                )}
                <div className="tool-section">
                  <p>Zoom: {townViewDisplay.zoom.toFixed(2)}x</p>
                  <p>Rendered Cells: {townViewDisplay.visibleCells}</p>
                </div>
              </>
            )}
            {activeTab === 'view' && (
              <>
                <TownImageTools
                  townId={currentTownData.id}
                  townCoordinates={currentTownData.originHexCoordinates}
                  stickers={townStickers}
                  onStickerAdd={handleStickerAdd}
                  onStickerUpdate={handleStickerUpdate}
                  onStickerDelete={handleStickerDelete}
                  onBackgroundImageUpdate={handleBackgroundImageUpdate}
                  selectedSticker={selectedTownSticker}
                  onSelectSticker={setSelectedTownSticker}
                  showStickers={townStickersVisible}
                  onToggleStickers={setTownStickersVisible}
                  showBackgroundImage={townBackgroundImageVisible}
                  onToggleBackgroundImage={setTownBackgroundImageVisible}
                  backgroundImageUrl={townBackgroundImageUrl}
                  backgroundImageScale={townBackgroundImageScale}
                  setBackgroundImageScale={setTownBackgroundImageScale}
                  backgroundImageOffsetX={townBackgroundImageOffsetX}
                  setBackgroundImageOffsetX={setTownBackgroundImageOffsetX}
                  backgroundImageOffsetY={townBackgroundImageOffsetY}
                  setBackgroundImageOffsetY={setTownBackgroundImageOffsetY}
                />
                <div className="tool-section">
                  <p>Zoom: {townViewDisplay.zoom.toFixed(2)}x</p>
                  <p>Rendered Cells: {townViewDisplay.visibleCells}</p>
                </div>
              </>
            )}
            {activeTab === 'importExport' && (
              <div className="tool-section">
                <h4>Import/Export Data</h4>
                <button className="panel-button" onClick={() => alert('Not implemented')}>Import Town</button>
                <button className="panel-button" onClick={() => alert('Not implemented')}>Export Town</button>
              </div>
            )}
          </div>
        )}

        <div id="town-grid-container" className="town-grid-container">
          <TownGridWebGLV2
            townData={currentTownData}
            selectedCell={selectedTownCell}
            onSelectCell={handleSelectTownCell}
            onUpdateCellBatch={handleUpdateTownCellBatch}
            tool={currentTownTool}
            selectedMaterial={currentSelectedTownMaterial}
            materials={availableTownMaterials}
            onViewChange={(view: { x: number; y: number; zoom: number }) => setTownViewDisplay(prev => ({ ...prev, zoom: view.zoom }))}
            onVisibleCellsChange={(count: number) => setTownViewDisplay(prev => ({ ...prev, visibleCells: count }))}
            stickers={townStickers}
            onStickerAdd={handleStickerAdd}
            onStickerUpdate={handleStickerUpdate}
            onStickerDelete={handleStickerDelete}
            selectedSticker={selectedTownSticker}
            onSelectSticker={setSelectedTownSticker}
            backgroundImageUrl={townBackgroundImageUrl || undefined}
            backgroundImageScale={townBackgroundImageScale}
            backgroundImageOffsetX={townBackgroundImageOffsetX}
            backgroundImageOffsetY={townBackgroundImageOffsetY}
            backgroundImageVisible={townBackgroundImageVisible}
            onBackgroundImageUpdate={handleBackgroundImageUpdate}
            showStickers={townStickersVisible}
          />
        </div>

        {selectedTownCell && selectedTownCellData && (
          <div className="town-details-right-panel floating-panel">
            <TownCellDetailPanel
              selectedCell={selectedTownCellData}
              availableTownMaterials={availableTownMaterials}
              onUpdateMaterial={handleUpdateTownCellMaterial}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-layout-horizontal">
        {isToolsPanelOpen && (
          <div className="floating-panel tools-panel left-panel">
            <WorldMapTools
              currentTool={currentTool}
              onToolChange={handleToolChange}
              biomesLoaded={biomesLoaded}
              availableBiomes={availableBiomes}
              onBiomeSelect={(biome: Biome) => {

                setCurrentSelectedBiome(biome);
                currentSelectedBiomeRef.current = biome; // Keep ref in sync
              }}
              selectedBiomeName={currentSelectedBiome.name}
              gotoX={gotoX}
              gotoY={gotoY}
              onGotoXChange={setGotoX}
              onGotoYChange={setGotoY}
              onGoto={handleGoTo}
              zoomLevel={currentZoomLevel}
              renderedHexesCount={renderedHexesCount}
              towns={townListForTools}
              onJumpToTown={handleJumpToTown}
              onEnterTown={handleEnterTown}
              onRenameTown={handleRenameTown}
              viewSettings={viewSettings}
              onViewSettingChange={handleViewSettingChange}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              brushColor={brushColor}
              setBrushColor={setBrushColor}
              isErasing={isErasing}
              setIsErasing={setIsErasing}
              // Layer controls
              gridLinesVisible={gridLinesVisible}
              setGridLinesVisible={setGridLinesVisible}
              gridLineThickness={gridLineThickness}
              setGridLineThickness={setGridLineThickness}
              gridLineColor={gridLineColor}
              setGridLineColor={setGridLineColor}
              textScale={textScale}
              setTextScale={setTextScale}
              geographyVisible={geographyVisible}
              setGeographyVisible={setGeographyVisible}
              onBiomeColorChange={handleBiomeColorChange}
              // Biome management
              onBiomeAdd={handleBiomeAdd}
              onBiomeRename={handleBiomeRename}
              onBiomeDelete={handleBiomeDelete}
              // Background image controls
              backgroundImageUrl={backgroundImageUrl}
              setBackgroundImageUrl={setBackgroundImageUrl}
              backgroundImageScale={backgroundImageScale}
              setBackgroundImageScale={setBackgroundImageScale}
              backgroundImageOffsetX={backgroundImageOffsetX}
              setBackgroundImageOffsetX={setBackgroundImageOffsetX}
              backgroundImageOffsetY={backgroundImageOffsetY}
              setBackgroundImageOffsetY={setBackgroundImageOffsetY}
              backgroundImageVisible={backgroundImageVisible}
              setBackgroundImageVisible={setBackgroundImageVisible}
              // Hex orientation controls (NEW - additive only)
              hexOrientation={hexOrientation}
              setHexOrientation={setHexOrientation}
              // Map data management
              onLoadMap={handleLoadMap}
              onSaveMap={handleSaveMap}
              currentMapKey={currentMapKey}
              onNewMap={handleNewMap}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </div>
        )}

        <div className="map-view-container">
          {hexListForGrid.length > 0 && biomesLoaded && (
            <HexGridWebGL
              hexTiles={hexListForGrid}
              onHexClick={handleHexClick}
              currentTool={currentTool}
              onPaintHexBatch={handlePaintHexBatch}
              onPaintComplete={handlePaintComplete}
              selectedBiome={currentSelectedBiome}
              actualSelectedHexId={selectedHex?.id}
              onVisibleHexesChange={handleVisibleHexesChange}
              centerOnHexId={centerOnHexId}
              onCentered={handleHexCentered}
              drawingLayer={drawingLayer}
              viewSettings={viewSettings}
              onNewPath={handleNewPath}
              onErasePaths={handleErasePaths}
              brushSize={brushSize}
              brushColor={brushColor}
              isErasing={isErasing}
              // New layer props
              gridLinesVisible={gridLinesVisible}
              gridLineThickness={gridLineThickness}
              gridLineColor={gridLineColor}
              geographyVisible={geographyVisible}
              textScale={textScale}
              // Background image props
              backgroundImageUrl={backgroundImageUrl}
              backgroundImageScale={backgroundImageScale}
              backgroundImageOffsetX={backgroundImageOffsetX}
              backgroundImageOffsetY={backgroundImageOffsetY}
              backgroundImageVisible={backgroundImageVisible}
              hexOrientation={hexOrientation}
            />
          )}
        </div>

        {selectedHex && isDetailsPanelOpen && currentView === 'world' && (
          <div className="floating-panel details-panel right-panel">
            <HexDetailPanel
              selectedHex={selectedHex}
              onUpdateNotes={handleUpdateHexNotes}
              onUpdateEncounterNotes={handleUpdateEncounterNotes}
              onEnterTown={handleEnterTown}
              onDesignateTown={handleDesignateTown}
              onUndesignateTown={handleUndesignateTown}
            />
          </div>
        )}
      </div>

      <button
        className={`panel-toggle-button tools-toggle-button left-toggle ${isToolsPanelOpen ? 'open' : ''}`}
        onClick={() => setIsToolsPanelOpen(!isToolsPanelOpen)}
        title={isToolsPanelOpen ? "Collapse Tools Panel" : "Expand Tools Panel"}>
        {isToolsPanelOpen ? '<' : '>'}
      </button>
    </div>
  );
}

export default App;
