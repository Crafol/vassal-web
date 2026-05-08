import JSZip from 'jszip';

export interface VassalElement {
  type: string;
  attributes: Record<string, string>;
  children: VassalElement[];
  parent?: VassalElement;
}

export interface ModuleInfo {
  name: string;
  description?: string;
  version?: string;
}

export interface PredefinedSetupData {
  name: string;
  description?: string;
  file?: string;
  useFile?: boolean;
}

export interface HexGridData {
  dx: number;
  dy: number;
  x0: number;
  y0: number;
  color: string;
  visible: boolean;
  snapTo: boolean;
  dotsVisible?: boolean;
  cornersLegal?: boolean;
  edgesLegal?: boolean;
  sideways: boolean;
  numbering?: HexGridNumberingData;
}

export interface HexGridNumberingData {
  color: string;
  fontSize: number;
  first: string;  // First character/number
  hType: 'A' | 'N';  // Alphabetical or Numeric horizontal
  vType: 'A' | 'N';  // Alphabetical or Numeric vertical
  hLeading: number;  // Leading zeros horizontal
  vLeading: number;  // Leading zeros vertical
  hOff: number;  // Horizontal offset
  vOff: number;  // Vertical offset
  hDescend: boolean;  // Horizontal descend
  vDescend: boolean;  // Vertical descend
  stagger: boolean;  // Stagger for hex grids
  locationFormat: string;
  rotateText: number;
  sep: string;
  visible: boolean;
}

export interface ZoneHighlighterData {
  name: string;
  color: string;
  coverage: 'entire' | 'border';
  style: 'solid' | 'striped' | 'crosshatched' | 'image';
  imageUrl?: string;
  opacity: number;
}

export interface ZoneData {
  name: string;
  path: string;
  locationFormat?: string;
  highlightProperty?: string;
  useHighlight?: boolean;
  useParentGrid?: boolean;
  visible?: boolean;
}

export interface ZonedGridData {
  hexGrid?: HexGridData;
  zones: ZoneData[];
  highlighters?: ZoneHighlighterData[];
}

export interface BoardData {
  name: string;
  imagePath: string;
  x?: number;
  y?: number;
  grid?: ZonedGridData;
}

export interface MapData {
  name: string;
  boards: BoardData[];
}

export interface PieceData {
  id: string;
  name: string;
  imagePath: string;
  type: string;
  properties: Record<string, string>;
}

export interface PieceWindowData {
  name: string;
  pieces: PieceData[];
}

export interface VassalModule {
  info: ModuleInfo;
  maps: MapData[];
  pieceWindows: PieceWindowData[];
  setups: PredefinedSetupData[];
  initialSetup?: string | null;
}

export interface ParsedModule {
  module: VassalModule;
  images: Map<string, string>;
}

// XML Parser using DOM
function parseXmlSimple(xml: string): VassalElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  
  function convertNode(node: Node): VassalElement {
    const el: VassalElement = {
      type: node.nodeName,
      attributes: {},
      children: [],
    };
    
    if (node.nodeType === 1) {
      const elem = node as Element;
      for (const attr of Array.from(elem.attributes)) {
        el.attributes[attr.name] = attr.value;
      }
    }
    
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        // Element nodes
        el.children.push(convertNode(child));
      } else if (child.nodeType === 3 && child.textContent?.trim()) {
        // Text nodes with content - store as special element
        el.children.push({
          type: '#text',
          attributes: { '#text': child.textContent },
          children: [],
        });
      }
    }
    
    return el;
  }
  
  return convertNode(doc.documentElement);
}

// Recursive search for element type
function findElements(parent: VassalElement, type: string): VassalElement[] {
  const results: VassalElement[] = [];
  const search = (el: VassalElement) => {
    if (el.type === type) results.push(el);
    for (const child of el.children) search(child);
  };
  search(parent);
  return results;
}

