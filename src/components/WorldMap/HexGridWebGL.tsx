import { useRef, useEffect, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import * as PIXI from 'pixi.js';
import { HexGridManager, type HexGridManagerConfig } from './core/HexGridManager';
import { TILE_SIZE, MAX_ZOOM_LEVEL, HEX_BUFFER } from '../../utils/constants';
import type { HexTile, Biome, DrawingPath } from '../../types/mapTypes';
import type { ToolMode } from '../../types/sharedTypes';
import type { HexOrientation } from '../../utils/hexMath'; // NEW: Import hex orientation type
import type { GeographyImageData } from '../../utils/geographyImageManager';
import { debounce } from '../../utils/debounce';

export interface HexGridWebGLRef {
    cleanupDrawingState: () => void;
}

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
    geographyImage: GeographyImageData | null;
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

const HexGridWebGL = forwardRef<HexGridWebGLRef, HexGridWebGLProps>(({
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
    geographyImage,
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
}, ref) => {
    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const gridManagerRef = useRef<HexGridManager | null>(null);
    const [pixiInitialized, setPixiInitialized] = useState(false);

    // Expose cleanup method to parent component
    useImperativeHandle(ref, () => ({
        cleanupDrawingState: () => {
            if (gridManagerRef.current) {
                gridManagerRef.current.cleanupDrawingState();
            }
        }
    }));

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

                // Expose debug function and grid manager to window after initialization
                (window as any).debugHexCoordinates = () => {
                    if (gridManagerRef.current) {
                        gridManagerRef.current.debugCoordinateRanges();
                    } else {
                        console.log('Grid manager not available');
                    }
                };
                (window as any).debugCoordinatesDetailed = () => {
                    if (gridManagerRef.current) {
                        gridManagerRef.current.debugCoordinatesDetailed();
                    } else {
                        console.log('Grid manager not available');
                    }
                };
                (window as any).hexGridManager = gridManager;

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

    // Update geography image
    useEffect(() => {
        if (pixiInitialized && gridManagerRef.current) {
            gridManagerRef.current.loadGeographyImage(geographyImage, geographyVisible);
        }
    }, [pixiInitialized, geographyImage, geographyVisible]);

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
                // Load background image (only log errors, not normal operation)
                gridManagerRef.current.loadBackgroundImage(backgroundImageUrl).catch(error => {
                    console.error('[HexGridWebGL] Failed to load background image:', error);
                });
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
    }, [pixiInitialized]);    // Dynamic cursor class based on tool mode
    const cursorClass = useMemo(() => {
        console.log(`[HexGridWebGL] Recalculating cursor class - Tool: ${currentTool}, Brush size: ${brushSize}, Erasing: ${isErasing}`);

        if (currentTool === 'geography') {
            // Use the same size-specific cursors for both drawing and erasing
            let cursorClass;
            if (brushSize <= 1.25) {
                cursorClass = 'geography-tool-draw-cursor-small';
            } else if (brushSize <= 3.125) {
                cursorClass = 'geography-tool-draw-cursor-medium';
            } else {
                cursorClass = 'geography-tool-draw-cursor-large';
            }
            console.log(`[HexGridWebGL] Selected cursor class: ${cursorClass} for brush size: ${brushSize}, erasing: ${isErasing}`);
            return cursorClass;
        }
        return '';
    }, [currentTool, isErasing, brushSize]);

    return <div
        ref={pixiContainerRef}
        style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'auto' }}
        className={cursorClass}
    />;
});

HexGridWebGL.displayName = 'HexGridWebGL';

export default HexGridWebGL;