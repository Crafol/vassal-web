/**
 * VASSAL Renderer - Canvas rendering with Fabric.js
 */

/// <reference types="fabric" />
import * as fabric from 'fabric';
import { Point } from 'fabric';
import type { Canvas } from 'fabric';

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

// Stack types for stacking pieces
export interface StackPiece {
  pieceId: string;
  pieceName: string;
  imageUrl: string;
  fabricObject: fabric.FabricImage;
}

export interface Stack {
  id: string;
  snapX: number;
  snapY: number;
  pieces: StackPiece[];
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

// Imperative methods to expose to parent
export interface CanvasManagerHandle {
  getPieces: () => PlacedPiece[];
  getState: () => CanvasState;
  getViewState: () => { zoom: number; panX: number; panY: number };
  setViewState: (state: { zoom?: number; panX?: number; panY?: number }) => void;
  addPieceAt: (piece: PlacedPiece, imageUrl: string) => Promise<void>;
  clearPieces: () => void;
}

export interface SelectionInfo {
  selected: PlacedPiece | null;
  coords: { x: number; y: number } | null;
}

export type SelectionCallback = (info: SelectionInfo) => void;

export class CanvasManager {
  private canvas: fabric.Canvas;
  private zoom: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  public onSelectionChange?: SelectionCallback;

  // Grid info for snapping
  private gridInfo: {
    dx: number;
    dy: number;
    x0: number;
    y0: number;
    sideways: boolean;
    snapTo: boolean;
    cornersLegal: boolean;
    edgesLegal: boolean;
    boardX: number;
boardY: number;
  } | null = null;
  
  // Zones for useParentGrid logic
  private zones: ZoneData[] = [];
  
  // Mouse-over popup state
  private mouseOverPopup: fabric.Group | null = null;
  private mouseOverTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Stacking system
  private stacks: Map<string, Stack> = new Map();
  private stackCounter: number = 0;
  private readonly STACK_THRESHOLD: number = 30; // pixels - piezas más cerca que esto se consideran stack

