/**
 * VASSAL-WEB Parser
 * Parses .vmod files (ZIP format) and extracts build.xml and resources
 */

export { VassalArchive, type VassalArchiveOptions } from './zip.js';
export { VassalParser, type ParsedModule } from './parser.js';
export type {
  VassalElement,
  ModuleInfo,
  MapData,
  BoardData,
  PieceData,
} from './types.js';