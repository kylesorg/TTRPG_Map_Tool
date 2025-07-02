import * as PIXI from 'pixi.js';
import { debounce } from '../../../utils/debounce';

export type TownToolMode = 'select' | 'paint' | 'sticker' | 'pan';

export interface TownViewportConfig {
    maxZoomLevel: number;
    minZoomLevel?: number;
    panSpeed?: number;
    zoomSpeed?: number;
    onViewportChange?: () => void;
    onPanStateChange?: (isPanning: boolean, didPan: boolean) => void;
}

export interface TownViewportState {
    panPosition: { x: number; y: number };
    zoomLevel: number;
    isPanning: boolean;
    didPan: boolean;
}

export class TownViewportManager {
    private config: TownViewportConfig;
    private state: TownViewportState;
    private containers: PIXI.Container[];
    private containerNode: HTMLElement;
    private debouncedViewportChange: () => void;
    private currentTool: TownToolMode = 'select';

    // Pan state
    private lastPointerPosition: { x: number; y: number } = { x: 0, y: 0 };
    private panStartPosition: { x: number; y: number } = { x: 0, y: 0 };

    // Performance optimization - direct container updates
    private needsTransformUpdate = false;
    private animationFrameId: number | null = null;

    constructor(config: TownViewportConfig, containers: PIXI.Container[], containerNode: HTMLElement) {
        this.config = {
            minZoomLevel: 0.1,
            panSpeed: 1,
            zoomSpeed: 0.001,
            ...config
        };
        this.containers = containers;
        this.containerNode = containerNode;

        this.state = {
            panPosition: { x: 0, y: 0 },
            zoomLevel: 1,
            isPanning: false,
            didPan: false
        };

        // Use debounced callback for expensive operations like cell visibility updates
        this.debouncedViewportChange = debounce(() => {
            if (this.config.onViewportChange) {
                this.config.onViewportChange();
            }
        }, 150); // Slightly faster than hex map since town maps are smaller

        // Start the RAF loop for smooth container updates
        this.startRenderLoop();
    }

    /**
     * Updates the containers being managed by the viewport
     */
    setContainers(containers: PIXI.Container[]): void {
        this.containers = containers;
    }

    /**
     * Updates the current tool (affects panning behavior)
     */
    setCurrentTool(tool: TownToolMode): void {
        this.currentTool = tool;
    }

    /**
     * Gets the current viewport state
     */
    getState(): TownViewportState {
        return { ...this.state };
    }

    /**
     * Starts the RAF loop for smooth container transform updates
     */
    private startRenderLoop(): void {
        const renderLoop = () => {
            if (this.needsTransformUpdate) {
                this.updateContainerTransforms();
                this.needsTransformUpdate = false;
            }
            this.animationFrameId = requestAnimationFrame(renderLoop);
        };
        this.animationFrameId = requestAnimationFrame(renderLoop);
    }

    /**
     * Schedules a container transform update on the next animation frame
     */
    private scheduleTransformUpdate(): void {
        this.needsTransformUpdate = true;
    }

    /**
     * Sets up DOM event listeners for viewport controls
     */
    setupEventListeners(): () => void {
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            this.handleWheel(event);
        };

        const onPanStart = (event: PointerEvent) => {
            this.handlePanStart(event);
        };

        const onPanMove = (event: PointerEvent) => {
            this.handlePanMove(event);
        };

        const onPanEnd = (event: PointerEvent) => {
            this.handlePanEnd(event);
        };

        const preventContextMenu = (event: MouseEvent) => {
            event.preventDefault();
        };

        // Attach listeners
        this.containerNode.addEventListener('wheel', handleWheel, { passive: false });
        this.containerNode.addEventListener('pointerdown', onPanStart);
        this.containerNode.addEventListener('contextmenu', preventContextMenu);
        window.addEventListener('pointermove', onPanMove);
        window.addEventListener('pointerup', onPanEnd);

