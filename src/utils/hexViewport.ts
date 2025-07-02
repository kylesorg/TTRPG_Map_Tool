import * as PIXI from 'pixi.js';
import { updateContainerTransforms } from './pixiHelpers';

export interface ViewportState {
    zoom: number;
    position: { x: number, y: number };
}

export class HexViewport {
    private containers: Array<PIXI.Container | null> = [];
    private zoom: number = 1;
    private minZoom: number = 0.09;
    private maxZoom: number = 10;

    constructor(
        containers: Array<PIXI.Container | null>,
        options: {
            minZoom?: number;
            maxZoom?: number;
            initialZoom?: number;
        } = {}
    ) {
        this.containers = containers;
        this.minZoom = options.minZoom ?? 0.09;
        this.maxZoom = options.maxZoom ?? 10;
        this.zoom = options.initialZoom ?? 1;
    }

    /**
     * Updates the containers managed by this viewport
     */
    setContainers(containers: Array<PIXI.Container | null>): void {
        this.containers = containers;
    }

    /**
     * Gets current zoom level
     */
    getZoom(): number {
        return this.zoom;
    }

    /**
     * Sets zoom level with bounds checking
     */
    setZoom(newZoom: number): number {
        this.zoom = Math.max(this.minZoom, Math.min(newZoom, this.maxZoom));
        return this.zoom;
    }

    /**
     * Handles wheel zoom with focal point
     */
    handleWheelZoom(
        event: WheelEvent,
        focalContainer: PIXI.Container
    ): { zoom: number, position: { x: number, y: number } } {
        const point = new PIXI.Point(event.offsetX, event.offsetY);
        const worldPos = focalContainer.toLocal(point);

        const scaleAmount = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = this.setZoom(this.zoom * scaleAmount);

        const newX = event.offsetX - worldPos.x * newZoom;
        const newY = event.offsetY - worldPos.y * newZoom;

        this.updateContainers({ x: newX, y: newY }, newZoom);

        return {
            zoom: newZoom,
            position: { x: newX, y: newY }
        };
    }

    /**
     * Centers the viewport on a specific world position
     */
    centerOn(
        worldPosition: { x: number, y: number },
        screenSize: { width: number, height: number }
    ): { x: number, y: number } {
        const newX = (screenSize.width / 2) - (worldPosition.x * this.zoom);
        const newY = (screenSize.height / 2) - (worldPosition.y * this.zoom);

        this.updateContainers({ x: newX, y: newY });

        return { x: newX, y: newY };
    }

    /**
     * Pans the viewport by a delta amount
     */
    pan(delta: { x: number, y: number }): void {
        this.containers.forEach(container => {
            if (container) {
                container.position.set(
                    container.position.x + delta.x,
                    container.position.y + delta.y
                );
            }
        });
    }

    /**
     * Updates all containers with new position and scale
     */
    updateContainers(position: { x: number, y: number }, scale?: number): void {
        updateContainerTransforms(this.containers, position, scale ?? this.zoom);
    }

    /**
     * Gets the current viewport state
     */
    getState(): ViewportState {
        const firstContainer = this.containers.find(c => c !== null);
        return {
            zoom: this.zoom,
            position: firstContainer ?
                { x: firstContainer.position.x, y: firstContainer.position.y } :
                { x: 0, y: 0 }
        };
    }

    /**
     * Checks if a position would move containers too far off-screen
     */
    isPositionValid(
        position: { x: number, y: number },
        screenSize: { width: number, height: number },
        maxOffscreenMultiplier: number = 2
    ): boolean {
        const maxOffscreen = Math.max(screenSize.width, screenSize.height) * maxOffscreenMultiplier;
        return Math.abs(position.x) <= maxOffscreen && Math.abs(position.y) <= maxOffscreen;
    }
}