// Extract maps using Map structure
// Each VASSAL.build.module.map.boardPicker.Board inside a BoardPicker is a separate map
function extractMaps(xmlData: VassalElement): MapData[] {
  if (!xmlData) return [];

  const mapDataList: MapData[] = [];

  // Find all Map elements
  const mapsPrefixed = findElements(xmlData, 'VASSAL.build.module.Map');
  const mapsPlain = findElements(xmlData, 'Map');
  const allMaps = [...mapsPrefixed, ...mapsPlain];

  console.log('extractMaps: Map containers found:', allMaps.length);

  for (const mapEl of allMaps) {
    // Find BoardPicker inside this Map
    const boardPickersPrefixed = findElements(mapEl, 'VASSAL.build.module.map.BoardPicker');
    const boardPickersPlain = findElements(mapEl, 'BoardPicker');
    const boardPickers = [...boardPickersPrefixed, ...boardPickersPlain];

    console.log('extractMaps: BoardPicker found:', boardPickers.length);

    for (const bp of boardPickers) {
      // Find ALL boards within BoardPicker - each is a separate map!
      const boardsPrefixed = findElements(bp, 'VASSAL.build.module.map.boardPicker.Board');
      const boardsPlain = findElements(bp, 'Board');
      const boards = [...boardsPrefixed, ...boardsPlain];

      console.log('extractMaps: Found', boards.length, 'boards (maps) in BoardPicker');

      for (const board of boards) {
        const boardName = board.attributes['name'] || 'Unnamed Map';
        console.log('extractMaps: processing board/map:', boardName);

        // Extract grid info for this board
        const zg = findElements(board, 'VASSAL.build.module.map.boardPicker.board.ZonedGrid');
        const hg = findElements(board, 'VASSAL.build.module.map.boardPicker.board.HexGrid');

        let grid: ZonedGridData | undefined;

        // Extract HexGrid
        if (hg.length > 0) {
          const attrs = hg[0].attributes;
          const hexGrid: HexGridData = {
            dx: parseFloat(attrs['dx'] || '0'),
            dy: parseFloat(attrs['dy'] || '0'),
            x0: parseFloat(attrs['x0'] || '0'),
            y0: parseFloat(attrs['y0'] || '0'),
            color: attrs['color'] || '0,0,0',
            visible: attrs['visible'] !== 'false',
            snapTo: attrs['snapTo'] === 'true',
            dotsVisible: attrs['dotsVisible'] === 'true',
            cornersLegal: attrs['cornersLegal'] !== 'false',
            edgesLegal: attrs['edgesLegal'] !== 'false',
            sideways: attrs['sideways'] === 'true',
          };

          // Extract HexGridNumbering (child of HexGrid)
          const hn = findElements(hg[0], 'VASSAL.build.module.map.boardPicker.board.mapgrid.HexGridNumbering');
          if (hn.length > 0) {
            const hnAttrs = hn[0].attributes;
            hexGrid.numbering = {
              color: hnAttrs['color'] || '0,0,0',
              fontSize: parseInt(hnAttrs['fontSize'] || '12', 10),
              first: hnAttrs['first'] || 'A',
              hType: (hnAttrs['hType'] as 'A' | 'N') || 'A',
              vType: (hnAttrs['vType'] as 'A' | 'N') || 'N',
              hLeading: parseInt(hnAttrs['hLeading'] || '0', 10),
              vLeading: parseInt(hnAttrs['vLeading'] || '0', 10),
              hOff: parseInt(hnAttrs['hOff'] || '0', 10),
              vOff: parseInt(hnAttrs['vOff'] || '0', 10),
              hDescend: hnAttrs['hDescend'] === 'true',
              vDescend: hnAttrs['vDescend'] === 'true',
              stagger: hnAttrs['stagger'] === 'true',
              locationFormat: hnAttrs['locationFormat'] || '$gridLocation$',
              rotateText: parseInt(hnAttrs['rotateText'] || '0', 10),
              sep: hnAttrs['sep'] || '',
              visible: hnAttrs['visible'] !== 'false',
            };
            console.log('extractMaps: found HexGridNumbering for', boardName, hexGrid.numbering);
          }

          grid = { hexGrid, zones: [] };
        }

        // Extract Zones if ZonedGrid exists
        if (zg.length > 0) {
          const zones: ZoneData[] = [];
          const zoneElements = findElements(zg[0], 'VASSAL.build.module.map.boardPicker.board.mapgrid.Zone');

          for (const zoneEl of zoneElements) {
            const zone: ZoneData = {
              name: zoneEl.attributes['name'] || '',
              path: zoneEl.attributes['path'] || '',
              locationFormat: zoneEl.attributes['locationFormat'],
              highlightProperty: zoneEl.attributes['highlightProperty'],
              useHighlight: zoneEl.attributes['useHighlight'] === 'true',
              useParentGrid: zoneEl.attributes['useParentGrid'] === 'true',
              visible: zoneEl.attributes['visible'] !== 'false',
            };
            if (zone.name && zone.path) {
              zones.push(zone);
            }
          }

          if (zones.length > 0) {
            if (!grid) {
              grid = { zones };
            } else {
              grid.zones = zones;
            }
          }

          // Extract ZoneHighlighters
          const highlighters: ZoneHighlighterData[] = [];
          const hlElements = findElements(zg[0], 'VASSAL.build.module.map.boardPicker.board.mapgrid.ZoneHighlighter');
          for (const hlEl of hlElements) {
            const hl: ZoneHighlighterData = {
              name: hlEl.attributes['name'] || '',
              color: hlEl.attributes['color'] || '255,255,0',
              coverage: (hlEl.attributes['coverage'] as 'entire' | 'border') || 'entire',
              style: (hlEl.attributes['style'] as 'solid' | 'striped' | 'crosshatched' | 'image') || 'solid',
              imageUrl: hlEl.attributes['imageUrl'],
              opacity: parseInt(hlEl.attributes['opacity'] || '50', 10) / 100,
            };
            if (hl.name) {
              highlighters.push(hl);
            }
          }
          if (highlighters.length > 0) {
            console.log('extractMaps: found ZoneHighlighters:', highlighters.length);
            if (!grid) {
              grid = { zones: [], highlighters };
            } else {
              grid.highlighters = highlighters;
            }
          }
        }

        const boardData: BoardData = {
          name: boardName,
          imagePath: board.attributes['image'] || '',
          grid,
        };

        // Create a MapData for each board (each board is a separate map)
        const mapData: MapData = {
          name: boardName,  // Use board name as map name
          boards: [boardData],
        };

        console.log('extractMaps: created map', boardName, 'with image:', boardData.imagePath.substring(0, 50));

        if (boardData.imagePath) {
          mapDataList.push(mapData);
        }
      }
    }
  }

  console.log('extractMaps: total maps extracted:', mapDataList.length);
  console.log('extractMaps: map names:', mapDataList.map(m => m.name));
return mapDataList;
}

