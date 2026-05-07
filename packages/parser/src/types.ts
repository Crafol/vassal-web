/**
 * TypeScript interfaces for VASSAL module structures
 */

export interface VassalElement {
  type: string;
  attributes: Record<string, string>;
  children: VassalElement[];
  /** Raw text content for leaf nodes */
  text?: string;
}

export interface ModuleInfo {
  name: string;
  version?: string;
  description?: string;
  author?: string;
}

export interface MapData {
  name: string;
  boards: BoardData[];
  pieces: PieceData[];
  gridType?: string;
  gridDimensions?: {
    width: number;
    height: number;
  };
}

export interface HexGridData {
  dx: number;
  dy: number;
  x0: number;
  y0: number;
  color: string;
  snapTo: boolean;
  visible: boolean;
  dotsVisible: boolean;
  cornersLegal: boolean;
  edgesLegal: boolean;
  sideways: boolean;
}

export interface ZoneData {
  name: string;
  path: string; // "x1,y1;x2,y2;x3,y3;x4,y4"
  locationFormat: string;
  highlightProperty: string;
  useHighlight: boolean;
  useParentGrid: boolean;
}

export interface ZonedGridData {
  hexGrid?: HexGridData;
  zones: ZoneData[];
}

export interface BoardData {
  name: string;
  imagePath: string;
  location?: {
    x: number;
    y: number;
  };
  dimensions?: {
    width: number;
    height: number;
  };
  grid?: ZonedGridData;
}

export interface PieceData {
  id: string;
  name: string;
  imagePath: string;
  type: string;
  position?: {
    x: number;
    y: number;
  };
  layer?: number;
  properties: Record<string, string>;
  commands: PieceCommand[];
}

export interface PieceCommand {
  name: string;
  key: string;
}

export interface DeckData {
  name: string;
  pieces: PieceData[];
  drawFaceUp: boolean;
  shuffle: boolean;
}

export interface DieData {
  name: string;
  sides: number;
  value: number;
}

export interface GlobalProperty {
  name: string;
  value: string;
  type: 'string' | 'number' | 'boolean';
}

export interface VassalModule {
  info: ModuleInfo;
  maps: MapData[];
  decks: DeckData[];
  dice: DieData[];
  globalProperties: GlobalProperty[];
  rawXml: VassalElement;
}