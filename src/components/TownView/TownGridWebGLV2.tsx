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
    tool: 'select' | 'paint';
    selectedMaterial: TownMaterial | null;
    materials: TownMaterial[];
    onViewChange?: (view: { x: number; y: number; zoom: number }) => void;
    onVisibleCellsChange?: (count: number) => void;
    // New props for enhanced functionality
    stickers?: TownSticker[];
    onStickerPlace?: (sticker: TownSticker) => void;
    backgroundImageUrl?: string;
    backgroundImageScale?: number;
    backgroundImageOffsetX?: number;
    backgroundImageOffsetY?: number;
    // Layer visibility controls
    showGridLines?: boolean;
    showStickers?: boolean;
    gridLineThickness?: number;
    gridLineColor?: string;
}

const TownGridWebGLV2: React.FC<TownGridWebGLV2Props> = ({
    townData,
    onSelectCell,
    onUpdateCellBatch,
    tool,
    selectedMaterial,
    materials,
    stickers = [],
    onStickerPlace,
    backgroundImageUrl,
    backgroundImageScale = 1,
    backgroundImageOffsetX = 0,
    backgroundImageOffsetY = 0,
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
                            onStickerPlace: onStickerPlace,
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
    }, [townData.id, showGridLines, gridLineThickness, gridLineColor, onSelectCell, onUpdateCellBatch, onStickerPlace, tool]);

    // Update data when props change
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.updateTownData(townData);
            gridManagerRef.current.updateMaterials(materials);
            gridManagerRef.current.updateStickers(stickers);
            gridManagerRef.current.setTool(tool);
            gridManagerRef.current.setSelectedMaterial(selectedMaterial);

            // Update background image if provided
            if (backgroundImageUrl) {
                gridManagerRef.current.setBackgroundImage(
                    backgroundImageUrl,
                    backgroundImageScale,
                    backgroundImageOffsetX,
                    backgroundImageOffsetY
                );
            }

            // Update layer settings
            gridManagerRef.current.setLayerVisibility('gridLines', showGridLines);
            gridManagerRef.current.setLayerVisibility('stickers', showStickers);
        }
    }, [
        pixiInitialized,
        townData,
        materials,
        stickers,
        tool,
        selectedMaterial,
        backgroundImageUrl,
        backgroundImageScale,
        backgroundImageOffsetX,
        backgroundImageOffsetY,
        showGridLines,
        showStickers
    ]);

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
                cursor: tool === 'paint' ? 'crosshair' : 'grab',
            }}
        />
    );
};

export default TownGridWebGLV2;