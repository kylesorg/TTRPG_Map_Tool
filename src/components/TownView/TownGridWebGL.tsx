import { useRef, useEffect, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import type { TownData, SelectedTownCell } from '../../types/townTypes';
import type { TownMaterial } from '../../types/mapTypes';
import { debounce } from '../../utils/debounce';

const CELL_SIZE = 32; // Defines the base size of a cell in pixels

const getLine = (x0: number, y0: number, x1: number, y1: number): { x: number, y: number }[] => {
    const points: { x: number, y: number }[] = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
        points.push({ x: x0, y: y0 });
        if ((x0 === x1) && (y0 === y1)) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
    return points;
};

interface TownGridWebGLProps {
    townData: TownData;
    selectedCell: SelectedTownCell | null;
    onSelectCell: (cell: SelectedTownCell | null) => void;
    onUpdateCellBatch: (batch: { x: number; y: number; material: string }[]) => void;
    tool: 'select' | 'paint';
    selectedMaterial: TownMaterial | null;
    materials: TownMaterial[];
    onViewChange?: (view: { x: number; y: number; zoom: number }) => void;
    onVisibleCellsChange?: (count: number) => void;
}

const TownGridWebGL: React.FC<TownGridWebGLProps> = ({
    townData,
    selectedCell,
    onSelectCell,
    onUpdateCellBatch,
    tool,
    selectedMaterial,
    materials,
    onViewChange,
    onVisibleCellsChange,
}) => {
    const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
    const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
    const setContainerNodeRef = useCallback((node: HTMLDivElement | null) => {
        if (node) {
            setContainerNode(node);
        }
    }, []);

    const appRef = useRef<PIXI.Application | null>(null);
    const containerRef = useRef<PIXI.Container | null>(null);
    const gridLinesRef = useRef<PIXI.Graphics | null>(null);
    const selectionHighlightRef = useRef<PIXI.Graphics | null>(null);
    const cellSprites = useRef<Map<string, PIXI.Sprite>>(new Map());
    const isPointerDown = useRef(false);
    const didDrag = useRef(false); // Use this to distinguish click from drag
    const isPainting = useRef(false);
    const panStartPoint = useRef({ x: 0, y: 0 });
    const paintedCellsBatchRef = useRef<Map<string, { x: number, y: number, material: string }>>(new Map());
    const lastPaintedCell = useRef<{ x: number, y: number } | null>(null);
    const initialCenteringDone = useRef(false);

    const onViewChangeRef = useRef(onViewChange);
    useEffect(() => {
        onViewChangeRef.current = onViewChange;
    }, [onViewChange]);

    const onVisibleCellsChangeRef = useRef(onVisibleCellsChange);
    useEffect(() => {
        onVisibleCellsChangeRef.current = onVisibleCellsChange;
    }, [onVisibleCellsChange]);

    // This effect synchronizes the parent component with the local view state.
    useEffect(() => {
        if (onViewChangeRef.current) {
            onViewChangeRef.current(view);
        }
    }, [view]);

    const [pixiAppLoaded, setPixiAppLoaded] = useState(false);
    const [cursor, setCursor] = useState('default');

    useEffect(() => {
        setCursor(tool === 'paint' ? 'crosshair' : (isPointerDown.current ? 'grabbing' : 'grab'));
    }, [tool]); // Removed isPointerDown.current as it's a ref and doesn't trigger re-renders


    const getCellFromPointer = useCallback((globalPos: PIXI.Point): { x: number, y: number } | null => {
        if (!containerRef.current || !appRef.current) return null;

        // The globalPos is now relative to the window, need to make it relative to canvas
        const rect = appRef.current.canvas.getBoundingClientRect();
        const canvasPos = new PIXI.Point(globalPos.x - rect.left, globalPos.y - rect.top);

        const localPos = containerRef.current.toLocal(canvasPos);
        const gridX = Math.floor(localPos.x / CELL_SIZE);
        const gridY = Math.floor(localPos.y / CELL_SIZE);

        const { width: townWidth, height: townHeight } = townData.gridDimensions;
        if (gridX >= 0 && gridX < townWidth && gridY >= 0 && gridY < townHeight) {
            return { x: gridX, y: gridY };
        }
        return null;
    }, [townData.gridDimensions]);

    const paintCellLocally = useCallback((x: number, y: number) => {
        if (!selectedMaterial) return;
        const cellKey = `${x},${y}`;

        if (paintedCellsBatchRef.current.has(cellKey)) {
            return; // Already painted in this batch
        }

        const sprite = cellSprites.current.get(cellKey);
        const material = materials.find(m => m.style === selectedMaterial.style);
        if (sprite && material) {
            sprite.tint = new PIXI.Color(material.color).toNumber();
        }
        // Add to batch for state update on pointer up
        paintedCellsBatchRef.current.set(cellKey, { x, y, material: selectedMaterial.style });
    }, [materials, selectedMaterial]);

    const redrawView = useCallback(() => {
        if (!appRef.current || !containerRef.current || !selectionHighlightRef.current || !gridLinesRef.current) {
            return;
        }

        const app = appRef.current;
        const container = containerRef.current;
        container.position.set(view.x, view.y);
        container.scale.set(view.zoom);

        // --- Viewport Culling and Sprite Drawing Logic ---
        const { width: townWidth, height: townHeight } = townData.gridDimensions;
        const cellTexture = PIXI.Texture.WHITE;

        const worldTopLeft = container.toLocal(new PIXI.Point(0, 0));
        const worldBottomRight = container.toLocal(new PIXI.Point(app.screen.width, app.screen.height));

        const xStart = Math.max(0, Math.floor(worldTopLeft.x / CELL_SIZE));
        const xEnd = Math.min(townWidth, Math.ceil(worldBottomRight.x / CELL_SIZE));
        const yStart = Math.max(0, Math.floor(worldTopLeft.y / CELL_SIZE));
        const yEnd = Math.min(townHeight, Math.ceil(worldBottomRight.y / CELL_SIZE));

        const visibleCellKeys = new Set<string>();

        for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
                const cellKey = `${x},${y}`;
                visibleCellKeys.add(cellKey);

                const cellData = townData.grid[cellKey];
                const material = materials.find(m => m.style === cellData?.material) || materials.find(m => m.style === 'default');
                const tint = material ? new PIXI.Color(material.color).toNumber() : 0xFFFFFF;

                let sprite = cellSprites.current.get(cellKey);

                if (!sprite) {
                    sprite = new PIXI.Sprite(cellTexture);
                    sprite.width = CELL_SIZE;
                    sprite.height = CELL_SIZE;
                    sprite.x = x * CELL_SIZE;
                    sprite.y = y * CELL_SIZE;
                    container.addChild(sprite);
                    cellSprites.current.set(cellKey, sprite);
                }

                if (sprite.tint !== tint) {
                    sprite.tint = tint;
                }
                sprite.visible = true;
            }
        }

        cellSprites.current.forEach((sprite, key) => {
            if (!visibleCellKeys.has(key)) {
                sprite.visible = false;
            }
        });

        // Redraw grid lines with culling for performance
        const gridLines = gridLinesRef.current;
        gridLines.clear();
        const lineStyle = { width: 1.5 / view.zoom, color: 0x000000, alpha: 0.4 };

        if (onVisibleCellsChangeRef.current) {
            const visibleCellCount = (xEnd - xStart) * (yEnd - yStart);
            onVisibleCellsChangeRef.current(Math.max(0, visibleCellCount));
        }

        for (let x = xStart; x <= xEnd; x++) {
            gridLines.moveTo(x * CELL_SIZE, yStart * CELL_SIZE);
            gridLines.lineTo(x * CELL_SIZE, yEnd * CELL_SIZE);
        }
        for (let y = yStart; y <= yEnd; y++) {
            gridLines.moveTo(xStart * CELL_SIZE, y * CELL_SIZE);
            gridLines.lineTo(xEnd * CELL_SIZE, y * CELL_SIZE);
        }

        gridLines.stroke(lineStyle);

        const selectionHighlight = selectionHighlightRef.current;
        selectionHighlight.clear();
        if (selectedCell) {
            selectionHighlight.rect(
                selectedCell.x * CELL_SIZE,
                selectedCell.y * CELL_SIZE,
                CELL_SIZE,
                CELL_SIZE
            );
            selectionHighlight.stroke({ width: 3 / view.zoom, color: 0xFFD700, alignment: 0.5 });
        }

        // No longer needed with zIndex sorting
        // if (containerRef.current && gridLinesRef.current && selectionHighlightRef.current) {
        //     containerRef.current.addChild(gridLinesRef.current);
        //     containerRef.current.addChild(selectionHighlightRef.current);
        // }
    }, [view, selectedCell, townData, materials]);

    useEffect(() => {
        let app: PIXI.Application;

        const onWheelLogic = (e: WheelEvent) => {
            e.preventDefault();
            if (!containerRef.current || !containerNode) return;

            const rect = containerNode.getBoundingClientRect();
            const screenPoint = new PIXI.Point(e.clientX - rect.left, e.clientY - rect.top);

            setView(prevView => {
                if (!containerRef.current) return prevView;

                const worldPos = containerRef.current.toLocal(screenPoint);

                let newZoom = prevView.zoom;
                const scaleAmount = 1.1;
                if (e.deltaY < 0) {
                    newZoom *= scaleAmount;
                } else {
                    newZoom /= scaleAmount;
                }
                newZoom = Math.max(0.1, Math.min(newZoom, 10));

                const newContainerX = screenPoint.x - worldPos.x * newZoom;
                const newContainerY = screenPoint.y - worldPos.y * newZoom;

                const newView = { x: newContainerX, y: newContainerY, zoom: newZoom };
                return newView;
            });
        };
        const debouncedOnWheel = debounce(onWheelLogic, 50);

        const initPixi = async () => {
            if (containerNode && !appRef.current) {
                if (containerNode.clientWidth === 0 || containerNode.clientHeight === 0) {
                    console.warn("TownGridWebGL: Container has no dimensions yet. Deferring PIXI init.");
                    setTimeout(initPixi, 100);
                    return;
                }

                app = new PIXI.Application();
                await app.init({
                    width: containerNode.clientWidth,
                    height: containerNode.clientHeight,
                    backgroundColor: 0x1a1a1a,
                    antialias: true,
                    roundPixels: false, // Changed to false to prevent line thickness variations
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true,
                });

                appRef.current = app;
                containerNode.appendChild(app.canvas);

                const newContainer = new PIXI.Container();
                newContainer.sortableChildren = true; // Ensure zIndex is respected
                app.stage.addChild(newContainer);
                containerRef.current = newContainer;

                const newGridLines = new PIXI.Graphics();
                newGridLines.zIndex = 10; // Draw grid lines above cell sprites
                newContainer.addChild(newGridLines);
                gridLinesRef.current = newGridLines;

                const newSelectionHighlight = new PIXI.Graphics();
                newSelectionHighlight.zIndex = 20; // Draw selection highlight above everything
                newContainer.addChild(newSelectionHighlight);
                selectionHighlightRef.current = newSelectionHighlight;

                // Event listeners will be added in a separate useEffect
                containerNode.addEventListener('wheel', debouncedOnWheel, { passive: false });

                setPixiAppLoaded(true);
            }
        };

        initPixi();

        return () => {
            if (containerNode) {
                containerNode.removeEventListener('wheel', debouncedOnWheel);
            }
            const currentApp = appRef.current;
            if (currentApp) {
                currentApp.destroy(true, { children: true, texture: true });
                appRef.current = null;
                containerRef.current = null;
                gridLinesRef.current = null;
                selectionHighlightRef.current = null;
                cellSprites.current.clear();
                setPixiAppLoaded(false);
                initialCenteringDone.current = false;
            }
        };
    }, [containerNode]);

    // Effect for handling resize
    useEffect(() => {
        if (!pixiAppLoaded || !appRef.current || !containerNode) return;
        const app = appRef.current;

        const handleResize = () => {
            if (!app || !app.renderer || !containerNode) return;
            const parentWidth = containerNode.clientWidth;
            const parentHeight = containerNode.clientHeight;
            if (parentWidth > 0 && parentHeight > 0) {
                app.renderer.resize(parentWidth, parentHeight);
                redrawView();
            }
        };

        const resizeObserver = new ResizeObserver(debounce(handleResize, 50));
        resizeObserver.observe(containerNode);
        handleResize(); // Initial call

        return () => resizeObserver.disconnect();
    }, [pixiAppLoaded, containerNode, redrawView]);


    // Effect for Pointer Interactions (Pan, Click, Paint)
    useEffect(() => {
        if (!pixiAppLoaded || !containerNode) return;

        const onPointerDown = (e: PointerEvent) => {
            if (e.target !== appRef.current?.canvas) return;

            isPointerDown.current = true;
            didDrag.current = false;
            panStartPoint.current = { x: e.clientX, y: e.clientY };
            setCursor(tool === 'paint' ? 'crosshair' : 'grabbing');

            if (tool === 'paint') {
                isPainting.current = true;
                paintedCellsBatchRef.current.clear(); // Use clear for Map
                const cell = getCellFromPointer(new PIXI.Point(e.clientX, e.clientY));
                if (cell) {
                    paintCellLocally(cell.x, cell.y);
                    lastPaintedCell.current = cell;
                }
            }
        };

        const onPointerMoveLogic = (e: PointerEvent) => {
            if (!isPointerDown.current) return;

            const dx = e.clientX - panStartPoint.current.x;
            const dy = e.clientY - panStartPoint.current.y;

            if (!didDrag.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                didDrag.current = true;
            }

            if (tool === 'select' && didDrag.current) {
                setView(prevView => {
                    return {
                        x: prevView.x + dx,
                        y: prevView.y + dy,
                        zoom: prevView.zoom
                    };
                });
                panStartPoint.current = { x: e.clientX, y: e.clientY };
            } else if (isPainting.current) {
                const currentCell = getCellFromPointer(new PIXI.Point(e.clientX, e.clientY));
                if (currentCell) {
                    const lastCell = lastPaintedCell.current;
                    if (lastCell && (lastCell.x !== currentCell.x || lastCell.y !== currentCell.y)) {
                        const pointsToPaint = getLine(lastCell.x, lastCell.y, currentCell.x, currentCell.y);
                        pointsToPaint.forEach(p => paintCellLocally(p.x, p.y));
                    } else if (!lastCell) {
                        paintCellLocally(currentCell.x, currentCell.y);
                    }
                    lastPaintedCell.current = currentCell;
                }
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!isPointerDown.current) return;

            // Handle cell selection for the 'select' tool on click
            if (!didDrag.current && tool === 'select') {
                const cell = getCellFromPointer(new PIXI.Point(e.clientX, e.clientY));
                if (cell) {
                    onSelectCell({ ...cell, townId: townData.id });
                } else {
                    onSelectCell(null);
                }
            }

            // Finalize painting action
            if (isPainting.current) {
                if (paintedCellsBatchRef.current.size > 0) {
                    onUpdateCellBatch(Array.from(paintedCellsBatchRef.current.values()));
                }

                // After painting, select the last cell that was painted.
                if (lastPaintedCell.current) {
                    onSelectCell({ ...lastPaintedCell.current, townId: townData.id });
                }

                isPainting.current = false;
                paintedCellsBatchRef.current.clear();
                lastPaintedCell.current = null;
            }

            isPointerDown.current = false;
            didDrag.current = false;
            setCursor(tool === 'paint' ? 'crosshair' : 'grab');
        };

        containerNode.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMoveLogic);
        window.addEventListener('pointerup', onPointerUp);

        return () => {
            containerNode.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMoveLogic);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [pixiAppLoaded, containerNode, tool, getCellFromPointer, paintCellLocally, onSelectCell, onUpdateCellBatch, townData.id]);

    // This effect handles all redraws based on changes to view, selection, or data
    useEffect(() => {
        if (pixiAppLoaded) {
            redrawView();
        }
    }, [pixiAppLoaded, redrawView]);

    // Effect for initial centering
    useEffect(() => {
        if (pixiAppLoaded && appRef.current && !initialCenteringDone.current && townData.gridDimensions.width > 0) {
            // console.log("Running initial centering logic...");

            const screenWidth = appRef.current.screen.width;
            const screenHeight = appRef.current.screen.height;
            const { width: townWidth, height: townHeight } = townData.gridDimensions;

            const initialZoom = 1.0;

            // Calculate the center of the grid in pixels
            const gridPixelWidth = townWidth * CELL_SIZE;
            const gridPixelHeight = townHeight * CELL_SIZE;
            const gridCenterX = gridPixelWidth / 2;
            const gridCenterY = gridPixelHeight / 2;

            // Calculate the view position to center the grid's center in the screen's center
            const newX = (screenWidth / 2) - (gridCenterX * initialZoom);
            const newY = (screenHeight / 2) - (gridCenterY * initialZoom);

            // console.log('Initial centering view:', { x: newX, y: newY, zoom: initialZoom });
            const newView = { x: newX, y: newY, zoom: initialZoom };
            setView(newView);
            initialCenteringDone.current = true;
        }
    }, [pixiAppLoaded, townData.gridDimensions]);

    useEffect(() => {
        if (pixiAppLoaded) {
            redrawView();
        }
    }, [view, selectedCell, pixiAppLoaded, redrawView]);

    return <div ref={setContainerNodeRef} style={{ width: '100%', height: '100%', cursor: cursor }} />;
};

export default TownGridWebGL;
