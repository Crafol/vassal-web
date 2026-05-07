import { useState, useCallback, useRef, useEffect } from 'react';
import { parseVmodFile, type ParsedModule } from './parser';
import { type SelectionInfo, type CanvasManagerHandle, type PlacedPiece, type BoardLayer } from '@vassal/renderer';
import { GameCanvas } from './GameCanvas';
import { Toolbar, Sidebar } from './Toolbar';
import JSZip from 'jszip';

interface Setup {
  name: string;
  description?: string;
  file?: string;
  useFile?: boolean;
}

function SelectionInfoPanel({ info }: { info: SelectionInfo | null }) {
  if (!info) {
    return <div className="debug-panel">Click a piece to see info</div>;
  }
  const { selected, coords } = info;
  return (
    <div className="debug-panel">
      <div><strong>Selected:</strong> {selected?.name || 'none'}</div>
      <div><strong>ID:</strong> {selected?.id || '-'}</div>
      <div><strong>Coords:</strong> {coords ? `${Math.round(coords.x)}, ${Math.round(coords.y)}` : '-'}</div>
    </div>
  );
}

function App() {
  const [module, setModule] = useState<ParsedModule | null>(null);
  const [activeMap, setActiveMap] = useState<string | null>(null);
  const [currentSetup, setCurrentSetup] = useState<string | null>(null);
  const [activePieceWindow, setActivePieceWindow] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [boards, setBoards] = useState<BoardLayer[]>([]);
  const canvasRef = useRef<CanvasManagerHandle>(null);

  // Compute boards when module or activeMap changes
  useEffect(() => {
    if (module && activeMap) {
      const mod = module.module;
      console.log('App: activeMap:', activeMap, 'maps:', mod.maps.map(m => ({ name: m.name, boards: m.boards.length })));
      const mapData = mod.maps.find(m => m.name === activeMap);
      
      if (mapData) {
        console.log('App: mapData boards:', mapData.boards);
        const layerData = mapData.boards.map(b => {
          const imageUrl = module.images.get(b.imagePath) || module.images.get('images/' + b.imagePath) || '';
          return {
            name: b.name,
            imageUrl,
            x: 0,
            y: 0,
            grid: b.grid,
          };
        }).filter(b => b.imageUrl);

        // Cargar imagenes para obtener dimensiones reales
        const loadImageDimensions = async () => {
          const result = await Promise.all(layerData.map(async (layer) => {
            if (!layer.imageUrl) return layer;
            try {
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = layer.imageUrl;
              });
              return { ...layer, width: img.naturalWidth, height: img.naturalHeight };
            } catch (e) {
              console.log('App: failed to load image dimensions for', layer.name);
              return layer;
            }
          }));
          return result;
        };

        loadImageDimensions().then((layers: BoardLayer[]) => {
          console.log('App: boards with dimensions:', layers.map(l => ({ name: l.name, w: l.width, h: l.height, hasGrid: !!l.grid })));
          setBoards(layers);
        });
      }
    }
  }, [module, activeMap]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    
    // Check if this is a piece drop (from sidebar) - if so, ignore (let GameCanvas handle it)
    if (e.dataTransfer.getData('piece')) {
      return;
    }
    
    // Handle module file drop
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.name.endsWith('.vmod')) {
      setError('Please drop a .vmod file');
      return;
    }
    
    setIsLoading(true);
    try {
      const parsed = await parseVmodFile(file);
      const mod = parsed.module;
      console.log('Module loaded:', mod.info.name);
      
      const mapName = mod.maps[0]?.name || null;
      setModule(parsed);
      setActiveMap(mapName);
      
      for (const setup of mod.setups) {
        if (setup.useFile) {
          setCurrentSetup(setup.name);
          break;
        }
      }
      
      if (mod.pieceWindows.length > 0) {
        setActivePieceWindow(mod.pieceWindows[0].name);
      }
    } catch (err) {
      console.error('Failed to load module:', err);
      setError(err instanceof Error ? err.message : 'Failed to load module');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoadModule = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vmod';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setIsLoading(true);
      try {
        const parsed = await parseVmodFile(file);
        const mod = parsed.module;
        console.log('Module loaded:', mod.info.name);
        
        const mapName = mod.maps[0]?.name || null;
        setModule(parsed);
        setActiveMap(mapName);
        
        for (const setup of mod.setups) {
          if (setup.useFile) {
            setCurrentSetup(setup.name);
            break;
          }
        }
        
        if (mod.pieceWindows.length > 0) {
          setActivePieceWindow(mod.pieceWindows[0].name);
        }
      } catch (err) {
        console.error('Failed to load module:', err);
        setError(err instanceof Error ? err.message : 'Failed to load module');
      } finally {
        setIsLoading(false);
      }
    };
    input.click();
  }, []);

  const handleSaveGame = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !module) {
      alert('No game to save');
      return;
    }
    
    try {
      const pieces = canvas.getPieces();
      const viewState = canvas.getViewState();
      
      const saveData = {
        version: 1,
        moduleName: module.module.info.name,
        mapName: activeMap,
        viewState,
        pieces: pieces.map(p => ({
          id: p.id,
          name: p.name,
          x: p.x,
          y: p.y,
          angle: p.angle || 0,
        })),
      };
      
      const jsonStr = JSON.stringify(saveData);
      const zip = new JSZip();
      zip.file('savedGame', jsonStr);
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${module.module.info.name}_save.vsav`;
      a.click();
      
      URL.revokeObjectURL(url);
      console.log('Game saved:', pieces.length, 'pieces');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save game');
    }
  }, [module, activeMap]);

  const handleLoadGame = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !module) {
      alert('No module loaded');
      return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vsav';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        
        const savedGame = await zip.file('savedGame')?.async('string');
        if (!savedGame) {
          alert('Invalid save file');
          return;
        }
        
        const saveData = JSON.parse(savedGame);
        console.log('Loading save:', saveData.moduleName, saveData.pieces.length, 'pieces');
        
        // Clear existing pieces
        canvas.clearPieces();
        
        // Restore view state
        canvas.setViewState(saveData.viewState);
        
        // Add pieces back - need to find their images
        for (const piece of saveData.pieces) {
          // Try to find the piece in module images
          let imageUrl = '';
          // Look through all piece windows to find this piece's image
          for (const pw of module.module.pieceWindows) {
            const found = pw.pieces.find(p => p.id === piece.id);
            if (found) {
              imageUrl = module.images.get(found.imagePath) || 
                       module.images.get('images/' + found.imagePath) || '';
              break;
            }
          }
          
          if (imageUrl) {
            await canvas.addPieceAt(piece, imageUrl);
          } else {
            console.warn('Image not found for piece:', piece.id);
          }
        }
        
        console.log('Game loaded');
      } catch (err) {
        console.error('Load failed:', err);
        alert('Failed to load game');
      }
    };
    input.click();
  }, [module, activeMap]);

  const handleSelectionChange = useCallback((info: SelectionInfo) => {
    console.log('Selection:', info);
    setSelectionInfo(info);
  }, []);

  const renderGameArea = () => {
    if (isLoading) {
      return (
        <div className="drop-zone">
          <p>Loading module...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="drop-zone" style={{ color: '#c00' }}>
          <p>Error: {error}</p>
        </div>
      );
    }
    
    if (module && activeMap) {
      return (
        <>
          <GameCanvas key={activeMap} ref={canvasRef} images={module.images} mapName={activeMap} boards={boards} onSelectionChange={handleSelectionChange} />
          <SelectionInfoPanel info={selectionInfo} />
        </>
      );
    }
    
    return (
      <div className={`drop-zone ${isDragging ? 'active' : ''}`}>
        <p>Drag and drop a .vmod file here</p>
        <p style={{ fontSize: '0.875rem' }}>
          Or use the "Open Module" button
        </p>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="header">
        <h1>VASSAL Web {module ? `- ${module.module.info.name}` : ''}</h1>
      </header>

      <Toolbar
        onLoadModule={handleLoadModule}
        onLoadGame={handleLoadGame}
        onSaveGame={handleSaveGame}
        onUndo={() => {}}
        onRedo={() => {}}
        onChat={() => {}}
        onPlayers={() => {}}
        enabled={!!module}
        onSetupChange={setCurrentSetup}
        setups={module?.module.setups as Setup[] || []}
        currentSetup={currentSetup || undefined}
        onPieceWindowChange={setActivePieceWindow}
        pieceWindows={module?.module.pieceWindows}
      />

      <div
        className="main-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {renderGameArea()}
        
        {module && (
          <Sidebar
          maps={module?.module.maps.map(m => m.name) || []}
          activeMap={activeMap || ''}
          onMapChange={setActiveMap}
          moduleInfo={module?.module.info}
          images={module?.images}
          pieceWindows={module?.module.pieceWindows}
          activePieceWindow={activePieceWindow || ''}
          onPieceWindowChange={setActivePieceWindow}
        />
        )}
      </div>
    </div>
  );
}

export default App;