// Extract piece windows from various VASSAL formats
function extractPieceWindows(xmlData: VassalElement): PieceWindowData[] {
  if (!xmlData) return [];
  
  const windows: PieceWindowData[] = [];
  
  // Try PieceWindow format (VASSAL structure: PieceWindow > TabWidget > ListWidget > PieceSlot)
  let pieceWindows = findElements(xmlData, 'VASSAL.build.module.PieceWindow');
  if (pieceWindows.length === 0) pieceWindows = findElements(xmlData, 'PieceWindow');
  console.log('extractPieceWindows: PieceWindow found:', pieceWindows.length);
  
  for (const pw of pieceWindows) {
    // Debug: show child element types
    const childTypes = new Set<string>();
    const collect = (el: VassalElement) => {
      if (el.type) childTypes.add(el.type);
      for (const c of el.children) collect(c);
    };
    collect(pw);
    console.log('extractPieceWindows: child types in PieceWindow:', [...childTypes].slice(0, 15));
    
    // Find TabWidgets inside PieceWindow
    let tabWidgets = findElements(pw, 'VASSAL.build.widget.TabWidget');
    if (tabWidgets.length === 0) tabWidgets = findElements(pw, 'TabWidget');
    console.log('extractPieceWindows: TabWidget found:', tabWidgets.length);
    
    for (const tab of tabWidgets) {
      const tabName = tab.attributes['entryName'] || 'Unnamed Tab';
      console.log('extractPieceWindows: processing tab:', tabName);
      
      // Find ListWidgets inside each TabWidget
      let listWidgets = findElements(tab, 'VASSAL.build.widget.ListWidget');
      if (listWidgets.length === 0) listWidgets = findElements(tab, 'ListWidget');
      console.log('extractPieceWindows: ListWidget in', tabName, ':', listWidgets.length);
      
      for (const lw of listWidgets) {
        const listName = lw.attributes['entryName'] || 'Unnamed List';
        
        // Find PieceSlots inside each ListWidget
        let pieceSlots = findElements(lw, 'VASSAL.build.widget.PieceSlot');
        if (pieceSlots.length === 0) pieceSlots = findElements(lw, 'PieceSlot');
        
        if (pieceSlots.length > 0) {
          const windowData: PieceWindowData = {
            name: `${tabName} - ${listName}`,
            pieces: [],
          };
          
          // Debug first piece slot of this list only (check listName)
          const debugKey = `debugged_${tabName}_${listName}`;
          // @ts-ignore - simple debug flag
          if ((windowData as any)._debugCheck !== debugKey) {
            // @ts-ignore
            (windowData as any)._debugCheck = debugKey;
            const firstPiece = pieceSlots[0];
            console.log('extractPieceWindows: DEBUG entryName:', firstPiece.attributes['entryName']);
            console.log('extractPieceWindows: DEBUG all attrs:', JSON.stringify(firstPiece.attributes));
            console.log('extractPieceWindows: DEBUG children:', firstPiece.children.length);
            for (let i = 0; i < Math.min(firstPiece.children.length, 5); i++) {
              const c = firstPiece.children[i];
              console.log('extractPieceWindows: DEBUG child', i, 'type:', c.type, 'attrs:', JSON.stringify(c.attributes));
            }
          }
          
          for (const piece of pieceSlots) {
            const entryName = piece.attributes['entryName'] || '';
            const gpid = piece.attributes['gpid'] || '';
            const height = piece.attributes['height'] || '';
            const width = piece.attributes['width'] || '';
            
            // Piece definition is in text content: "+/null/prototype;Name piece;;;image.png;Name/..."
            let imagePath = '';
            let bodyText = '';
            
            for (const child of piece.children) {
              if (child.type === '#text') {
                bodyText += (child.attributes as any)['#text'] || '';
              }
            }
            
            console.log('extractPieceWindows: bodyText for', entryName, ':', bodyText.substring(0, 100));
            
            // Find image in the text (look for .png, .gif, .jpg)
            const imgMatch = bodyText.match(/([a-zA-Z0-9_\-\.]+\.(png|gif|jpg|jpeg))/i);
            if (imgMatch) {
              imagePath = imgMatch[1];
            }
            
            if (imagePath || entryName) {
              windowData.pieces.push({
                id: gpid || piece.attributes['id'] || Math.random().toString(36).slice(2),
                name: entryName || 'Unnamed Piece',
                imagePath: imagePath,
                type: 'PieceSlot',
                properties: { height, width },
              });
            }
          }
          
          console.log('extractPieceWindows: parsed pieces in', listName, ':', windowData.pieces.length);
          if (windowData.pieces.length > 0) {
            console.log('extractPieceWindows: first piece:', windowData.pieces[0]);
            windows.push(windowData);
          }
        }
      }
    }
  }
  
  const totalPieces = windows.reduce((sum, w) => sum + w.pieces.length, 0);
  console.log('extractPieceWindows: total windows:', windows.length, 'total pieces:', totalPieces);
  return windows;
}

