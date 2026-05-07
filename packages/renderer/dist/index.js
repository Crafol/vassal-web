/**
 * VASSAL Renderer - Canvas rendering with Fabric.js
 */
/// <reference types="fabric" />
import * as fabric from 'fabric';
import { Point } from 'fabric';
export class CanvasManager {
    canvas;
    zoom = 1;
    panX = 0;
    panY = 0;
    onSelectionChange;
    // Grid info for snapping
    gridInfo = null;
    constructor(canvasElement, options) {
        this.canvas = new fabric.Canvas(canvasElement, {
            width: options.width,
            height: options.height,
            backgroundColor: options.backgroundColor || '#ffffff',
            selection: true,
            preserveObjectStacking: true,
        });
        this.setupInteractions();
    }
    /**
     * Add board image to canvas
     */
    async addBoard(layer) {
        return new Promise((resolve, reject) => {
            fabric.FabricImage.fromURL(layer.imageUrl, {
                crossOrigin: 'anonymous',
            }).then((img) => {
                img.set({
                    left: layer.x,
                    top: layer.y,
                    selectable: false,
                    evented: false,
                });
                this.canvas.add(img);
                this.canvas.renderAll();
                // Draw grid if present
                console.log('CanvasManager.addBoard: layer.grid:', layer.grid, 'board pos:', { x: layer.x, y: layer.y, w: layer.width, h: layer.height });
                if (layer.grid?.hexGrid) {
                    const hexGrid = layer.grid.hexGrid;
                    console.log('CanvasManager.addBoard: calling drawHexGrid with:', hexGrid);
                    this.drawHexGrid(hexGrid, layer.x, layer.y, layer.width || 2000, layer.height || 2000);
                    // Save grid info for snapping
                    const isFlatTop = hexGrid.sideways;
                    this.gridInfo = {
                        dx: hexGrid.dx,
                        dy: hexGrid.dy,
                        x0: isFlatTop ? (hexGrid.y0 || 0) : (hexGrid.x0 || 0),
                        y0: isFlatTop ? (hexGrid.x0 || 0) : (hexGrid.y0 || 0),
                        sideways: hexGrid.sideways || false,
                        snapTo: hexGrid.snapTo || false,
                        cornersLegal: hexGrid.cornersLegal || false,
                        edgesLegal: hexGrid.edgesLegal || false,
                        boardX: layer.x,
                        boardY: layer.y,
                    };
                    console.log('CanvasManager: gridInfo saved for snapping:', this.gridInfo);
                }
                resolve(img);
            }).catch(reject);
        });
    }
    /**
     * Draw hexagonal grid on canvas
     * Uses RED color (#FF0000) for visibility
     */
    drawHexGrid(grid, boardX = 0, boardY = 0, boardWidth = 2000, boardHeight = 2000) {
        const { dx, dy, x0 = 0, y0 = 0, sideways = false, dotsVisible = false } = grid;
        console.log('drawHexGrid: params', { dx, dy, x0, y0, sideways, boardX, boardY, boardWidth, boardHeight });
        // VASSAL: sideways=true → Flat Topped (rows horizontal), sideways=false → Pointy Topped
        const isFlatTop = sideways;
        // Cuando sideways=true (Flat Topped): horizontal = dy, vertical = dx
        // Esto también aplica a la posición inicial del primer hex!
        const startX = isFlatTop ? y0 : x0;
        const startY = isFlatTop ? x0 : y0;
        const horizontalSpacing = isFlatTop ? dy : dx;
        const verticalSpacing = isFlatTop ? dx : dy;
        const hexRadius = horizontalSpacing / Math.sqrt(3);
        console.log('drawHexGrid: start position', { startX, startY }, 'spacing', { horizontalSpacing, verticalSpacing });
        // Calcular cuántos hexágonos caben en el área del board
        const cols = Math.ceil(boardWidth / horizontalSpacing) + 2;
        const rows = Math.ceil(boardHeight / verticalSpacing) + 2;
        console.log('drawHexGrid: grid size', { cols, rows, boardWidth, boardHeight });
        // Dibujar hexágonos
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                let centerX = boardX + startX + col * horizontalSpacing;
                let centerY = boardY + startY + row * verticalSpacing;
                // Offset zigzag para honeycomb
                if (isFlatTop) {
                    // Flat-top: offset horizontal en filas impares
                    if (row % 2 === 1) {
                        centerX += horizontalSpacing / 2;
                    }
                }
                else {
                    // Pointy-top: offset vertical en columnas impares
                    if (col % 2 === 1) {
                        centerY += verticalSpacing / 2;
                    }
                }
                // Crear hexágono (6 vértices)
                // Flat-top: caras horizontales (arriba/abajo) → primer vértice a 30°
                // Pointy-top: puntas horizontales (izquierda/derecha) → primer vértice a 0°
                const points = [];
                for (let i = 0; i < 6; i++) {
                    const angleOffset = isFlatTop ? Math.PI / 6 : 0;
                    const angle = i * Math.PI / 3 + angleOffset;
                    points.push({
                        x: centerX + hexRadius * Math.cos(angle),
                        y: centerY + hexRadius * Math.sin(angle),
                    });
                }
                const hexPoly = new fabric.Polygon(points, {
                    stroke: '#FF0000',
                    strokeWidth: 1.5,
                    fill: 'transparent',
                    selectable: false,
                    evented: false,
                    opacity: 0.8,
                });
                this.canvas.add(hexPoly);
                if (dotsVisible) {
                    const dot = new fabric.Circle({
                        left: centerX,
                        top: centerY,
                        radius: 3,
                        fill: '#FF0000',
                        originX: 'center',
                        originY: 'center',
                        selectable: false,
                        evented: false,
                        opacity: 0.7,
                    });
                    this.canvas.add(dot);
                }
            }
        }
        this.canvas.renderAll();
        console.log('CanvasManager: drew hex grid', { hexRadius, horizontalSpacing, verticalSpacing });
    }
    /**
     * Draw zone outlines on canvas
     * Uses a different color (e.g., blue) for zones
     */
    drawZones(zones) {
        for (const zone of zones) {
            // Parse path: "x1,y1;x2,y2;x3,y3;x4,y4"
            const points = zone.path.split(';').map(pair => {
                const [x, y] = pair.split(',').map(Number);
                return new fabric.Point(x, y);
            });
            if (points.length < 3) {
                continue;
            }
            // Create polygon
            const zonePoly = new fabric.Polygon(points, {
                stroke: '#0000FF',
                strokeWidth: 2,
                fill: 'rgba(0, 0, 255, 0.1)',
                selectable: false,
                evented: false,
                opacity: 0.8,
            });
            this.canvas.add(zonePoly);
        }
        this.canvas.renderAll();
        console.log('CanvasManager: drew', zones.length, 'zones');
    }
    /**
     * Add image from base64 data URL
     */
    async addImageFromDataUrl(dataUrl, options = {}) {
        return new Promise((resolve, reject) => {
            fabric.FabricImage.fromURL(dataUrl).then((img) => {
                img.set({
                    left: options.left ?? 0,
                    top: options.top ?? 0,
                    selectable: options.selectable ?? true,
                    hasControls: options.selectable ?? true,
                });
                this.canvas.add(img);
                this.canvas.renderAll();
                resolve(img);
            }).catch(reject);
        });
    }
    /**
     * Add a game piece (counter) to the canvas
     */
    async addPiece(pieceId, pieceName, imageUrl, x, y) {
        if (!imageUrl) {
            console.warn('CanvasManager.addPiece: no imageUrl provided');
            return null;
        }
        // Snap to grid if enabled
        const snappedPos = this.snapToNearestHex(x, y);
        const finalX = snappedPos.x;
        const finalY = snappedPos.y;
        console.log('CanvasManager.addPiece:', { x, y, snappedTo: snappedPos, snapEnabled: this.gridInfo?.snapTo });
        return new Promise((resolve, reject) => {
            fabric.FabricImage.fromURL(imageUrl, {
                crossOrigin: 'anonymous',
            }).then((img) => {
                // Add shadow for depth effect
                const shadow = new fabric.Shadow({
                    color: 'rgba(0,0,0,0.4)',
                    blur: 8,
                    offsetX: 3,
                    offsetY: 3,
                });
                img.set({
                    left: finalX,
                    top: finalY,
                    originX: 'center',
                    originY: 'center',
                    selectable: true,
                    hasControls: false,
                    lockRotation: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    shadow: shadow,
                });
                // Store piece data in the object
                img.pieceId = pieceId;
                img.pieceName = pieceName;
                // Save normal shadow reference for later
                img.normalShadow = shadow;
                // Create lifted shadow (farther, more diffuse)
                const liftedShadow = new fabric.Shadow({
                    color: 'rgba(0,0,0,0.5)',
                    blur: 20,
                    offsetX: 6,
                    offsetY: 6,
                });
                img.liftedShadow = liftedShadow;
                this.canvas.add(img);
                this.canvas.setActiveObject(img);
                this.canvas.renderAll();
                resolve({
                    id: pieceId,
                    name: pieceName,
                    x: finalX,
                    y: finalY,
                    imageUrl,
                });
            }).catch(err => {
                console.error('CanvasManager.addPiece: failed to load image', err);
                reject(err);
            });
        });
    }
    /**
     * Snap a position to the nearest hex center
     * Returns the position snapped to the hex grid, or original position if no grid
     */
    snapToNearestHex(x, y) {
        if (!this.gridInfo || !this.gridInfo.snapTo) {
            return { x, y };
        }
        const { dx, dy, x0, y0, sideways, cornersLegal, boardX, boardY } = this.gridInfo;
        // Adjust coordinates to be relative to board origin
        const relX = x - boardX - x0;
        const relY = y - boardY - y0;
        // Calculate hex dimensions
        const horizontalSpacing = sideways ? dy : dx;
        const hexRadius = horizontalSpacing / Math.sqrt(3);
        // Convert to hex coordinates (axial)
        const q = (Math.sqrt(3) / 3 * relX - 1 / 3 * relY) / hexRadius;
        const r = (2 / 3 * relY) / hexRadius;
        // Round to nearest hex
        const hex = this.hexRound(q, r);
        // Calculate center position of the hex
        let centerX, centerY;
        if (sideways) {
            // Flat-top
            centerX = hexRadius * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
            centerY = hexRadius * (3 / 2 * hex.r);
        }
        else {
            // Pointy-top
            centerX = hexRadius * (Math.sqrt(3) / 2 * hex.q);
            centerY = hexRadius * (3 / 2 * hex.q + Math.sqrt(3) * hex.r);
        }
        // Absolute center position
        const absCenterX = boardX + x0 + centerX;
        const absCenterY = boardY + y0 + centerY;
        // Calculate distance to center
        const distToCenter = Math.sqrt((x - absCenterX) ** 2 + (y - absCenterY) ** 2);
        // If cornersLegal, also check distance to each vertex
        let finalX = absCenterX;
        let finalY = absCenterY;
        let minDist = distToCenter;
        if (cornersLegal) {
            // Calculate the 6 vertices of the hex
            const angleOffset = sideways ? Math.PI / 6 : 0;
            for (let i = 0; i < 6; i++) {
                const angle = i * Math.PI / 3 + angleOffset;
                const vertexX = centerX + hexRadius * Math.cos(angle);
                const vertexY = centerY + hexRadius * Math.sin(angle);
                const absVertexX = boardX + x0 + vertexX;
                const absVertexY = boardY + y0 + vertexY;
                const distToVertex = Math.sqrt((x - absVertexX) ** 2 + (y - absVertexY) ** 2);
                if (distToVertex < minDist) {
                    minDist = distToVertex;
                    finalX = absVertexX;
                    finalY = absVertexY;
                }
            }
        }
        console.log('CanvasManager.snapToNearestHex:', { x, y, cornersLegal, distToCenter, minDist, finalX, finalY });
        return { x: finalX, y: finalY };
    }
    /**
     * Round fractional hex coordinates to nearest integer hex
     */
    hexRound(q, r) {
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        const rs = Math.round(s);
        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);
        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        }
        else if (rDiff > sDiff) {
            rr = -rq - rs;
        }
        return { q: rq, r: rr };
    }
    /**
     * Set zoom level
     */
    setZoom(level) {
        this.zoom = Math.max(0.1, Math.min(5, level));
        this.canvas.setZoom(this.zoom);
        this.canvas.renderAll();
    }
    /**
     * Get current zoom
     */
    getZoom() {
        return this.zoom;
    }
    /**
     * Get current pan offset
     */
    getPan() {
        return { x: this.panX, y: this.panY };
    }
    /**
     * Pan canvas
     */
    pan(deltaX, deltaY) {
        this.panX += deltaX;
        this.panY += deltaY;
        this.canvas.absolutePan(new Point(this.panX, this.panY));
        this.canvas.renderAll();
    }
    /**
     * Reset view
     */
    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.canvas.setZoom(1);
        this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        this.canvas.renderAll();
    }
    /**
     * Clear canvas
     */
    clear() {
        this.canvas.clear();
        this.canvas.backgroundColor = '#ffffff';
        this.resetView();
    }
    /**
     * Get fabric canvas instance
     */
    getCanvas() {
        return this.canvas;
    }
    /**
     * Get all placed pieces with their current state
     */
    getPieces() {
        const pieces = [];
        this.canvas.getObjects().forEach((obj) => {
            const pieceId = obj.pieceId;
            const pieceName = obj.pieceName;
            if (pieceId || pieceName) {
                pieces.push({
                    id: pieceId,
                    name: pieceName,
                    x: obj.left || 0,
                    y: obj.top || 0,
                    imageUrl: obj.imageUrl,
                    angle: obj.angle || 0,
                });
            }
        });
        return pieces;
    }
    /**
     * Clear all pieces (keep board)
     */
    clearPieces() {
        const objects = [...this.canvas.getObjects()];
        objects.forEach(obj => {
            const pieceId = obj.pieceId;
            const pieceName = obj.pieceName;
            if (pieceId || pieceName) {
                this.canvas.remove(obj);
            }
        });
        this.canvas.renderAll();
    }
    /**
     * Get current view state (zoom, pan)
     */
    getViewState() {
        return {
            zoom: this.zoom,
            panX: this.panX,
            panY: this.panY,
        };
    }
    /**
     * Set view state
     */
    setViewState(state) {
        if (state.zoom !== undefined) {
            this.setZoom(state.zoom);
        }
        if (state.panX !== undefined || state.panY !== undefined) {
            this.pan((state.panX || 0) - this.panX, (state.panY || 0) - this.panY);
        }
    }
    /**
     * Convert screen coordinates to canvas world coordinates
     * This handles zoom and pan automatically using Fabric's viewport transform
     */
    canvasCoords(screenX, screenY) {
        // Get the viewport transform matrix from Fabric
        // The transform is: [a, b, c, d, tx, ty] = canvas.viewportTransform
        // Visible = World * transform
        const vpt = this.canvas.viewportTransform;
        if (!vpt) {
            return { x: screenX, y: screenY };
        }
        const [a, b, c, d, tx, ty] = vpt;
        // Inverse transform: World = (Visible - translation) / scale
        // But we need to solve: visible = world * a + tx
        // So: world = (visible - tx) / a
        const zoom = this.zoom || Math.sqrt(a * a + c * c);
        if (zoom === 0 || zoom === 1) {
            return { x: screenX - tx, y: screenY - ty };
        }
        // For non-1 zoom, apply inverse transform
        const x = (screenX - tx) / a;
        const y = (screenY - ty) / d;
        return { x, y };
    }
    /**
     * Resize canvas
     */
    resize(width, height) {
        this.canvas.setDimensions({ width, height });
        this.canvas.renderAll();
    }
    /**
     * Destroy canvas
     */
    dispose() {
        this.canvas.dispose();
    }
    setupInteractions() {
        const canvas = this.canvas;
        let isPanning = false;
        let lastPosX = 0;
        let lastPosY = 0;
        // Zoom with wheel
        canvas.on('mouse:wheel', (opt) => {
            const e = opt.e;
            const delta = e.deltaY;
            let zoom = this.zoom;
            zoom *= delta > 0 ? 0.95 : 1.05;
            zoom = Math.max(0.1, Math.min(5, zoom));
            canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom);
            this.zoom = zoom;
            e.preventDefault();
            e.stopPropagation();
        });
        // Pan with buttons - use DOM event directly on canvas wrapper
        const canvasEl = this.canvas.getElement();
        if (canvasEl) {
            // Add event listener to the wrapper/parent
            const wrapper = canvasEl.parentElement;
            if (wrapper) {
                wrapper.addEventListener('mousedown', (e) => {
                    const mouseEvent = e;
                    console.log('PAN mousedown:', mouseEvent.button, 'alt:', mouseEvent.altKey, 'shift:', mouseEvent.shiftKey);
                    // button 0 = left, 1 = middle, 2 = right
                    if (mouseEvent.button === 1 || mouseEvent.altKey || mouseEvent.shiftKey) {
                        isPanning = true;
                        lastPosX = mouseEvent.clientX;
                        lastPosY = mouseEvent.clientY;
                        wrapper.style.cursor = 'grabbing';
                        e.preventDefault();
                    }
                });
                wrapper.addEventListener('mousemove', (e) => {
                    if (isPanning) {
                        const mouseEvent = e;
                        const deltaX = mouseEvent.clientX - lastPosX;
                        const deltaY = mouseEvent.clientY - lastPosY;
                        lastPosX = mouseEvent.clientX;
                        lastPosY = mouseEvent.clientY;
                        const vpt = canvas.viewportTransform;
                        vpt[4] += deltaX;
                        vpt[5] += deltaY;
                        canvas.requestRenderAll();
                    }
                });
                wrapper.addEventListener('mouseup', () => {
                    if (isPanning) {
                        isPanning = false;
                        if (wrapper)
                            wrapper.style.cursor = 'default';
                    }
                });
                wrapper.addEventListener('mouseleave', () => {
                    if (isPanning) {
                        isPanning = false;
                        if (wrapper)
                            wrapper.style.cursor = 'default';
                    }
                });
            }
        }
        // Selection events
        canvas.on('selection:created', (opt) => {
            const selected = opt.selected?.[0];
            if (selected) {
                const pieceId = selected.pieceId;
                const pieceName = selected.pieceName;
                if (pieceId || pieceName) {
                    this.onSelectionChange?.({
                        selected: { id: pieceId, name: pieceName, x: selected.left || 0, y: selected.top || 0 },
                        coords: { x: selected.left || 0, y: selected.top || 0 },
                    });
                }
            }
        });
        canvas.on('selection:updated', (opt) => {
            const selected = opt.selected?.[0];
            if (selected) {
                const pieceId = selected.pieceId;
                const pieceName = selected.pieceName;
                if (pieceId || pieceName) {
                    this.onSelectionChange?.({
                        selected: { id: pieceId, name: pieceName, x: selected.left || 0, y: selected.top || 0 },
                        coords: { x: selected.left || 0, y: selected.top || 0 },
                    });
                }
            }
        });
        canvas.on('selection:cleared', () => {
            this.onSelectionChange?.({ selected: null, coords: null });
        });
        // Lift shadow when dragging starts
        canvas.on('selection:created', (opt) => {
            const obj = opt.selected?.[0];
            if (obj && obj.liftedShadow) {
                obj.set('shadow', obj.liftedShadow);
                this.canvas.renderAll();
            }
        });
        canvas.on('selection:updated', (opt) => {
            const obj = opt.selected?.[0];
            if (obj && obj.liftedShadow) {
                obj.set('shadow', obj.liftedShadow);
                this.canvas.renderAll();
            }
        });
        // Restore normal shadow when object is modified (drag ends)
        canvas.on('object:modified', (opt) => {
            const obj = opt.target;
            if (obj && obj.normalShadow) {
                obj.set('shadow', obj.normalShadow);
            }
            // Snap to grid when drag ends (only on drop)
            if (obj && obj.pieceId) {
                const snapped = this.snapToNearestHex(obj.left || 0, obj.top || 0);
                obj.set({
                    left: snapped.x,
                    top: snapped.y,
                });
                this.canvas.renderAll();
                console.log('CanvasManager: snapped on drag end', { id: obj.pieceId, snapped });
            }
        });
        // Also restore when selection cleared
        canvas.on('selection:cleared', () => {
            this.onSelectionChange?.({ selected: null, coords: null });
        });
    }
}
/**
 * Extract map data from parsed module
 */
export function extractMapData(parsedModule) {
    const layers = [];
    for (const map of parsedModule.maps) {
        for (const board of map.boards) {
            const imageUrl = parsedModule.images.get(`images/${board.imagePath}`);
            if (imageUrl) {
                layers.push({
                    name: board.name,
                    imageUrl,
                    x: 0,
                    y: 0,
                    grid: board.grid,
                });
            }
        }
    }
    return layers;
}
export default CanvasManager;
//# sourceMappingURL=index.js.map