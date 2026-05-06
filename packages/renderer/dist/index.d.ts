/**
 * VASSAL Renderer - Canvas rendering with Fabric.js
 */
import * as fabric from 'fabric';
export interface RenderOptions {
    width: number;
    height: number;
    backgroundColor?: string;
}
export interface BoardLayer {
    name: string;
    imageUrl: string;
    x: number;
    y: number;
}
export interface PlacedPiece {
    id: string;
    name: string;
    x: number;
    y: number;
    imageUrl?: string;
    angle?: number;
}
export interface CanvasState {
    panX: number;
    panY: number;
    zoom: number;
}
export interface CanvasManagerHandle {
    getPieces: () => PlacedPiece[];
    getState: () => CanvasState;
    getViewState: () => {
        zoom: number;
        panX: number;
        panY: number;
    };
    setViewState: (state: {
        zoom?: number;
        panX?: number;
        panY?: number;
    }) => void;
    addPieceAt: (piece: PlacedPiece, imageUrl: string) => Promise<void>;
    clearPieces: () => void;
}
export interface SelectionInfo {
    selected: PlacedPiece | null;
    coords: {
        x: number;
        y: number;
    } | null;
}
export type SelectionCallback = (info: SelectionInfo) => void;
export declare class CanvasManager {
    private canvas;
    private zoom;
    private panX;
    private panY;
    onSelectionChange?: SelectionCallback;
    constructor(canvasElement: HTMLCanvasElement, options: RenderOptions);
    /**
     * Add board image to canvas
     */
    addBoard(layer: BoardLayer): Promise<fabric.Image>;
    /**
     * Add image from base64 data URL
     */
    addImageFromDataUrl(dataUrl: string, options?: {
        left?: number;
        top?: number;
        selectable?: boolean;
    }): Promise<fabric.Image>;
    /**
     * Add a game piece (counter) to the canvas
     */
    addPiece(pieceId: string, pieceName: string, imageUrl: string, x: number, y: number): Promise<PlacedPiece | null>;
    /**
     * Set zoom level
     */
    setZoom(level: number): void;
    /**
     * Get current zoom
     */
    getZoom(): number;
    /**
     * Get current pan offset
     */
    getPan(): {
        x: number;
        y: number;
    };
    /**
     * Pan canvas
     */
    pan(deltaX: number, deltaY: number): void;
    /**
     * Reset view
     */
    resetView(): void;
    /**
     * Clear canvas
     */
    clear(): void;
    /**
     * Get fabric canvas instance
     */
    getCanvas(): fabric.Canvas;
    /**
     * Get all placed pieces with their current state
     */
    getPieces(): PlacedPiece[];
    /**
     * Clear all pieces (keep board)
     */
    clearPieces(): void;
    /**
     * Get current view state (zoom, pan)
     */
    getViewState(): {
        zoom: number;
        panX: number;
        panY: number;
    };
    /**
     * Set view state
     */
    setViewState(state: {
        zoom?: number;
        panX?: number;
        panY?: number;
    }): void;
    /**
     * Convert screen coordinates to canvas world coordinates
     * This handles zoom and pan automatically using Fabric's viewport transform
     */
    canvasCoords(screenX: number, screenY: number): {
        x: number;
        y: number;
    };
    /**
     * Resize canvas
     */
    resize(width: number, height: number): void;
    /**
     * Destroy canvas
     */
    dispose(): void;
    private setupInteractions;
}
/**
 * Extract map data from parsed module
 */
export declare function extractMapData(parsedModule: {
    maps: Array<{
        name: string;
        boards: Array<{
            name: string;
            imagePath: string;
        }>;
    }>;
    images: Map<string, string>;
}): BoardLayer[];
export default CanvasManager;
//# sourceMappingURL=index.d.ts.map