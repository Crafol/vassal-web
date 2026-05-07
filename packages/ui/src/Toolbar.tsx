/**
 * Toolbar with game controls
 */

import { useState } from 'react';

interface PieceData {
  id: string;
  name: string;
  imagePath: string;
  type: string;
  properties: Record<string, string>;
}

interface PieceWindow {
  name: string;
  pieces: PieceData[];
}

interface ToolbarProps {
  onLoadModule: () => void;
  onLoadGame?: () => void;
  onSaveGame?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onChat?: () => void;
  onPlayers?: () => void;
  enabled: boolean;
  onSetupChange?: (setup: string) => void;
  setups?: Setup[];
  currentSetup?: string;
  onPieceWindowChange?: (pw: string) => void;
  pieceWindows?: PieceWindow[];
  activePieceWindow?: string;
  images?: Map<string, string>;
}

interface Setup {
  name: string;
  description?: string;
}

export function Toolbar({
  onLoadModule,
  onLoadGame,
  onSaveGame,
  onUndo,
  onRedo,
  onChat,
  onPlayers,
  enabled,
  onSetupChange,
  setups = [],
  currentSetup,
  onPieceWindowChange,
  pieceWindows = [],
  activePieceWindow,
  images,
}: ToolbarProps) {
  const [showSetups, setShowSetups] = useState(false);

  // Group pieces by their 'group' property
  const groupPieces = (pieces: PieceData[]): Map<string, PieceData[]> => {
    const groups: Map<string, PieceData[]> = new Map();
    for (const piece of pieces) {
      const group = piece.properties?.group || 'Ungrouped';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(piece);
    }
    return groups;
  };

  return (
    <div className="toolbar">
      <button onClick={onLoadModule}>Open Module</button>
      <button disabled={!enabled} onClick={onLoadGame}>Load</button>
      <button disabled={!enabled} onClick={onSaveGame}>Save</button>
      <button disabled={!enabled} onClick={onUndo}>Undo</button>
      <button disabled={!enabled} onClick={onRedo}>Redo</button>

      {setups.length > 0 && (
        <div className="toolbar-dropdown">
          <button 
            disabled={!enabled}
            onClick={() => setShowSetups(!showSetups)}
          >
            Setup {currentSetup && `(${currentSetup})`} ▼
          </button>
          {showSetups && (
            <div className="toolbar-dropdown-menu">
              {setups.map((setup) => (
                <button
                  key={setup.name}
                  onClick={() => {
                    onSetupChange?.(setup.name);
                    setShowSetups(false);
                  }}
                >
                  {setup.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <span style={{ flex: 1 }} />
      <button disabled={!enabled} onClick={onChat}>Chat</button>
      <button disabled={!enabled} onClick={onPlayers}>Players</button>
    </div>
  );
}

interface SidebarProps {
  maps: string[];
  activeMap: string;
  onMapChange: (map: string) => void;
  moduleInfo: { name: string; description?: string; version?: string };
  images?: Map<string, string>;
  pieceWindows?: PieceWindow[];
  activePieceWindow?: string;
  onPieceWindowChange?: (pw: string) => void;
}

export function Sidebar({
  maps,
  activeMap,
  onMapChange,
  moduleInfo,
  images,
  pieceWindows = [],
  activePieceWindow,
  onPieceWindowChange,
}: SidebarProps) {
  const [expandedPWs, setExpandedPWs] = useState<Set<string>>(new Set());

  // Group pieces by their 'group' property
  const groupPieces = (pieces: PieceData[]): Map<string, PieceData[]> => {
    const groups: Map<string, PieceData[]> = new Map();
    for (const piece of pieces) {
      const group = piece.properties?.group || 'Ungrouped';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(piece);
    }
    return groups;
  };

  const togglePW = (name: string) => {
    const newSet = new Set(expandedPWs);
    if (newSet.has(name)) {
      newSet.delete(name);
    } else {
      newSet.add(name);
    }
    setExpandedPWs(newSet);
    onPieceWindowChange?.(name);
  };

  const activePW = pieceWindows.find(pw => pw.name === activePieceWindow);

  return (
    <aside className="sidebar">
      <h2>Maps</h2>
      {maps.length > 0 ? (
        <ul className="map-list">
          {maps.map((mapName) => (
            <li
              key={mapName}
              className={activeMap === mapName ? 'active' : ''}
              onClick={() => onMapChange(mapName)}
            >
              {mapName}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>No maps</p>
      )}

      <h2>Counters</h2>
      {pieceWindows.length > 0 ? (
        <div className="piece-windows">
          {pieceWindows.map((pw) => {
            const grouped = groupPieces(pw.pieces);
            const groupsList = Array.from(grouped.entries());
            return (
            <div key={pw.name} className="piece-window-item">
              <div 
                className={`piece-window-header ${activePieceWindow === pw.name ? 'active' : ''}`}
                onClick={() => togglePW(pw.name)}
              >
                <span>{pw.name}</span>
                <span className="piece-count">({pw.pieces.length})</span>
                <span className="expand-icon">{expandedPWs.has(pw.name) ? '▼' : '▶'}</span>
              </div>
              {expandedPWs.has(pw.name) && pw.pieces.length > 0 && (
                <div className="piece-groups">
                  {groupsList.map(([groupName, piecesInGroup]) => (
                    <div key={groupName} className="piece-group">
                      <div className="group-header">{groupName} ({piecesInGroup.length})</div>
                      <div className="piece-grid">
                        {piecesInGroup.slice(0, 30).map((piece: PieceData, i: number) => {
                          // Try multiple paths: direct name, with images/ prefix
                          const imgSrc = 
                            (piece.imagePath && images?.get(piece.imagePath)) ||
                            (piece.imagePath && images?.get('images/' + piece.imagePath)) ||
                            undefined;
                          
                          // Handle drag start
                          const handleDragStart = (e: React.DragEvent) => {
                            e.dataTransfer.setData('piece', JSON.stringify(piece));
                            e.dataTransfer.effectAllowed = 'copy';
                          };
                          
                          return (
                            <div 
                              key={piece.id || i} 
                              className="piece-item" 
                              title={piece.name}
                              draggable={true}
                              onDragStart={handleDragStart}
                            >
                              {imgSrc ? (
                                <img src={imgSrc} alt={piece.name} />
                              ) : (
                                <div className="piece-no-image">○</div>
                              )}
                              <span className="piece-name">{piece.name}</span>
                            </div>
                          );
                        })}
                        {piecesInGroup.length > 30 && (
                          <div className="more">+{piecesInGroup.length - 30} more in {groupName}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>No counters</p>
      )}

      <h2>Info</h2>
      <div style={{ fontSize: '0.75rem', color: '#666' }}>
        <p>{moduleInfo.description}</p>
        {moduleInfo.version && <p>Version: {moduleInfo.version}</p>}
        <p>Images: {images?.size || 0}</p>
      </div>
    </aside>
  );
}

export default Toolbar;