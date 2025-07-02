export type ToolMode = 'select' | 'group' | 'draw' | 'paint' | 'pan' | 'geography'; // Added 'paint' and 'pan'
export type ViewMode = 'create' | 'view';

export interface AppState {
    currentTool: ToolMode;
    currentView: ViewMode;
    activeWorldMapId?: string;
    activeTownId?: string;
    memoryUsage?: {
        jsHeapSizeLimit: number;
        totalJSHeapSize: number;
        usedJSHeapSize: number;
    };
    lastRenderTime?: number; // ms
}

export interface ExportedMap {
    version: string;
    worldMap: import('./mapTypes').WorldMapData;
    towns: import('./townTypes').TownData[];
}