  constructor(canvasElement: HTMLCanvasElement, options: RenderOptions) {
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
  async addBoard(layer: BoardLayer): Promise<fabric.Image> {
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
        
        // Save zones for useParentGrid logic
        if (layer.grid?.zones) {
          this.zones = layer.grid.zones;
          console.log('CanvasManager: saved zones:', this.zones.length, this.zones.map(z => ({ name: z.name, useParentGrid: z.useParentGrid })));
        } else {
          this.zones = [];
        }

        resolve(img);
      }).catch(reject);
    });
  }

  /**
   * Draw hexagonal grid on canvas
   * Uses RED color (#FF0000) for visibility
   */
  drawHexGrid(grid: HexGridData, boardX: number = 0, boardY: number = 0, boardWidth: number = 2000, boardHeight: number = 2000): void {
    const { dx, dy, x0 = 0, y0 = 0, sideways = false, dotsVisible = false, visible = true, color = '#FF0000' } = grid;
    console.log('drawHexGrid: params', { dx, dy, x0, y0, sideways, boardX, boardY, boardWidth, boardHeight, visible, color, dotsVisible });
    
    // If visible === false, skip drawing but keep snapTo functionality
    if (!visible) {
      console.log('drawHexGrid: grid hidden (visible=false), skipping draw but snapTo remains active');
      return;
    }
    
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
        } else {
          // Pointy-top: offset vertical en columnas impares
          if (col % 2 === 1) {
            centerY += verticalSpacing / 2;
          }
        }

        // Crear hexágono (6 vértices)
        // Flat-top: caras horizontales (arriba/abajo) → primer vértice a 30°
        // Pointy-top: puntas horizontales (izquierda/derecha) → primer vértice a 0°
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < 6; i++) {
          const angleOffset = isFlatTop ? Math.PI / 6 : 0;
          const angle = i * Math.PI / 3 + angleOffset;

          points.push({
            x: centerX + hexRadius * Math.cos(angle),
            y: centerY + hexRadius * Math.sin(angle),
          });
        }

        const hexPoly = new fabric.Polygon(points, {
          stroke: color,
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
            fill: color,
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
  drawZones(zones: ZoneData[]): void {
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
      const zonePoly = new fabric.Polygon(points as fabric.Point[], {
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
  async addImageFromDataUrl(
    dataUrl: string,
    options: {
      left?: number;
      top?: number;
      selectable?: boolean;
    } = {}
  ): Promise<fabric.Image> {
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
   * Find zone at position
   * Returns the zone's useParentGrid setting, or true if no zone found (default behavior)
   */
  private findZoneAtPosition(x: number, y: number): boolean {
    for (const zone of this.zones) {
      // Parse zone path: "x1,y1;x2,y2;x3,y3;x4,y4" - rectangle
      const points = zone.path.split(';').map(pair => {
        const [px, py] = pair.split(',').map(Number);
        return { x: px, y: py };
      });
      
      if (points.length >= 4) {
        // Simple rectangle check: find min/max
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          console.log(`[ZONE] Piece at (${Math.round(x)}, ${Math.round(y)}) in zone "${zone.name}" -> useParentGrid: ${zone.useParentGrid}`);
          return zone.useParentGrid !== false; // default true
        }
      }
    }
    return true; // Default: use parent grid
  }

  /**
   * Find existing stack at position
   */
  private findStackAtPosition(x: number, y: number): Stack | null {
    for (const stack of this.stacks.values()) {
      const dx = Math.abs(stack.snapX - x);
      const dy = Math.abs(stack.snapY - y);
      if (dx < this.STACK_THRESHOLD && dy < this.STACK_THRESHOLD) {
        console.log(`[STACK] findStackAtPosition: found stack ${stack.id} at (${Math.round(x)}, ${Math.round(y)})`);
        return stack;
      }
    }
    return null;
  }

  /**
   * Find nearby pieces at position (for creating new stack)
   */
  private findNearbyPieces(x: number, y: number): fabric.FabricImage[] {
    const nearby: fabric.FabricImage[] = [];
    for (const obj of this.canvas.getObjects()) {
      if ((obj as any).pieceId && obj.type === 'image') {
        const dx = Math.abs((obj.left || 0) - x);
        const dy = Math.abs((obj.top || 0) - y);
        if (dx < this.STACK_THRESHOLD && dy < this.STACK_THRESHOLD) {
          nearby.push(obj as fabric.FabricImage);
        }
      }
    }
    console.log(`[STACK] findNearbyPieces: found ${nearby.length} pieces near (${Math.round(x)}, ${Math.round(y)})`);
    return nearby;
  }

  /**
   * Add a game piece (counter) to the canvas
   */
  async addPiece(
    pieceId: string,
    pieceName: string,
    imageUrl: string,
    x: number,
    y: number
  ): Promise<PlacedPiece | null> {
    if (!imageUrl) {
      console.warn('CanvasManager.addPiece: no imageUrl provided');
      return null;
    }

    // Check zone at position to determine if should use grid
    const shouldUseGrid = this.findZoneAtPosition(x, y);
    
    // Snap to grid if enabled AND zone allows it
    const snappedPos = shouldUseGrid && this.gridInfo?.snapTo 
      ? this.snapToNearestHex(x, y)
      : { x, y };
    const finalX = snappedPos.x;
    const finalY = snappedPos.y;

    console.log('CanvasManager.addPiece:', { x, y, snappedTo: snappedPos, snapEnabled: this.gridInfo?.snapTo, shouldUseGrid });

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
        (img as any).pieceId = pieceId;
        (img as any).pieceName = pieceName;
        (img as any).imageUrl = imageUrl;
        
        // Save normal shadow reference for later
        (img as any).normalShadow = shadow;
        
        // Create lifted shadow (farther, more diffuse)
        const liftedShadow = new fabric.Shadow({
          color: 'rgba(0,0,0,0.5)',
          blur: 20,
          offsetX: 6,
          offsetY: 6,
        });
        (img as any).liftedShadow = liftedShadow;
        
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
  snapToNearestHex(x: number, y: number): { x: number; y: number } {
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
    let centerX: number, centerY: number;
    if (sideways) {
      // Flat-top
      centerX = hexRadius * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
      centerY = hexRadius * (3 / 2 * hex.r);
    } else {
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
  private hexRound(q: number, r: number): { q: number; r: number } {
    const s = -q - r;

    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  }

  /**
   * Set zoom level
   */
  setZoom(level: number): void {
    this.zoom = Math.max(0.1, Math.min(5, level));
    this.canvas.setZoom(this.zoom);
    this.canvas.renderAll();
  }

  /**
   * Get current zoom
   */
  getZoom(): number {
    return this.zoom;
  }

  /**
   * Get current pan offset
   */
  getPan(): { x: number; y: number } {
    return { x: this.panX, y: this.panY };
  }

  /**
   * Pan canvas
   */
  pan(deltaX: number, deltaY: number): void {
    this.panX += deltaX;
    this.panY += deltaY;
    this.canvas.absolutePan(new Point(this.panX, this.panY));
    this.canvas.renderAll();
  }

  /**
   * Reset view
   */
  resetView(): void {
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
  clear(): void {
    this.canvas.clear();
    this.canvas.backgroundColor = '#ffffff';
    this.resetView();
  }

  /**
   * Get fabric canvas instance
   */
  getCanvas(): fabric.Canvas {
    return this.canvas;
  }

  /**
   * Get all placed pieces with their current state
   */
  getPieces(): PlacedPiece[] {
    const pieces: PlacedPiece[] = [];
    
    this.canvas.getObjects().forEach((obj) => {
      const pieceId = (obj as any).pieceId;
      const pieceName = (obj as any).pieceName;
      
      if (pieceId || pieceName) {
        pieces.push({
          id: pieceId,
          name: pieceName,
          x: obj.left || 0,
          y: obj.top || 0,
          imageUrl: (obj as any).imageUrl,
          angle: obj.angle || 0,
        });
      }
    });
    
    return pieces;
  }

  /**
   * Clear all pieces (keep board)
   */
  clearPieces(): void {
    const objects = [...this.canvas.getObjects()];
    objects.forEach(obj => {
      const pieceId = (obj as any).pieceId;
      const pieceName = (obj as any).pieceName;
      if (pieceId || pieceName) {
        this.canvas.remove(obj);
      }
    });
    this.canvas.renderAll();
  }

  /**
   * Get current view state (zoom, pan)
   */
  getViewState(): { zoom: number; panX: number; panY: number } {
    return {
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
    };
  }

  /**
   * Set view state
   */
  setViewState(state: { zoom?: number; panX?: number; panY?: number }): void {
    if (state.zoom !== undefined) {
      this.setZoom(state.zoom);
    }
    if (state.panX !== undefined || state.panY !== undefined) {
      this.pan(
        (state.panX || 0) - this.panX,
        (state.panY || 0) - this.panY
      );
    }
  }

  /**
   * Convert screen coordinates to canvas world coordinates
   * This handles zoom and pan automatically using Fabric's viewport transform
   */
  canvasCoords(screenX: number, screenY: number): { x: number; y: number } {
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
  resize(width: number, height: number): void {
    this.canvas.setDimensions({ width, height });
    this.canvas.renderAll();
  }

  /**
   * Destroy canvas
   */
  dispose(): void {
    this.canvas.dispose();
  }

  private setupInteractions(): void {
    const canvas = this.canvas;
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    // Zoom with wheel
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as unknown as WheelEvent;
      const delta = e.deltaY;
      let zoom = this.zoom;
      
      zoom *= delta > 0 ? 0.95 : 1.05;
      zoom = Math.max(0.1, Math.min(5, zoom));
      
      canvas.zoomToPoint(
        new Point(e.offsetX, e.offsetY),
        zoom
      );
      
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
        wrapper.addEventListener('mousedown', (e: Event) => {
          const mouseEvent = e as unknown as MouseEvent;
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

        wrapper.addEventListener('mousemove', (e: Event) => {
          if (isPanning) {
            const mouseEvent = e as unknown as MouseEvent;
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
            if (wrapper) wrapper.style.cursor = 'default';
          }
        });

        wrapper.addEventListener('mouseleave', () => {
          if (isPanning) {
            isPanning = false;
            if (wrapper) wrapper.style.cursor = 'default';
          }
        });
      }
    }
    
    // Selection events
    canvas.on('selection:created', (opt) => {
      const selected = opt.selected?.[0];
      if (selected) {
        const pieceId = (selected as any).pieceId;
        const pieceName = (selected as any).pieceName;
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
        const pieceId = (selected as any).pieceId;
        const pieceName = (selected as any).pieceName;
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
      if (obj && (obj as any).liftedShadow) {
        obj.set('shadow', (obj as any).liftedShadow);
        this.canvas.renderAll();
      }
    });
    
    canvas.on('selection:updated', (opt) => {
      const obj = opt.selected?.[0];
      if (obj && (obj as any).liftedShadow) {
        obj.set('shadow', (obj as any).liftedShadow);
        this.canvas.renderAll();
      }
    });
    
    // Restore normal shadow when object is modified (drag ends)
    canvas.on('object:modified', (opt) => {
      const obj = opt.target;
      if (obj && (obj as any).normalShadow) {
        obj.set('shadow', (obj as any).normalShadow);
      }

      // Snap to grid when drag ends (only on drop)
      if (obj && (obj as any).pieceId) {
        // Check zone at current position
        const shouldUseGrid = this.findZoneAtPosition(obj.left || 0, obj.top || 0);
        
        // Snap only if zone allows it
        const snapped = shouldUseGrid && this.gridInfo?.snapTo 
          ? this.snapToNearestHex(obj.left || 0, obj.top || 0)
          : { x: obj.left || 0, y: obj.top || 0 };
        
        obj.set({
          left: snapped.x,
          top: snapped.y,
        });
        
        // Handle stacking - find nearby pieces and create/join stack
        const nearby = this.findNearbyPieces(snapped.x, snapped.y);
        const currentPieceId = (obj as any).pieceId;
        const currentStackId = (obj as any).stackId;
        const otherPieces = nearby.filter(p => (p as any).pieceId !== currentPieceId);
        
        // Check if piece was in a stack and needs to leave it
        if (currentStackId) {
          const oldStack = this.stacks.get(currentStackId);
          if (oldStack) {
            // Calculate distance from stack center
            const dx = Math.abs((obj.left || 0) - oldStack.snapX);
            const dy = Math.abs((obj.top || 0) - oldStack.snapY);
            
            // If moved far enough (> threshold), leave the stack
            if (dx > this.STACK_THRESHOLD || dy > this.STACK_THRESHOLD) {
              console.log(`[STACK] Piece ${currentPieceId} moved out of stack ${currentStackId} (dx=${Math.round(dx)}, dy=${Math.round(dy)})`);
              this.removePieceFromStack(currentPieceId, oldStack);
            }
          }
        }
        
        // Now handle joining/creating a stack at new position
        if (otherPieces.length > 0) {
          // Check if there's an existing stack we can join
          let existingStack = this.findStackAtPosition(snapped.x, snapped.y);
          
          if (existingStack) {
            // Join existing stack
            console.log(`[STACK] Joining existing stack ${existingStack.id} with ${otherPieces.length + 1} pieces`);
          } else {
            // Create new stack
            this.stackCounter++;
            const stackId = `stack-${this.stackCounter}`;
            existingStack = {
              id: stackId,
              snapX: snapped.x,
              snapY: snapped.y,
              pieces: [],
            };
            this.stacks.set(stackId, existingStack);
            console.log(`[STACK] Created new stack ${stackId} with ${otherPieces.length + 1} pieces`);
          }
          
          // Add current piece to stack
          existingStack.pieces.push({
            pieceId: currentPieceId,
            pieceName: (obj as any).pieceName,
            imageUrl: (obj as any).imageUrl,
            fabricObject: obj as fabric.FabricImage,
          });
          (obj as any).stackId = existingStack.id;
          
          // Add other pieces to stack too
          for (const otherPiece of otherPieces) {
            const otherId = (otherPiece as any).pieceId;
            if (!existingStack.pieces.find(p => p.pieceId === otherId)) {
              existingStack.pieces.push({
                pieceId: otherId,
                pieceName: (otherPiece as any).pieceName,
                imageUrl: (otherPiece as any).imageUrl,
                fabricObject: otherPiece,
              });
              (otherPiece as any).stackId = existingStack.id;
            }
          }
          
          console.log(`[STACK] Stack ${existingStack.id} now has ${existingStack.pieces.length} pieces`);
          
          // Check if stack should be dissolved (less than 2 pieces)
          if (existingStack.pieces.length < 2) {
            console.log(`[STACK] Stack has ${existingStack.pieces.length} piece(s), dissolving`);
            this.dissolveStack(existingStack);
          } else {
            // Reorganize pieces in staircase pattern
            this.reorganizeStackPieces(existingStack);
            
            // Show stack indicator
            this.showStackIndicator(existingStack);
          }
        }
        
        this.canvas.renderAll();
        console.log('CanvasManager: snapped on drag end', { id: (obj as any).pieceId, snapped, shouldUseGrid, stackSize: otherPieces.length + 1 });
      }
    });
    
    // Also restore when selection cleared
    canvas.on('selection:cleared', () => {
      this.onSelectionChange?.({ selected: null, coords: null });
    });
    
    // Mouse-over popup - show on hover
    canvas.on('mouse:over', (opt) => {
      const obj = opt.target;
      if (!obj) return;
      const pieceId = (obj as any).pieceId;
      const pieceName = (obj as any).pieceName;
      if (!pieceId && !pieceName) return;
      
      // Get mouse position
      const pointer = canvas.getPointer(opt.e);
      
      if (this.mouseOverTimeout) clearTimeout(this.mouseOverTimeout);
      this.mouseOverTimeout = setTimeout(() => {
        this.showMouseOverPopup(obj, pointer.x, pointer.y);
      }, 400);
    });
    
    canvas.on('mouse:out', () => {
      if (this.mouseOverTimeout) {
        clearTimeout(this.mouseOverTimeout);
        this.mouseOverTimeout = null;
      }
this.hideMouseOverPopup();
    });
  } // End setupInteractions - keep class open for popup methods
  
  // Mouse-over popup methods - inside the class
  private showMouseOverPopup(mainObj: fabric.Object, mouseX: number, mouseY: number): void {
    this.hideMouseOverPopup();
    
    // Find pieces near position
    const nearby: fabric.Object[] = [];
    for (const obj of this.canvas.getObjects()) {
      const pId = (obj as any).pieceId;
      const pName = (obj as any).pieceName;
      if (!pId && !pName) continue;
      const dist = Math.sqrt(((obj.left||0) - mouseX) ** 2 + ((obj.top||0) - mouseY) ** 2);
      if (dist < 40) nearby.push(obj);
    }
    if (nearby.length === 0) return;
    
    // Get image URLs
    const urls = nearby.map(o => (o as any).imageUrl).filter(Boolean);
    if (urls.length === 0) {
      this.showTextPopup(nearby, mouseX, mouseY);
      return;
    }
    
    // Load images - full size
    const promises = urls.slice(0, 4).map(url => 
      fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
        .then(img => {
          const maxSize = 200;
          const scale = Math.min(1, maxSize / Math.max(img.width||1, img.height||1));
          img.set({ scaleX: scale, scaleY: scale, originX: 'center', originY: 'center' });
          return img;
        })
        .catch(() => null)
    );
    
    Promise.all(promises).then(imgs => {
      const valid = imgs.filter((i): i is fabric.FabricImage => i !== null);
      if (valid.length === 0) { this.showTextPopup(nearby, mouseX, mouseY); return; }
      
      const pieceW = 120, gap = 10;
      const totalW = valid.length * pieceW + (valid.length-1) * gap;
      const bg = new fabric.Rect({
        width: totalW + 20, height: pieceW + 20,
        fill: 'rgba(0,0,0,0.92)', rx: 10, ry: 10,
        stroke: '#FFF', strokeWidth: 3, originX: 'center', originY: 'center'
      });
      
      valid.forEach((img, i) => {
        img.set({ left: (i - (valid.length-1)/2) * (pieceW + gap), top: 0 });
      });
      
      let left = mouseX + 40, top = mouseY - pieceW/2 - 15;
      const cw = this.canvas.getWidth(), ch = this.canvas.getHeight();
      if (left + totalW/2 + 15 > cw) left = mouseX - totalW/2 - 40;
      if (left < totalW/2 + 10) left = totalW/2 + 10;
      if (top < pieceW/2 + 10) top = mouseY + 40;
      
      this.mouseOverPopup = new fabric.Group([bg, ...valid], {
        left, top, selectable: false, evented: false, originX: 'center', originY: 'center'
      });
      this.canvas.add(this.mouseOverPopup);
      this.canvas.renderAll();
    });
  }

  private showTextPopup(pieces: fabric.Object[], mx: number, my: number): void {
    const names = pieces.map(o => (o as any).pieceName).slice(0,4);
    const txt = names.join('\n');
    const text = new fabric.Text(txt, { fontSize: 14, fill: '#FFF', fontFamily: 'Arial', fontWeight: 'bold' });
    const bb = text.getBoundingRect();
    const bg = new fabric.Rect({
      width: bb.width + 24, height: bb.height + 24,
      fill: 'rgba(0,0,0,0.92)', rx: 10, ry: 10,
      stroke: '#FFF', strokeWidth: 3, originX: 'center', originY: 'center'
    });
    let left = mx + 40, top = my - bb.height/2 - 10;
    if (left + bb.width/2 + 15 > this.canvas.getWidth()) left = mx - bb.width/2 - 40;
    this.mouseOverPopup = new fabric.Group([bg, text], { left, top, selectable: false, evented: false, originX: 'center', originY: 'center' });
    this.canvas.add(this.mouseOverPopup);
    this.canvas.renderAll();
  }

  private hideMouseOverPopup(): void {
    if (this.mouseOverPopup) {
      this.canvas.remove(this.mouseOverPopup);
      this.mouseOverPopup = null;
      this.canvas.renderAll();
    }
  }

  /**
   * Calculate offset for stacking pieces in a staircase pattern
   * Each piece is offset slightly up and to the right to show pieces underneath
   */
  private calculateStackOffset(index: number, pieceWidth: number = 50, pieceHeight: number = 50): { x: number; y: number } {
    const offsetX = pieceWidth * 0.06;  // 6% right per piece
    const offsetY = pieceHeight * 0.08; // 8% up per piece (negative = up)
    return {
      x: index * offsetX,
      y: -index * offsetY,
    };
  }

  /**
   * Reorganize pieces in a stack to form a staircase
   * Ordered by current Z position: lowest Z piece = bottom of stack (back),
   * highest Z piece = top of stack (front)
   */
  private reorganizeStackPieces(stack: Stack): void {
    // Get all objects from canvas to determine current Z order
    const canvasObjects = this.canvas.getObjects();
    
    // Sort pieces by their current Z position in canvas
    // Lowest Z index = at back, highest Z index = at front
    const sortedPieces = [...stack.pieces].sort((a, b) => {
      const indexA = canvasObjects.indexOf(a.fabricObject);
      const indexB = canvasObjects.indexOf(b.fabricObject);
      return indexA - indexB;
    });
    
    // Assign positions in staircase based on Z order
    for (let i = 0; i < sortedPieces.length; i++) {
      const piece = sortedPieces[i];
      const obj = piece.fabricObject;
      
      const offset = this.calculateStackOffset(i, (obj.width || 50) * (obj.scaleX || 1), (obj.height || 50) * (obj.scaleY || 1));
      
      obj.set({
        left: stack.snapX + offset.x,
        top: stack.snapY + offset.y,
      });
      
      // Store stack index for later reference
      (obj as any).stackIndex = i;
      (obj as any).stackOffset = offset;
    }
    
    // Now re-order Z: sortedPieces[0] should be at back, sortedPieces[length-1] at front
    for (let i = 0; i < sortedPieces.length; i++) {
      const piece = sortedPieces[i];
      const fabricObj = piece.fabricObject;
      // Set Z order: first piece goes to back, last to front
      (fabricObj as any).moveTo?.(i);
    }
    
    // Make sure indicator stays at top
    const existingIndicator = this.canvas.getObjects().find(o => (o as any).stackIndicatorId === stack.id);
    if (existingIndicator) {
      (existingIndicator as any).moveTo?.(this.canvas.getObjects().length - 1);
    }
    
    this.canvas.renderAll();
    console.log(`[STACK] Reorganized ${stack.pieces.length} pieces in staircase pattern with Z ordering (bottom Z = back)`);
  }

  /**
   * Remove stack when it has less than 2 pieces
   */
  private dissolveStack(stack: Stack): void {
    // Remove stack reference from all pieces first
    for (const piece of stack.pieces) {
      (piece.fabricObject as any).stackId = undefined;
      (piece.fabricObject as any).stackOffset = undefined;
    }
    
    // Remove the stack from the map
    this.stacks.delete(stack.id);
    
    // Remove visual indicator
    const existingIndicator = this.canvas.getObjects().find(o => (o as any).stackIndicatorId === stack.id);
    if (existingIndicator) {
      this.canvas.remove(existingIndicator);
    }
    
    console.log(`[STACK] Dissolved stack ${stack.id}`);
  }

  /**
   * Remove a piece from its stack when moved far enough
   * Returns true if piece was removed
   */
  private removePieceFromStack(pieceId: string, currentStack: Stack): boolean {
    // Find piece in stack
    const pieceIndex = currentStack.pieces.findIndex(p => p.pieceId === pieceId);
    if (pieceIndex === -1) return false;
    
    // Remove from array
    const [removedPiece] = currentStack.pieces.splice(pieceIndex, 1);
    
    // Clear stack references from the piece
    (removedPiece.fabricObject as any).stackId = undefined;
    (removedPiece.fabricObject as any).stackIndex = undefined;
    (removedPiece.fabricObject as any).stackOffset = undefined;
    
    console.log(`[STACK] Removed piece ${pieceId} from stack ${currentStack.id}, remaining: ${currentStack.pieces.length}`);
    
    // If stack has less than 2 pieces, dissolve it
    if (currentStack.pieces.length < 2) {
      this.dissolveStack(currentStack);
      return true;
    }
    
    // Reorganize remaining pieces
    this.reorganizeStackPieces(currentStack);
    this.showStackIndicator(currentStack);
    
    return true;
  }

  /**
   * Show visual indicator for stack (circle around stacked pieces)
   */
  private showStackIndicator(stack: Stack): void {
    // Remove existing indicator for this stack
    const existingIndicator = this.canvas.getObjects().find(o => (o as any).stackIndicatorId === stack.id);
    if (existingIndicator) {
      this.canvas.remove(existingIndicator);
    }
    
    // Find bounding box of all pieces in stack
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const piece of stack.pieces) {
      const obj = piece.fabricObject;
      const w = (obj.width || 50) * (obj.scaleX || 1);
      const h = (obj.height || 50) * (obj.scaleY || 1);
      minX = Math.min(minX, (obj.left || 0) - w/2);
      minY = Math.min(minY, (obj.top || 0) - h/2);
      maxX = Math.max(maxX, (obj.left || 0) + w/2);
      maxY = Math.max(maxY, (obj.top || 0) + h/2);
    }
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const radius = Math.max(maxX - minX, maxY - minY) / 2 + 10;
    
    const indicator = new fabric.Circle({
      left: centerX,
      top: centerY,
      radius: radius,
      fill: 'transparent',
      stroke: '#FF6600',
      strokeWidth: 3,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      opacity: 0.8,
    });
    
    (indicator as any).stackIndicatorId = stack.id;
    this.canvas.add(indicator);
    this.canvas.renderAll();
    console.log(`[STACK] Showed indicator for stack ${stack.id} with ${stack.pieces.length} pieces`);
  }
}

/**
 * Extract map data from parsed module
 */
export function extractMapData(parsedModule: {
  maps: Array<{
    name: string;
    boards: Array<{
      name: string;
      imagePath: string;
      grid?: ZonedGridData;
    }>;
  }>;
  images: Map<string, string>;
}): BoardLayer[] {
  const layers: BoardLayer[] = [];

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