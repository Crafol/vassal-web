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

export interface BoardData {
  name: string;
  imagePath: string;
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
function extractMaps(xmlData: VassalElement): MapData[] {
  if (!xmlData) return [];
  
  // Find all Map elements
  const maps = findElements(xmlData, 'VASSAL.build.module.Map');
  console.log('extractMaps: Map found:', maps.length);
  
  const mapDataList: MapData[] = [];
  
  for (const mapEl of maps) {
    // Get map name from mapName attribute
    const mapName = mapEl.attributes['mapName'] || mapEl.attributes['name'] || 'Main Map';
    console.log('extractMaps: processing map:', mapName);
    
    // Find BoardPicker inside this Map
    const boardPickers = findElements(mapEl, 'VASSAL.build.module.map.BoardPicker');
    console.log('extractMaps: BoardPicker in', mapName, ':', boardPickers.length);
    
    for (const bp of boardPickers) {
      // Find boards within BoardPicker - type is "VASSAL.build.module.map.boardPicker.Board"
      const boards = findElements(bp, 'VASSAL.build.module.map.boardPicker.Board');
      console.log('extractMaps: boards in', mapName, ':', boards.length);
      if (boards.length > 0) {
        console.log('extractMaps: first board:', boards[0].attributes);
      }
      
      const mapData: MapData = {
        name: mapName,
        boards: boards.map(b => ({
          name: b.attributes['name'] || 'Unnamed Board',
          imagePath: b.attributes['image'] || '',
        })).filter(b => b.imagePath),
      };
      
      if (mapData.boards.length > 0) {
        mapDataList.push(mapData);
      }
    }
  }
  
  console.log('extractMaps: total maps:', mapDataList.length);
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
  
  for (const [path, file] of Object.entries(zip.files)) {
    if (imageRegex.test(path) && !file.dir) {
      const data = await file.async('blob');
      const url = URL.createObjectURL(data);
      images.set(path, url);
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