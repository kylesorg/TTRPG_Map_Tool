import React, { useRef, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import { TownGridManager } from './core/TownGridManager';
import type { TownData, SelectedTownCell, TownSticker } from '../../types/townTypes';
import type { TownMaterial } from '../../types/mapTypes';

const CELL_SIZE = 10;

interface TownGridWebGLV2Props {
    townData: TownData;
    selectedCell: SelectedTownCell | null;
    onSelectCell: (cell: SelectedTownCell | null) => void;
    onUpdateCellBatch: (batch: { x: number; y: number; material: string }[]) => void;
    tool: 'select' | 'paint' | 'sticker';
    selectedMaterial: TownMaterial | null;
    materials: TownMaterial[];
    onViewChange?: (view: { x: number; y: number; zoom: number }) => void;
    onVisibleCellsChange?: (count: number) => void;
    // Enhanced sticker and image props
    stickers?: TownSticker[];
    onStickerAdd?: (sticker: TownSticker) => void;
    onStickerUpdate?: (sticker: TownSticker) => void;
    onStickerDelete?: (stickerId: string) => void;
    selectedSticker?: TownSticker | null;
    onSelectSticker?: (sticker: TownSticker | null) => void;
    backgroundImageUrl?: string;
    backgroundImageScale?: number;
    backgroundImageOffsetX?: number;
    backgroundImageOffsetY?: number;
    backgroundImageVisible?: boolean;
    onBackgroundImageUpdate?: (imageUrl: string | null) => void;
    // Layer visibility controls
    showGridLines?: boolean;
    showStickers?: boolean;
    gridLineThickness?: number;
    gridLineColor?: string;
}

const TownGridWebGLV2: React.FC<TownGridWebGLV2Props> = ({
    townData,
    selectedCell,
    onSelectCell,
    onUpdateCellBatch,
    tool,
    selectedMaterial,
    materials,
    stickers = [],
    onStickerAdd,
    // onStickerUpdate, // Unused
    // onStickerDelete, // Unused 
    // selectedSticker, // Unused
    // onSelectSticker, // Unused
    backgroundImageUrl,
    backgroundImageScale = 1,
    backgroundImageOffsetX = 0,
    backgroundImageOffsetY = 0,
    backgroundImageVisible = true,
    // onBackgroundImageUpdate, // Unused
    showGridLines = true,
    showStickers = true,
    gridLineThickness = 1,
    gridLineColor = '#333333',
}) => {
    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const gridManagerRef = useRef<TownGridManager | null>(null);
    const [pixiInitialized, setPixiInitialized] = useState(false);

    // Initialize PIXI Application and GridManager
    useEffect(() => {
        const containerNode = pixiContainerRef.current;
        if (containerNode && !appRef.current) {
            let isCancelled = false;
            const app = new PIXI.Application();

            const initPixi = async () => {
                if (isCancelled) return;

                // Wait for container to have proper dimensions
                const waitForDimensions = () => {
                    return new Promise<void>((resolve) => {
                        const checkDimensions = () => {
                            const rect = containerNode.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                resolve();
                            } else {
                                setTimeout(checkDimensions, 10);
                            }
                        };
                        checkDimensions();
                    });
                };

                await waitForDimensions();

                if (isCancelled) return;

                const rect = containerNode.getBoundingClientRect();
                await app.init({
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: 0xf0f0f0,
                    antialias: true,
                    autoDensity: true,
                    resolution: window.devicePixelRatio || 1,
                });

                if (isCancelled) {
                    app.destroy();
                    return;
                }

                // Create grid manager with enhanced configuration
                try {
                    const gridManager = new TownGridManager(
                        {
                            cellSize: CELL_SIZE,
                            viewport: {
                                maxZoomLevel: 10,
                                minZoomLevel: 0.1,
                                panSpeed: 1,
                                zoomSpeed: 0.001,
                            },
                            layers: {
                                cellSize: CELL_SIZE,
                                gridWidth: townData.gridDimensions.width,
                                gridHeight: townData.gridDimensions.height,
                                viewSettings: {
                                    showGridLines: showGridLines,
                                },
                                gridLineThickness: gridLineThickness,
                                gridLineColor: gridLineColor,
                            },
                            onCellClick: (cell) => {
                                if (onSelectCell && tool === 'select') {
                                    onSelectCell({
                                        townId: townData.id,
                                        x: cell.x,
                                        y: cell.y
                                    });
                                }
                            },
                            onCellPaint: (batch) => {
                                if (onUpdateCellBatch && tool === 'paint') {
                                    onUpdateCellBatch(batch);
                                }
                            },
                            onPaintComplete: (cell) => {
                                if (onSelectCell) {
                                    onSelectCell({
                                        townId: townData.id,
                                        x: cell.x,
                                        y: cell.y
                                    });
                                }
                            },
                            onStickerPlace: (position) => {
                                if (onStickerAdd && tool === 'sticker') {
                                    // Create a new sticker at the clicked position
                                    const newSticker: TownSticker = {
                                        id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                        imageUrl: '/placeholder.png', // Default placeholder - will be replaced when user uploads
                                        position,
                                        scale: 1.0,
                                        rotation: 0,
                                        zIndex: 1
                                    };
                                    onStickerAdd(newSticker);
                                }
                            },
                        },
                        app,
                        containerNode
                    );

                    containerNode.appendChild(app.canvas);
                    appRef.current = app;
                    gridManagerRef.current = gridManager;

                    setPixiInitialized(true);
                    console.log('[TownGridWebGLV2] PIXI initialized with enhanced grid manager');
                } catch (error) {
                    console.error('[TownGridWebGLV2] Failed to initialize PIXI:', error);
                }
            };

            initPixi();

            return () => {
                isCancelled = true;
                if (appRef.current) {
                    appRef.current.destroy(true);
                    appRef.current = null;
                }
                if (gridManagerRef.current) {
                    gridManagerRef.current.destroy();
                    gridManagerRef.current = null;
                }
                setPixiInitialized(false);
            };
        }
    }, [townData.id]); // Only recreate when town changes, not on UI setting changes

    // Update data when props change
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.updateTownData(townData);
            gridManagerRef.current.updateMaterials(materials);
            gridManagerRef.current.updateStickers(stickers).catch(error => {
                console.error('[TownGridWebGLV2] Failed to update stickers:', error);
            });
            gridManagerRef.current.setTool(tool);
            gridManagerRef.current.setSelectedMaterial(selectedMaterial);

            // Update selected cell
            if (selectedCell) {
                gridManagerRef.current.setSelectedCell({ x: selectedCell.x, y: selectedCell.y });
            } else {
                gridManagerRef.current.setSelectedCell(null);
            }

            // Update background image if provided
            if (backgroundImageUrl && backgroundImageVisible) {
                gridManagerRef.current.setBackgroundImage(
                    backgroundImageUrl,
                    backgroundImageScale,
                    backgroundImageOffsetX,
                    backgroundImageOffsetY
                ).catch(error => {
                    console.error('[TownGridWebGLV2] Failed to set background image:', error);
                });

                // Apply scale and offset separately to ensure they're applied
                gridManagerRef.current.setBackgroundImageScale(backgroundImageScale);
                gridManagerRef.current.setBackgroundImageOffset(backgroundImageOffsetX, backgroundImageOffsetY);
            } else {
                gridManagerRef.current.setBackgroundImage('').catch(error => {
                    console.error('[TownGridWebGLV2] Failed to clear background image:', error);
                });
            }

            // Update layer settings
            gridManagerRef.current.setLayerVisibility('gridLines', showGridLines);
            gridManagerRef.current.setLayerVisibility('stickers', showStickers);
            gridManagerRef.current.setLayerVisibility('backgroundImage', backgroundImageVisible);
        }
    }, [
        pixiInitialized,
        townData,
        materials,
        stickers,
        tool,
        selectedMaterial,
        selectedCell,
        backgroundImageUrl,
        backgroundImageScale,
        backgroundImageOffsetX,
        backgroundImageOffsetY,
        backgroundImageVisible,
        showGridLines,
        showStickers
    ]);

    // Update grid manager configuration when settings change
    useEffect(() => {
        if (gridManagerRef.current) {
            const gridManager = gridManagerRef.current;

            // Update layer configuration
            gridManager.getLayerManager().updateConfig({
                cellSize: CELL_SIZE,
                gridWidth: townData.gridDimensions.width,
                gridHeight: townData.gridDimensions.height,
                viewSettings: {
                    showGridLines: showGridLines,
                },
                gridLineThickness: gridLineThickness,
                gridLineColor: gridLineColor,
            });

            // Update tool and material
            gridManager.setTool(tool);
            gridManager.setSelectedMaterial(selectedMaterial);

            // Update layer visibility
            gridManager.setLayerVisibility('gridLines', showGridLines);
            gridManager.setLayerVisibility('stickers', showStickers);
        }
    }, [showGridLines, gridLineThickness, gridLineColor, tool, selectedMaterial, showStickers]);

    // Handle container resize
    useEffect(() => {
        if (!pixiInitialized || !appRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
            const containerNode = pixiContainerRef.current;
            if (containerNode && appRef.current) {
                const rect = containerNode.getBoundingClientRect();
                appRef.current.renderer.resize(rect.width, rect.height);
            }
        });

        if (pixiContainerRef.current) {
            resizeObserver.observe(pixiContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [pixiInitialized]);

    return (
        <div
            ref={pixiContainerRef}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
                cursor: tool === 'paint' ? 'crosshair' : tool === 'sticker' ? 'copy' : 'grab',
            }}
        />
    );
};

export default TownGridWebGLV2;