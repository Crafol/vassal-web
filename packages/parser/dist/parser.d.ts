/**
 * XML Parser for VASSAL build.xml
 * Transforms the XML structure into JavaScript objects
 */
import { VassalArchive } from './zip.js';
import type { VassalModule } from './types.js';
export interface ParsedModule {
    module: VassalModule;
    images: Map<string, string>;
}
export declare class VassalParser {
    private archive;
    private xmlData;
    constructor(archive: VassalArchive);
    /**
     * Parse the .vmod file and return a structured module
     */
    parse(): ParsedModule;
    private parseXml;
    /**
     * Flatten XML object structure to our VassalElement format
     */
    private flattenXml;
    private extractModuleInfo;
    private extractMaps;
    private findElements;
    private getImagePath;
    private extractPiece;
    private extractDecks;
    private extractDice;
    private extractGlobalProperties;
    /**
     * Extract ZonedGrid data (HexGrid + Zones) from a board element
     */
    private extractZonedGrid;
    private generateId;
}
/**
 * Convenience function to parse a .vmod file
 */
export declare function parseVmod(filePath: string): ParsedModule;
//# sourceMappingURL=parser.d.ts.map