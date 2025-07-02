import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { HexTile as HexTileData, ToolMode } from '../../types/mapTypes';
import HexTileComponent from './HexTile';
import {
    TILE_SIZE,
    INITIAL_VISIBLE_ROWS,
    INITIAL_VISIBLE_COLS,
    HEX_BUFFER,
    GRID_ROWS as APP_GRID_ROWS,
    VIEW_MARGIN_HEXES,
    MAX_ZOOM_LEVEL,
    GRID_COLS as APP_GRID_COLS,
    SIMPLIFIED_HEX_ZOOM_THRESHOLD // Added import
} from '../../utils/constants';
import { axialToPixel, pixelToAxial, userToAxial, type HexOrientation } from '../../utils/hexMath'; // Added userToAxial
import { debounce } from '../../utils/debounce';

interface HexGridProps {
    hexTiles: HexTileData[];
    onHexClick: (hex: HexTileData) => void;
    currentTool: ToolMode;
    onPaintHex: (hex: HexTileData) => void;
    gridRows: number; // Specific rows for this instance of the grid
    gridCols: number; // Specific cols for this instance of the grid
    centerOnUserXY: { x: number; y: number } | null;
    hexOrientation?: HexOrientation;
}

const HexGrid: React.FC<HexGridProps> = ({
    hexTiles,
    onHexClick,
    currentTool,
    onPaintHex,
    gridRows,
    gridCols,
    centerOnUserXY,
    hexOrientation = 'flat-top'
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600 });
    const [isPanning, setIsPanning] = useState(false);
    const [isPainting, setIsPainting] = useState(false);
    const [startPanPoint, setStartPanPoint] = useState({ x: 0, y: 0 });
    const [zoomLevel, setZoomLevel] = useState(1);
    const [minZoomLevel, setMinZoomLevel] = useState(0.01); // State for dynamic minimum zoom
    const [visibleHexes, setVisibleHexes] = useState<HexTileData[]>([]);

    // Debounced version of setViewBox and setZoomLevel to reduce rapid updates
    const debouncedSetViewAndZoom = useCallback(
        debounce((newViewBox: typeof viewBox, newZoom: number) => {
            setViewBox(newViewBox);
            setZoomLevel(newZoom);
            // console.log(`Debounced - Zoom: ${newZoom.toFixed(4)}, ViewBox: x:${newViewBox.x.toFixed(0)} y:${newViewBox.y.toFixed(0)} w:${newViewBox.width.toFixed(0)} h:${newViewBox.height.toFixed(0)}`);
        }, 50),
        []
    );

    // Effect to calculate minimum zoom level to see the whole map + margin
    useEffect(() => {
        console.time('CalculateAndSetMinZoom'); // Start timing
        const calculateAndSetMinZoom = () => {
            if (!svgRef.current || gridRows <= 0 || gridCols <= 0) {
                // console.log("HexGrid: MinZoom calc skipped - no svgRef or invalid grid dimensions");
                return;
            }

            const svgElement = svgRef.current;
            const parentElement = svgElement.parentElement;
            const svgWidth = parentElement ? parentElement.clientWidth : svgElement.clientWidth || 800;
            const svgHeight = parentElement ? parentElement.clientHeight : svgElement.clientHeight || 600;

            if (svgWidth <= 0 || svgHeight <= 0) {
                // console.log("HexGrid: MinZoom calc skipped - SVG dimensions are zero.");
                return;
            }

            const hexOuterWidth = TILE_SIZE * 2;
            const hexOuterHeight = Math.sqrt(3) * TILE_SIZE;

            // Use APP_GRID_COLS and APP_GRID_ROWS for total map size for min zoom calculation
            const colsToFit = APP_GRID_COLS + VIEW_MARGIN_HEXES * 2;
            const rowsToFit = APP_GRID_ROWS + VIEW_MARGIN_HEXES * 2;

            const totalContentPixelWidth = (colsToFit > 1) ? (colsToFit - 1) * (TILE_SIZE * 1.5) + hexOuterWidth : hexOuterWidth;
            const totalContentPixelHeight = (rowsToFit > 1) ? (rowsToFit - 1) * (hexOuterHeight / 2) + hexOuterHeight : hexOuterHeight;

            if (totalContentPixelWidth > 0 && totalContentPixelHeight > 0) {
                const zoomToFitWidth = svgWidth / totalContentPixelWidth;
                const zoomToFitHeight = svgHeight / totalContentPixelHeight;
                const calculatedMinZoom = Math.min(zoomToFitWidth, zoomToFitHeight);

                const newMinZoom = Math.max(0.001, Math.min(calculatedMinZoom, MAX_ZOOM_LEVEL)); // Ensure it's not zero/negative and not > MAX_ZOOM
                setMinZoomLevel(newMinZoom);
                // console.log(`HexGrid: MinZoom Updated. Calculated: ${newMinZoom.toFixed(4)}. SVG: ${svgWidth}x${svgHeight}. Content: ${totalContentPixelWidth.toFixed(0)}x${totalContentPixelHeight.toFixed(0)} for ${colsToFit}x${rowsToFit} hexes (grid: ${APP_GRID_COLS}x${APP_GRID_ROWS}, margin: ${VIEW_MARGIN_HEXES}).`);
            } else {
                // console.log("HexGrid: MinZoom calc skipped - totalContentPixel dimensions are zero or negative.");
            }
        };

        calculateAndSetMinZoom();
        console.timeEnd('CalculateAndSetMinZoom'); // End timing

        const parentEl = svgRef.current?.parentElement;
        let resizeObserver: ResizeObserver | null = null;
        if (parentEl) {
            resizeObserver = new ResizeObserver(calculateAndSetMinZoom);
            resizeObserver.observe(parentEl);
        }
        return () => {
            if (parentEl && resizeObserver) {
                resizeObserver.unobserve(parentEl);
            }
        };
    }, [APP_GRID_ROWS, APP_GRID_COLS, TILE_SIZE, VIEW_MARGIN_HEXES, MAX_ZOOM_LEVEL]); // Use APP_GRID_ROWS/COLS here

    // Calculate initial viewBox
    useEffect(() => {
        if (!svgRef.current || gridRows <= 0 || gridCols <= 0 || minZoomLevel === 0.01) {
            // console.log("HexGrid: Initial ViewBox calc skipped - conditions not met. minZoomLevel:", minZoomLevel);
            return;
        }

        const defaultAxialQ = Math.floor(gridCols / 2); // Center based on current grid instance
        const defaultAxialR = Math.floor(gridRows / 2);
        const { x: pixelCenterX, y: pixelCenterY } = axialToPixel(defaultAxialQ, defaultAxialR, TILE_SIZE);

        const svgElement = svgRef.current;
        const parentElement = svgElement.parentElement;
        const svgWidth = parentElement ? parentElement.clientWidth : svgElement.clientWidth || 800;
        const svgHeight = parentElement ? parentElement.clientHeight : svgElement.clientHeight || 600;

        if (svgWidth === 0 || svgHeight === 0) return;

        const hexWidth = TILE_SIZE * 2;
        const hexHeight = Math.sqrt(3) * TILE_SIZE;
        const initialContentWidth = INITIAL_VISIBLE_COLS * hexWidth * 0.75;
        const initialContentHeight = INITIAL_VISIBLE_ROWS * hexHeight;

        if (initialContentWidth <= 0 || initialContentHeight <= 0) return;

        const zoomToFitWidth = svgWidth / initialContentWidth;
        const zoomToFitHeight = svgHeight / initialContentHeight;
        const newInitialZoom = Math.min(zoomToFitWidth, zoomToFitHeight, MAX_ZOOM_LEVEL);
        const clampedInitialZoom = Math.max(minZoomLevel, Math.min(newInitialZoom, MAX_ZOOM_LEVEL));

        // console.log(`HexGrid: Initial Zoom. NewInitial: ${newInitialZoom.toFixed(4)}, Clamped: ${clampedInitialZoom.toFixed(4)}, Min: ${minZoomLevel.toFixed(4)}, Max: ${MAX_ZOOM_LEVEL}`);

        if (!centerOnUserXY) {
            setZoomLevel(clampedInitialZoom);
        }

        const viewBoxWidth = svgWidth / clampedInitialZoom;
        const viewBoxHeight = svgHeight / clampedInitialZoom;
        const initialViewBoxX = pixelCenterX - viewBoxWidth / 2;
        const initialViewBoxY = pixelCenterY - viewBoxHeight / 2;

        if (!centerOnUserXY) {
            setViewBox({ x: initialViewBoxX, y: initialViewBoxY, width: viewBoxWidth, height: viewBoxHeight });
        }

    }, [gridRows, gridCols, minZoomLevel, MAX_ZOOM_LEVEL, INITIAL_VISIBLE_COLS, INITIAL_VISIBLE_ROWS, TILE_SIZE, centerOnUserXY]);

    // Effect to handle centering the view based on centerOnUserXY prop
    useEffect(() => {
        if (!centerOnUserXY || !svgRef.current || minZoomLevel === 0.01) {
            // if (centerOnUserXY) console.log("HexGrid: centerOnUserXY skipped - svgRef or minZoomLevel not ready.", {centerOnUserXY, minZoomLevel});
            return;
        }

        const targetAxial = userToAxial(centerOnUserXY.x, centerOnUserXY.y, gridRows, gridCols, hexOrientation);
        const { x: targetPixelX, y: targetPixelY } = axialToPixel(targetAxial.q, targetAxial.r, TILE_SIZE);

        const svgElement = svgRef.current;
        const parentElement = svgElement.parentElement;
        const svgWidth = parentElement ? parentElement.clientWidth : svgElement.clientWidth || 800;
        const svgHeight = parentElement ? parentElement.clientHeight : svgElement.clientHeight || 600;

        if (svgWidth === 0 || svgHeight === 0) return;

        const hexWidth = TILE_SIZE * 2;
        const hexHeight = Math.sqrt(3) * TILE_SIZE;
        const focusContentWidth = INITIAL_VISIBLE_COLS * hexWidth * 0.75;
        const focusContentHeight = INITIAL_VISIBLE_ROWS * hexHeight;

        let targetZoom = zoomLevel;

        if (focusContentWidth > 0 && focusContentHeight > 0) {
            const zoomToFitFocus = Math.min(svgWidth / focusContentWidth, svgHeight / focusContentHeight);
            targetZoom = Math.max(minZoomLevel, Math.min(zoomToFitFocus, MAX_ZOOM_LEVEL));
        } else {
            targetZoom = Math.max(minZoomLevel, Math.min(1, MAX_ZOOM_LEVEL));
        }

        setZoomLevel(targetZoom);

        const newViewBoxWidth = svgWidth / targetZoom;
        const newViewBoxHeight = svgHeight / targetZoom;

        const newViewBoxXVal = targetPixelX - newViewBoxWidth / 2;
        const newViewBoxYVal = targetPixelY - newViewBoxHeight / 2;

        // console.log(\`HexGrid: Centering on UserXY (${centerOnUserXY.x},${centerOnUserXY.y}) -> Axial (${targetAxial.q},${targetAxial.r}). New Zoom: ${targetZoom.toFixed(4)}\`);
        setViewBox({
            x: newViewBoxXVal,
            y: newViewBoxYVal,
            width: newViewBoxWidth,
            height: newViewBoxHeight,
        });

    }, [centerOnUserXY, APP_GRID_ROWS, minZoomLevel, MAX_ZOOM_LEVEL, TILE_SIZE, INITIAL_VISIBLE_COLS, INITIAL_VISIBLE_ROWS]); // Removed gridRows, gridCols as APP_GRID_ROWS is used for userToAxial and minZoom calc uses APP_GRID_COLS/ROWS

    // Effect for viewport culling
    useEffect(() => {
        console.time('FilterVisibleHexes');
        console.log(`FilterVisibleHexes: Current Zoom: ${zoomLevel.toFixed(4)}, Simplified Threshold: ${SIMPLIFIED_HEX_ZOOM_THRESHOLD.toFixed(4)}`); // Log zoom and threshold
        if (!hexTiles || hexTiles.length === 0) {
            setVisibleHexes([]);
            console.timeEnd('FilterVisibleHexes');
            return;
        }

        // Viewport boundaries in pixel coordinates
        const vbMinX = viewBox.x - TILE_SIZE * 2; // Add buffer for hex size
        const vbMinY = viewBox.y - TILE_SIZE * 2; // Add buffer for hex size
        const vbMaxX = viewBox.x + viewBox.width + TILE_SIZE * 2; // Add buffer
        const vbMaxY = viewBox.y + viewBox.height + TILE_SIZE * 2; // Add buffer

        // Convert viewport corners to approximate axial coordinates
        const cornersPixel = [
            { x: vbMinX, y: vbMinY },
            { x: vbMaxX, y: vbMinY },
            { x: vbMinX, y: vbMaxY },
            { x: vbMaxX, y: vbMaxY },
        ];

        const cornersAxial = cornersPixel.map(p => pixelToAxial(p.x, p.y, TILE_SIZE));

        let minQ = Math.min(...cornersAxial.map(c => c.q));
        let maxQ = Math.max(...cornersAxial.map(c => c.q));
        let minR = Math.min(...cornersAxial.map(c => c.r));
        let maxR = Math.max(...cornersAxial.map(c => c.r));
        // s = -q-r, so minS = -maxQ-maxR, maxS = -minQ-minR
        let minS = -maxQ - maxR;
        let maxS = -minQ - minR;


        // Expand the axial range by the buffer (already done by pixel buffer, but HEX_BUFFER can be added for axial space)
        minQ -= HEX_BUFFER;
        maxQ += HEX_BUFFER;
        minR -= HEX_BUFFER;
        maxR += HEX_BUFFER;
        minS -= HEX_BUFFER;
        maxS += HEX_BUFFER;


        const filteredHexes = hexTiles.filter(hex => {
            const { q, r, s } = hex.coordinates;
            // Check if the hex is within the expanded bounding box in axial coordinates
            return q >= minQ && q <= maxQ &&
                r >= minR && r <= maxR &&
                s >= minS && s <= maxS; // Check s as well for robustness
        });

        console.log(`Viewport: x: ${viewBox.x.toFixed(0)}, y: ${viewBox.y.toFixed(0)}, w: ${viewBox.width.toFixed(0)}, h: ${viewBox.height.toFixed(0)}`);
        console.log(`Axial range for filtering: Q(${minQ.toFixed(0)}..${maxQ.toFixed(0)}), R(${minR.toFixed(0)}..${maxR.toFixed(0)}), S(${minS.toFixed(0)}..${maxS.toFixed(0)})`);
        // console.log(`Visible hexes after filtering: ${filteredHexes.length} out of ${hexTiles.length}`);
        setVisibleHexes(filteredHexes);
        console.timeEnd('FilterVisibleHexes');
    }, [hexTiles, viewBox, TILE_SIZE, HEX_BUFFER, zoomLevel, SIMPLIFIED_HEX_ZOOM_THRESHOLD]); // Added zoomLevel and SIMPLIFIED_HEX_ZOOM_THRESHOLD to dependencies for logging

    useEffect(() => {
        const handleMouseUpGlobal = () => {
            if (isPainting) setIsPainting(false);
        };
        window.addEventListener('mouseup', handleMouseUpGlobal);
        return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
    }, [isPainting]);

    // Imperatively add wheel event listener to allow specifying passive: false
    useEffect(() => {
        const svgElement = svgRef.current;
        if (!svgElement) return;

        const wheelHandler = (event: WheelEvent) => {
            event.preventDefault();
            const scaleAmount = 1.1;

            const point = svgElement.createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            const svgPoint = point.matrixTransform(svgElement.getScreenCTM()?.inverse());


            let newZoomLevelCalc = zoomLevel;
            if (event.deltaY < 0) { // Zoom in
                newZoomLevelCalc = zoomLevel * scaleAmount;
            } else { // Zoom out
                newZoomLevelCalc = zoomLevel / scaleAmount;
            }

            newZoomLevelCalc = Math.max(minZoomLevel, Math.min(newZoomLevelCalc, MAX_ZOOM_LEVEL));

            // console.log(\`Wheel Zoom: Target: ${newZoomLevelCalc.toFixed(4)}, Current: ${zoomLevel.toFixed(4)}, MinCalc: ${minZoomLevel.toFixed(4)}, MaxConst: ${MAX_ZOOM_LEVEL}\`);

            const newWidth = viewBox.width * (zoomLevel / newZoomLevelCalc);
            const newHeight = viewBox.height * (zoomLevel / newZoomLevelCalc);
            const dx = (svgPoint.x - viewBox.x) * (1 - zoomLevel / newZoomLevelCalc);
            const dy = (svgPoint.y - viewBox.y) * (1 - zoomLevel / newZoomLevelCalc);

            const newViewBox = {
                x: viewBox.x + dx,
                y: viewBox.y + dy,
                width: newWidth,
                height: newHeight,
            };

            debouncedSetViewAndZoom(newViewBox, newZoomLevelCalc);
        };

        svgElement.addEventListener('wheel', wheelHandler, { passive: false });

        return () => {
            svgElement.removeEventListener('wheel', wheelHandler);
        };
    }, [zoomLevel, viewBox, debouncedSetViewAndZoom, minZoomLevel, MAX_ZOOM_LEVEL]);

    const handleSvgMouseDown = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
        // Only allow panning if the click is directly on the SVG background
        // and not in a mode that would interact with hexes on mousedown (like paintBiome).
        // HexTile components should stop propagation for their own mousedown events.
        if (event.target === svgRef.current && currentTool !== 'paint') {
            setIsPanning(true);
            setStartPanPoint({ x: event.clientX, y: event.clientY });
        }
    }, [currentTool]);

    const handleSvgMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
        if (!isPanning) return;
        const dx = (event.clientX - startPanPoint.x) / zoomLevel;
        const dy = (event.clientY - startPanPoint.y) / zoomLevel;
        setViewBox(prev => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
        setStartPanPoint({ x: event.clientX, y: event.clientY });
    }, [isPanning, startPanPoint, zoomLevel]);

    const handleSvgMouseUpOrLeave = useCallback(() => {
        if (isPanning) setIsPanning(false);
    }, [isPanning]);

    const handleTileClick = useCallback((hex: HexTileData, event: React.MouseEvent) => {
        event.stopPropagation();
        if (currentTool === 'select') onHexClick(hex);
        else if (currentTool === 'paint') onPaintHex(hex);
    }, [currentTool, onHexClick, onPaintHex]);

    const handleTileMouseDown = useCallback((hex: HexTileData, event: React.MouseEvent) => {
        event.stopPropagation();
        if (currentTool === 'paint') {
            setIsPainting(true);
            onPaintHex(hex);
        } else if (currentTool === 'select') {
            // Allow panning when select tool is active and mouse is pressed down on a hex
            setIsPanning(true);
            setStartPanPoint({ x: event.clientX, y: event.clientY });
        }
    }, [currentTool, onPaintHex, setIsPanning, setStartPanPoint]); // Added setIsPanning and setStartPanPoint to dependencies

    const handleTileMouseEnter = useCallback((hex: HexTileData, event: React.MouseEvent) => {
        if (isPainting && currentTool === 'paint' && (event.buttons === 1)) {
            onPaintHex(hex);
        }
    }, [isPainting, currentTool, onPaintHex]);

    const currentViewBoxString = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;

    console.time('RenderSVG');
    // console.log(`Rendering ${visibleHexes.length} hexes. Zoom: ${zoomLevel.toFixed(4)}`); // Added zoom level to render log
    const renderedSVG = (
        <svg
            ref={svgRef}
            viewBox={currentViewBoxString}
            onMouseDown={handleSvgMouseDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUpOrLeave}
            onMouseLeave={handleSvgMouseUpOrLeave}
            style={{ cursor: isPanning ? 'grabbing' : (currentTool === 'paint' ? 'crosshair' : 'grab') }}
        >
            <g>
                {visibleHexes.map((hex) => (
                    <HexTileComponent
                        key={hex.id}
                        tile={hex}
                        onClick={handleTileClick}
                        onMouseDown={handleTileMouseDown}
                        onMouseEnter={handleTileMouseEnter}
                        currentZoomLevel={zoomLevel} // Pass current zoom level
                    />
                ))}
            </g>
        </svg>
    );
    console.timeEnd('RenderSVG');
    return renderedSVG;
};

export default HexGrid;
