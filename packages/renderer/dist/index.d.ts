/**
 * VASSAL Renderer - Canvas rendering with Fabric.js
 */
import * as fabric from 'fabric';
export interface RenderOptions {
    width: number;
    height: number;
    backgroundColor?: string;
}
export interface HexGridData {
    dx: number;
    dy: number;
    x0?: number;
    y0?: number;
    color?: string;
    snapTo?: boolean;
    visible?: boolean;
    dotsVisible?: boolean;
    cornersLegal?: boolean;
    edgesLegal?: boolean;
    sideways?: boolean;
}
export interface ZoneData {
    name: string;
    path: string;
    locationFormat?: string;
    highlightProperty?: string;
    useHighlight?: boolean;
    useParentGrid?: boolean;
}
export interface ZonedGridData {
    hexGrid?: HexGridData;
    zones?: ZoneData[];
}
export interface BoardLayer {
    name: string;
    imageUrl: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    grid?: ZonedGridData;
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
    private gridInfo;
    private zones;
    private mouseOverPopup;
    private mouseOverTimeout;
    constructor(canvasElement: HTMLCanvasElement, options: RenderOptions);
    /**
     * Add board image to canvas
     */
    addBoard(layer: BoardLayer): Promise<fabric.Image>;
    /**
     * Draw hexagonal grid on canvas
     * Uses RED color (#FF0000) for visibility
     */
    drawHexGrid(grid: HexGridData, boardX?: number, boardY?: number, boardWidth?: number, boardHeight?: number): void;
    /**
     * Draw zone outlines on canvas
     * Uses a different color (e.g., blue) for zones
     */
    drawZones(zones: ZoneData[]): void;
    /**
     * Add image from base64 data URL
     */
    addImageFromDataUrl(dataUrl: string, options?: {
        left?: number;
        top?: number;
        selectable?: boolean;
    }): Promise<fabric.Image>;
    /**
     * Find zone at position
     * Returns the zone's useParentGrid setting, or true if no zone found (default behavior)
     */
    private findZoneAtPosition;
    /**
     * Add a game piece (counter) to the canvas
     */
    addPiece(pieceId: string, pieceName: string, imageUrl: string, x: number, y: number): Promise<PlacedPiece | null>;
    /**
     * Snap a position to the nearest hex center
     * Returns the position snapped to the hex grid, or original position if no grid
     */
    snapToNearestHex(x: number, y: number): {
        x: number;
        y: number;
    };
    /**
     * Round fractional hex coordinates to nearest integer hex
     */
    private hexRound;
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
    private showMouseOverPopup;
    private showTextPopup;
    private hideMouseOverPopup;
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
            grid?: ZonedGridData;
        }>;
    }>;
    images: Map<string, string>;
}): BoardLayer[];
export default CanvasManager;
//# sourceMappingURL=index.d.ts.map