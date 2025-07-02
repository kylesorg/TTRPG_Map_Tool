import * as PIXI from 'pixi.js';

/**
 * Creates and configures a PIXI container with common settings
 */
export function createContainer(name: string, zIndex: number): PIXI.Container {
    const container = new PIXI.Container();
    container.sortableChildren = true;
    container.zIndex = zIndex;
    (container as any).label = name; // Add label for debugging
    return container;
}

/**
 * Ensures containers are properly added to stage and configured
 */
export function ensureContainersOnStage(
    app: PIXI.Application,
    containers: Array<{ ref: React.MutableRefObject<PIXI.Container | null>, name: string, zIndex: number }>
): void {
    app.stage.sortableChildren = true;

    containers.forEach(({ ref, name, zIndex }) => {
        if (!ref.current) {
            ref.current = createContainer(name, zIndex);
        }
        if (!app.stage.children.includes(ref.current)) {
            app.stage.addChild(ref.current);
        }
    });
}

/**
 * Updates positions and scales for multiple containers
 */
export function updateContainerTransforms(
    containers: Array<PIXI.Container | null>,
    position: { x: number, y: number },
    scale?: number
): void {
    containers.forEach(container => {
        if (container) {
            container.position.set(position.x, position.y);
            if (scale !== undefined) {
                container.scale.set(scale);
            }
        }
    });
}

/**
 * Safely destroys a PIXI object with proper cleanup
 */
export function safeDestroy(object: PIXI.Container | PIXI.Sprite | null, options?: { children?: boolean, texture?: boolean }): void {
    if (object) {
        object.destroy(options);
    }
}

/**
 * Creates a basic white background rectangle
 */
export function createBackgroundRect(width: number, height: number): PIXI.Graphics {
    const bgRect = new PIXI.Graphics();
    bgRect.rect(0, 0, width, height);
    bgRect.fill({ color: 0xffffff, alpha: 1 });
    bgRect.eventMode = 'static';
    bgRect.interactive = true;
    bgRect.hitArea = new PIXI.Rectangle(0, 0, width, height);
    bgRect.zIndex = 0;
    return bgRect;
}

/**
 * Sets up event handling for a container
 */
export function setupContainerEvents(
    container: PIXI.Container,
    hitAreaSize: number = 10000
): void {
    container.removeAllListeners();
    container.eventMode = 'static';
    container.interactive = true;
    container.hitArea = new PIXI.Rectangle(-hitAreaSize, -hitAreaSize, hitAreaSize * 2, hitAreaSize * 2);
}