export async function parseVmodFile(file: File): Promise<ParsedModule> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // Get buildFile.xml or buildFile
  let buildXml = await zip.file('buildFile.xml')?.async('string');
  if (!buildXml) {
    buildXml = await zip.file('buildFile')?.async('string');
  }
  
  if (!buildXml) {
    throw new Error('buildFile.xml or buildFile not found in archive');
  }

  const xmlData = parseXmlSimple(buildXml);

  // Debug: show root type
  console.log('Parse: root type:', xmlData.type);

  // Extract module info - find GameModule (VASSAL.build.GameModule)
  let gameModule = findElements(xmlData, 'VASSAL.build.GameModule')[0];
  if (!gameModule) gameModule = findElements(xmlData, 'GameModule')[0];
  const info: ModuleInfo = {
    name: gameModule?.attributes['name'] || 'Unnamed Module',
    description: gameModule?.attributes['description'],
    version: gameModule?.attributes['version'],
  };
  console.log('Parse: module name:', info.name, 'gameModule found:', !!gameModule);

  // Extract maps
  const maps = extractMaps(xmlData);
  console.log('Parse: maps extracted:', maps.length);

  // Extract piece windows
  const pieceWindows = extractPieceWindows(xmlData);
  console.log('Parse: piece windows extracted:', pieceWindows.length);

  // Extract images
  const images = new Map<string, string>();
  const imageRegex = /\.(png|jpg|jpeg|gif)$/i;
  
  // Debug first few image paths
  let debugCount = 0;
  
  for (const [path, file] of Object.entries(zip.files)) {
    if (imageRegex.test(path) && !file.dir) {
      const data = await file.async('blob');
      const url = URL.createObjectURL(data);
      images.set(path, url);
      
      // Debug: show first 10 image paths
      if (debugCount++ < 10) {
        console.log('Parse: image path in zip:', path);
      }
    }
  }
  console.log('Parse: images extracted:', images.size);

  const module: VassalModule = {
    info,
    maps,
    pieceWindows,
    setups: [],
    initialSetup: null,
  };

  return { module, images };
}