/**
 * Game Canvas component using Fabric.js
 */

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { CanvasManager, type BoardLayer, type PlacedPiece, type SelectionInfo, type CanvasManagerHandle } from '@vassal/renderer';

interface GameCanvasProps {
  images: Map<string, string>;
  mapName: string;
  boards?: BoardLayer[];
  onSelectionChange?: (info: SelectionInfo) => void;
}

export const GameCanvas = forwardRef<CanvasManagerHandle, GameCanvasProps>(function GameCanvas({ images, mapName, boards: propBoards, onSelectionChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([]);

  // Expose manager methods via ref
  useImperativeHandle(ref, () => ({
    getPieces: () => managerRef.current?.getPieces() || [],
    getState: () => managerRef.current ? {
      panX: managerRef.current.getViewState().panX,
      panY: managerRef.current.getViewState().panY,
      zoom: managerRef.current.getViewState().zoom,
    } : { panX: 0, panY: 0, zoom: 1 },
    getViewState: () => managerRef.current?.getViewState() || { zoom: 1, panX: 0, panY: 0 },
    setViewState: (state) => managerRef.current?.setViewState(state),
    addPieceAt: async (piece, imageUrl) => {
      if (managerRef.current) {
        await managerRef.current.addPiece(piece.id, piece.name, imageUrl, piece.x, piece.y);
      }
    },
    clearPieces: () => managerRef.current?.clearPieces(),
  }), []);

  // Handle drop from sidebar
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const pieceData = e.dataTransfer.getData('piece');
    if (!pieceData || !managerRef.current) return;
    
    try {
      const piece = JSON.parse(pieceData);
      console.log('GameCanvas: drop received', piece.name);
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      const coords = managerRef.current?.canvasCoords(screenX, screenY);
      const x = coords?.x ?? screenX;
      const y = coords?.y ?? screenY;
      
      console.log('GameCanvas: drop at visual', screenX, screenY, '-> world', x, y);
      
      const pieceImagePath = piece.imagePath || '';
      const imgSrc = 
        (pieceImagePath && images.get(pieceImagePath)) ||
        (pieceImagePath && images.get('images/' + pieceImagePath)) ||
        '';
      
      if (!imgSrc && pieceImagePath) {
        console.log('GameCanvas: NOT FOUND image:', pieceImagePath);
      }
      
      managerRef.current.addPiece(piece.id, piece.name, imgSrc, x, y).then((placed) => {
        if (placed) {
          console.log('GameCanvas: piece placed at', x, y);
          setPlacedPieces(prev => [...prev, placed]);
        }
      });
    } catch (err) {
      console.error('GameCanvas: drop error', err);
    }
  }, [images]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !propBoards || propBoards.length === 0) {
      return;
    }

    const container = canvasRef.current.parentElement;
    if (!container) return;

    // Dispose old manager first
    if (managerRef.current) {
      managerRef.current.dispose();
      managerRef.current = null;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    console.log('GameCanvas: initializing canvas', width, height);

    managerRef.current = new CanvasManager(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
    });
    
    // Connect selection callback
    if (onSelectionChange) {
      managerRef.current.onSelectionChange = onSelectionChange;
    }

    setLoading(true);
    managerRef.current.addBoard(propBoards[0]).then(() => {
      console.log('GameCanvas: board loaded successfully');
      setLoading(false);
    }).catch(err => {
      console.error('GameCanvas: Failed to load board:', err);
      setLoading(false);
    });

    return () => {
      // Cleanup on unmount
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
    };
  }, [propBoards, onSelectionChange]);

  return (
    <div 
      className="canvas-wrapper"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {loading && <div className="canvas-loading">Loading map...</div>}
      <canvas ref={canvasRef} />
      <div className="canvas-controls">
        <span>Drag pieces here | Zoom: scroll | Pan: drag | Select: click</span>
        <span> | Pieces placed: {placedPieces.length}</span>
      </div>
    </div>
  );
});

export default GameCanvas;