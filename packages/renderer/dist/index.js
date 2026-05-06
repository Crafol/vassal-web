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
                resolve(img);
            }).catch(reject);
        });
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
                    left: x,
                    top: y,
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
                    x,
                    y,
                    imageUrl,
                });
            }).catch(err => {
                console.error('CanvasManager.addPiece: failed to load image', err);
                reject(err);
            });
        });
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
                this.canvas.renderAll();
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
                });
            }
        }
    }
    return layers;
}
export default CanvasManager;
//# sourceMappingURL=index.js.map