        // Return cleanup function
        return () => {
            this.containerNode.removeEventListener('wheel', handleWheel);
            this.containerNode.removeEventListener('pointerdown', onPanStart);
            this.containerNode.removeEventListener('contextmenu', preventContextMenu);
            window.removeEventListener('pointermove', onPanMove);
            window.removeEventListener('pointerup', onPanEnd);
        };
    }

    /**
     * Handles wheel events for zooming
     */
    private handleWheel(event: WheelEvent): void {
        const delta = -event.deltaY * this.config.zoomSpeed!;
        const newZoom = Math.max(this.config.minZoomLevel!, Math.min(this.config.maxZoomLevel, this.state.zoomLevel + delta));

        if (newZoom !== this.state.zoomLevel) {
            // Get mouse position relative to container
            const rect = this.containerNode.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Calculate zoom point in world coordinates
            const worldX = (mouseX - this.state.panPosition.x) / this.state.zoomLevel;
            const worldY = (mouseY - this.state.panPosition.y) / this.state.zoomLevel;

            // Update zoom level
            this.state.zoomLevel = newZoom;

            // Adjust pan position to keep zoom point under mouse
            this.state.panPosition.x = mouseX - worldX * this.state.zoomLevel;
            this.state.panPosition.y = mouseY - worldY * this.state.zoomLevel;

            this.scheduleTransformUpdate();
            this.debouncedViewportChange();
        }
    }

    /**
     * Handles pan start
     */
    private handlePanStart(event: PointerEvent): void {
        // Allow panning with:
        // - Right-click (button 2) or middle-click (button 1) always
        // - Left-click (button 0) when in select mode or pan tool
        const isLeftClick = event.button === 0;
        const isMiddleOrRightClick = event.button === 1 || event.button === 2;
        const canPan = isMiddleOrRightClick || (isLeftClick && (this.currentTool === 'select' || this.currentTool === 'pan'));

        if (canPan) {
            if (event.button === 2) {
                event.preventDefault(); // Prevent context menu on right-click
            }
            this.state.isPanning = true;
            this.state.didPan = false;
            this.lastPointerPosition = { x: event.clientX, y: event.clientY };
            this.panStartPosition = { x: event.clientX, y: event.clientY };

            // Notify pan state change
            if (this.config.onPanStateChange) {
                this.config.onPanStateChange(this.state.isPanning, this.state.didPan);
            }
        }
    }

    /**
     * Handles pan move
     */
    private handlePanMove(event: PointerEvent): void {
        if (!this.state.isPanning) return;

        const deltaX = event.clientX - this.lastPointerPosition.x;
        const deltaY = event.clientY - this.lastPointerPosition.y;

        this.state.panPosition.x += deltaX * this.config.panSpeed!;
        this.state.panPosition.y += deltaY * this.config.panSpeed!;

        this.lastPointerPosition = { x: event.clientX, y: event.clientY };

        // Check if we've moved enough to consider this a pan
        const totalDelta = Math.abs(event.clientX - this.panStartPosition.x) + Math.abs(event.clientY - this.panStartPosition.y);
        if (totalDelta > 5) {
            this.state.didPan = true;

            // Notify pan state change when we start actually panning
            if (this.config.onPanStateChange) {
                this.config.onPanStateChange(this.state.isPanning, this.state.didPan);
            }
        }

        // Update transforms immediately on RAF, viewport changes debounced
        this.scheduleTransformUpdate();
        this.debouncedViewportChange();
    }

    /**
     * Handles pan end
     */
    private handlePanEnd(_event: PointerEvent): void {
        if (this.state.isPanning) {
            this.state.isPanning = false;
            // Notify pan state change
            if (this.config.onPanStateChange) {
                this.config.onPanStateChange(this.state.isPanning, this.state.didPan);
            }

            // Trigger an immediate viewport update when panning stops
            // This ensures cell visibility is updated promptly when user stops panning
            if (this.state.didPan && this.config.onViewportChange) {
                this.config.onViewportChange();
            }

            // Reset didPan after a short delay to allow other systems to use it
            setTimeout(() => {
                this.state.didPan = false;
                if (this.config.onPanStateChange) {
                    this.config.onPanStateChange(this.state.isPanning, this.state.didPan);
                }
            }, 100);
        }
    }

    /**
     * Centers the viewport on a specific world position
     */
    centerOn(worldX: number, worldY: number, screenWidth: number, screenHeight: number): void {
        if (screenWidth <= 0 || screenHeight <= 0) {
            console.warn('[TownViewportManager] Invalid screen dimensions, cannot center properly');
            return;
        }

        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2;

        this.state.panPosition.x = centerX - worldX * this.state.zoomLevel;
        this.state.panPosition.y = centerY - worldY * this.state.zoomLevel;

        this.scheduleTransformUpdate();
    }

    /**
     * Sets the zoom level
     */
    setZoom(zoomLevel: number): void {
        this.state.zoomLevel = Math.max(this.config.minZoomLevel!, Math.min(this.config.maxZoomLevel, zoomLevel));
        this.updateContainerTransforms();
    }

    /**
     * Gets the visible bounds in world coordinates for cell culling
     */
    getVisibleBounds(screenWidth: number, screenHeight: number): { minX: number; maxX: number; minY: number; maxY: number } {
        const minX = -this.state.panPosition.x / this.state.zoomLevel;
        const minY = -this.state.panPosition.y / this.state.zoomLevel;
        const maxX = (screenWidth - this.state.panPosition.x) / this.state.zoomLevel;
        const maxY = (screenHeight - this.state.panPosition.y) / this.state.zoomLevel;

        return { minX, minY, maxX, maxY };
    }

    /**
     * Gets visible cell bounds for square grid culling
     */
    getVisibleCellBounds(screenWidth: number, screenHeight: number, cellSize: number): {
        minCellX: number; maxCellX: number; minCellY: number; maxCellY: number;
    } {
        const bounds = this.getVisibleBounds(screenWidth, screenHeight);

        return {
            minCellX: Math.floor(bounds.minX / cellSize),
            maxCellX: Math.ceil(bounds.maxX / cellSize),
            minCellY: Math.floor(bounds.minY / cellSize),
            maxCellY: Math.ceil(bounds.maxY / cellSize)
        };
    }

    /**
     * Updates the position and scale of all managed containers
     */
    private updateContainerTransforms(): void {
        this.containers.forEach(container => {
            if (container) {
                container.position.set(this.state.panPosition.x, this.state.panPosition.y);
                container.scale.set(this.state.zoomLevel);
            }
        });
    }

    /**
     * Converts screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        const worldX = (screenX - this.state.panPosition.x) / this.state.zoomLevel;
        const worldY = (screenY - this.state.panPosition.y) / this.state.zoomLevel;
        return { x: worldX, y: worldY };
    }

    /**
     * Converts world coordinates to screen coordinates
     */
    worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
        const screenX = worldX * this.state.zoomLevel + this.state.panPosition.x;
        const screenY = worldY * this.state.zoomLevel + this.state.panPosition.y;
        return { x: screenX, y: screenY };
    }

    /**
     * Converts world coordinates to cell coordinates
     */
    worldToCell(worldX: number, worldY: number, cellSize: number): { x: number; y: number } {
        return {
            x: Math.floor(worldX / cellSize),
            y: Math.floor(worldY / cellSize)
        };
    }

    /**
     * Converts cell coordinates to world coordinates
     */
    cellToWorld(cellX: number, cellY: number, cellSize: number): { x: number; y: number } {
        return {
            x: cellX * cellSize,
            y: cellY * cellSize
        };
    }

    /**
     * Cleans up the viewport manager
     */
    destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}
