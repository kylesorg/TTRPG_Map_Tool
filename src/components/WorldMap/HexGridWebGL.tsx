import React, { useRef, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import { HexGridManager, type HexGridManagerConfig } from './core/HexGridManager';
import { TILE_SIZE, MAX_ZOOM_LEVEL, HEX_BUFFER } from '../../utils/constants';
import type { HexTile, Biome, DrawingPath } from '../../types/mapTypes';
import type { ToolMode } from '../../types/sharedTypes';
import type { HexOrientation } from '../../utils/hexMath'; // NEW: Import hex orientation type
import { debounce } from '../../utils/debounce';

export interface HexGridWebGLProps {
    hexTiles: HexTile[];
    onHexClick: (hex: HexTile) => void;
    currentTool: ToolMode;
    onPaintHexBatch: (batch: Array<{ hexId: string }>, tool: ToolMode) => void;
    onPaintComplete: (lastPaintedHex: HexTile) => void;
    selectedBiome: Biome | null;
    actualSelectedHexId?: string | null;
    onVisibleHexesChange?: (count: number, zoom: number) => void;
    centerOnHexId?: string | null;
    onCentered?: () => void;
    drawingLayer: DrawingPath[];
    viewSettings: {
        showTownNames: boolean;
    };
    onNewPath: (newPath: DrawingPath) => void;
    onErasePaths?: (erasePoint: { x: number; y: number }, eraseRadius: number) => void;
    brushSize: number;
    brushColor: string;
    isErasing: boolean;
    // New props for layer visibility and styling
    gridLinesVisible: boolean;
    gridLineThickness: number;
    gridLineColor: string;
    geographyVisible: boolean;
    textScale: number;
    // Background image props
    backgroundImageUrl: string | null;
    backgroundImageScale: number;
    backgroundImageOffsetX: number;
    backgroundImageOffsetY: number;
    backgroundImageVisible: boolean;
    // NEW: Hex orientation prop
    hexOrientation?: HexOrientation;
}

const HexGridWebGL: React.FC<HexGridWebGLProps> = React.memo(({
    hexTiles,
    onHexClick,
    currentTool,
    onPaintHexBatch,
    onPaintComplete,
    actualSelectedHexId,
    onVisibleHexesChange,
    centerOnHexId,
    onCentered,
    drawingLayer,
    viewSettings,
    onNewPath,
    onErasePaths,
    brushSize,
    brushColor,
    isErasing,
    gridLinesVisible,
    gridLineThickness,
    gridLineColor,
    geographyVisible,
    textScale,
    // Background image props
    backgroundImageUrl,
    backgroundImageScale,
    backgroundImageOffsetX,
    backgroundImageOffsetY,
    backgroundImageVisible,
    hexOrientation, // NEW: Destructure hexOrientation prop
}) => {
    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const gridManagerRef = useRef<HexGridManager | null>(null);
    const [pixiInitialized, setPixiInitialized] = useState(false);

    // Effect to update cursor style - no longer needed since we use CSS classes
    // The cursor is now controlled by the className on the container div

    // --- PIXI Initialization Effect ---
    useEffect(() => {
        const containerNode = pixiContainerRef.current;
        if (containerNode && !appRef.current) {
            let isCancelled = false;
            const app = new PIXI.Application();

            const initPixi = async () => {
                if (isCancelled) return;

                // Wait for container to have proper dimensions
                while (containerNode.clientWidth === 0 || containerNode.clientHeight === 0) {
                    if (isCancelled) return;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                if (isCancelled) return;

                await app.init({
                    resizeTo: containerNode,
                    backgroundColor: 0xFFFFFF,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true,
                    antialias: true,
                });

                if (isCancelled) return;

                // Create and initialize the hex grid manager
                const gridManagerConfig: HexGridManagerConfig = {
                    tileSize: TILE_SIZE,
                    maxZoomLevel: MAX_ZOOM_LEVEL,
                    hexBuffer: HEX_BUFFER,
                    viewSettings,
                    gridLineThickness,
                    gridLineColor,
                    textScale,
                    hexOrientation: hexOrientation || 'flat-top', // NEW: Pass hex orientation
                    onHexClick,
                    onPaintHexBatch,
                    onPaintComplete,
                    onNewPath,
                    onErasePaths,
                    onVisibleHexesChange,
                };

                const gridManager = new HexGridManager(app, containerNode, gridManagerConfig);
                await gridManager.initialize();

                if (containerNode && app.canvas && !isCancelled) {
                    containerNode.appendChild(app.canvas);
                }

                appRef.current = app;
                gridManagerRef.current = gridManager;
                setPixiInitialized(true);
            };

            initPixi().catch(err => {
                if (!isCancelled) console.error("[HexGridWebGL_Init] Error initializing PIXI:", err);
            });

            return () => {
                isCancelled = true;
                if (gridManagerRef.current) {
                    gridManagerRef.current.destroy();
                    gridManagerRef.current = null;
                }
                if (app.renderer) {
                    app.destroy(true, { children: true, texture: true });
                }
                if (appRef.current === app) {
                    appRef.current = null;
                }
                setPixiInitialized(false);
            };
        }
    }, []); // Empty dependency array ensures this runs only once on mount/unmount

    // Update hex tiles
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setHexTiles(hexTiles);
        }
    }, [pixiInitialized, hexTiles]);

    // Handle hex orientation changes (NEW)
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current && hexOrientation) {
            gridManagerRef.current.setHexOrientation(hexOrientation);
            gridManagerRef.current.updateOrientation(hexOrientation);
        }
    }, [pixiInitialized, hexOrientation]);

    // Handle tool changes
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setCurrentTool(currentTool);
        }
    }, [pixiInitialized, currentTool]);

    // Update selected hex
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setSelectedHex(actualSelectedHexId || null);
        }
    }, [pixiInitialized, actualSelectedHexId]);

    // Update view settings
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.updateViewSettings(viewSettings);
        }
    }, [pixiInitialized, viewSettings]);

    // Update grid lines visibility
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setGridLinesVisible(gridLinesVisible);
        }
    }, [pixiInitialized, gridLinesVisible]);

    // Update geography visibility
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setGeographyVisible(geographyVisible);
        }
    }, [pixiInitialized, geographyVisible]);

    // Update drawing paths
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.renderDrawingPaths(drawingLayer, geographyVisible);
        }
    }, [pixiInitialized, drawingLayer, geographyVisible]);

    // Update grid line thickness
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setGridLineThickness(gridLineThickness);
        }
    }, [pixiInitialized, gridLineThickness]);

    // Update grid line color
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setGridLineColor(gridLineColor);
        }
    }, [pixiInitialized, gridLineColor]);

    // Update text scale
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setTextScale(textScale);
        }
    }, [pixiInitialized, textScale]);

    // Load background image
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            if (backgroundImageUrl) {
                gridManagerRef.current.loadBackgroundImage(backgroundImageUrl);
            } else {
                // Clear background image when URL is null
                gridManagerRef.current.clearBackgroundImage();
            }
        }
    }, [pixiInitialized, backgroundImageUrl]);

    // Update background image visibility
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setBackgroundImageVisible(backgroundImageVisible);
        }
    }, [pixiInitialized, backgroundImageVisible]);

    // Update background image scale
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setBackgroundImageScale(backgroundImageScale);
        }
    }, [pixiInitialized, backgroundImageScale]);

    // Update background image offset
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setBackgroundImageOffset(backgroundImageOffsetX, backgroundImageOffsetY);
        }
    }, [pixiInitialized, backgroundImageOffsetX, backgroundImageOffsetY]);

    // Handle centering on hex
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current && centerOnHexId && hexTiles.length > 0) {
            // Add a small delay to ensure all initialization is complete
            const timeoutId = setTimeout(() => {
                if (gridManagerRef.current) {
                    gridManagerRef.current.centerOnHex(centerOnHexId);
                    onCentered?.();
                }
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [pixiInitialized, centerOnHexId, onCentered, hexTiles.length]);

    // Update brush settings
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.setBrushSettings(brushColor, brushSize, isErasing);
        }
    }, [pixiInitialized, brushColor, brushSize, isErasing]);

    // Handle resize
    useEffect(() => {
        const containerNode = pixiContainerRef.current;
        const app = appRef.current;
        if (!pixiInitialized || !app || !containerNode) return;

        const handleResize = () => {
            const parentWidth = containerNode.clientWidth;
            const parentHeight = containerNode.clientHeight;
            if (parentWidth > 0 && parentHeight > 0) {
                app.renderer.resize(parentWidth, parentHeight);
                if (gridManagerRef.current) {
                    gridManagerRef.current.handleResize();
                }
            }
        };

        const resizeObserver = new ResizeObserver(debounce(handleResize, 50));
        resizeObserver.observe(containerNode);
        handleResize(); // Initial call

        return () => resizeObserver.disconnect();
    }, [pixiInitialized]);

    // Dynamic cursor class based on tool mode
    const getCursorClass = () => {
        if (currentTool === 'geography') {
            return isErasing ? 'geography-tool-erase-cursor' : 'geography-tool-draw-cursor';
        }
        return '';
    };

    return <div
        ref={pixiContainerRef}
        style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'auto' }}
        className={getCursorClass()}
    />;
});

export default HexGridWebGL;