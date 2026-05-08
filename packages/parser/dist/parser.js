/**
 * XML Parser for VASSAL build.xml
 * Transforms the XML structure into JavaScript objects
 */
import { XMLParser } from 'fast-xml-parser';
import { VassalArchive } from './zip.js';
export class VassalParser {
    archive;
    xmlData = null;
    constructor(archive) {
        this.archive = archive;
    }
    /**
     * Parse the .vmod file and return a structured module
     */
    parse() {
        const buildXml = this.archive.getBuildXml();
        if (!buildXml) {
            throw new Error('buildFile.xml not found in archive');
        }
        this.xmlData = this.parseXml(buildXml);
        const module = {
            info: this.extractModuleInfo(),
            maps: this.extractMaps(),
            decks: this.extractDecks(),
            dice: this.extractDice(),
            globalProperties: this.extractGlobalProperties(),
            rawXml: this.xmlData,
        };
        const images = this.archive.getImages();
        return { module, images };
    }
    parseXml(xml) {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: true,
            parseTagValue: true,
        });
        const result = parser.parse(xml);
        return this.flattenXml(result);
    }
    /**
     * Flatten XML object structure to our VassalElement format
     */
    flattenXml(obj) {
        if (obj === null || obj === undefined) {
            return { type: '', attributes: {}, children: [] };
        }
        if (typeof obj !== 'object') {
            return { type: '', attributes: {}, children: [], text: String(obj) };
        }
        const record = obj;
        const keys = Object.keys(record);
        // Find the root element (key that's not @_ attributes or #text)
        const elementKeys = keys.filter((k) => !k.startsWith('@_') && k !== '#text');
        if (elementKeys.length === 0) {
            return { type: '', attributes: {}, children: [], text: String(record['#text'] || '') };
        }
        const type = elementKeys[0];
        const value = record[type];
        // Extract attributes
        const attributes = {};
        for (const key of keys) {
            if (key.startsWith('@_')) {
                const attrName = key.substring(2);
                attributes[attrName] = String(record[key]);
            }
        }
        // Process children
        const children = [];
        if (Array.isArray(value)) {
            for (const item of value) {
                children.push(this.flattenXml(item));
            }
        }
        else if (typeof value === 'object' && value !== null) {
            const child = this.flattenXml(value);
            if (child.type) {
                children.push(child);
            }
        }
        // Text content
        const text = record['#text'];
        return { type, attributes, children, text };
    }
    extractModuleInfo() {
        if (!this.xmlData) {
            return { name: 'Unknown' };
        }
        // VASSAL stores metadata in the root element's attributes
        const attrs = this.xmlData.attributes;
        const info = {
            name: attrs['name'] || attrs['moduleName'] || 'Unknown Module',
            version: attrs['version'] || undefined,
            description: attrs['description'] || undefined,
            author: attrs['author'] || undefined,
        };
        // Also check children for additional info
        for (const child of this.xmlData.children) {
            if (child.type === 'description') {
                info.description = child.text || child.attributes['value'];
            }
            else if (child.type === 'version') {
                info.version = child.text || child.attributes['value'];
            }
            else if (child.type === 'author') {
                info.author = child.text || child.attributes['value'];
            }
        }
        return info;
    }
    extractMaps() {
        if (!this.xmlData) {
            return [];
        }
        const maps = [];
        // Find VASSAL.build.module.Map elements
        const mapElements = this.findElements(this.xmlData, 'VASSAL.build.module.Map');
        for (const mapEl of mapElements) {
            const map = {
                name: mapEl.attributes['name'] || 'Unnamed Map',
                boards: [],
                pieces: [],
            };
            // Extract boards
            const boardElements = this.findElements(mapEl, 'VASSAL.build.module.RandomBoard');
            for (const boardEl of boardElements) {
                const board = {
                    name: boardEl.attributes['boardName'] || 'Unnamed Board',
                    imagePath: this.getImagePath(boardEl),
                };
                // Get position from attributes
                if (boardEl.attributes['x']) {
                    board.location = {
                        x: parseInt(boardEl.attributes['x'], 10),
                        y: parseInt(boardEl.attributes['y'], 10),
                    };
                }
                // Get dimensions
                if (boardEl.attributes['width']) {
                    board.dimensions = {
                        width: parseInt(boardEl.attributes['width'], 10),
                        height: parseInt(boardEl.attributes['height'], 10),
                    };
                }
                // Extract ZonedGrid (HexGrid + Zones)
                board.grid = this.extractZonedGrid(boardEl);
                map.boards.push(board);
            }
            // Extract pieces
            const pieceElements = this.findElements(mapEl, 'VASSAL.build.module.BasicPiece');
            for (const pieceEl of pieceElements) {
                const piece = this.extractPiece(pieceEl);
                map.pieces.push(piece);
            }
            maps.push(map);
        }
        return maps;
    }
    findElements(parent, type) {
        const results = [];
        const search = (el) => {
            if (el.type === type) {
                results.push(el);
            }
            for (const child of el.children) {
                search(child);
            }
        };
        search(parent);
        return results;
    }
    getImagePath(element) {
        // Try to find image path in attributes or children
        if (element.attributes['image']) {
            return element.attributes['image'];
        }
        // Look for image element
        for (const child of element.children) {
            if (child.type === 'image') {
                return child.attributes['name'] || child.text || '';
            }
        }
        return '';
    }
    extractPiece(element) {
        const piece = {
            id: element.attributes['id'] || this.generateId(),
            name: element.attributes['pieceName'] || 'Unnamed Piece',
            imagePath: this.getImagePath(element),
            type: element.type,
            position: {
                x: parseInt(element.attributes['x'] || '0', 10),
                y: parseInt(element.attributes['y'] || '0', 10),
            },
            layer: parseInt(element.attributes['layer'] || '0', 10),
            properties: {},
            commands: [],
        };
        // Extract properties from BasicName, etc.
        for (const child of element.children) {
            if (child.type === 'VASSAL.counters.BasicName') {
                piece.properties['name'] = child.attributes['name'] || '';
            }
        }
        return piece;
    }
    extractDecks() {
        if (!this.xmlData) {
            return [];
        }
        const decks = [];
        const deckElements = this.findElements(this.xmlData, 'VASSAL.build.module.Deck');
        for (const deckEl of deckElements) {
            const deck = {
                name: deckEl.attributes['name'] || 'Unnamed Deck',
                pieces: [],
                drawFaceUp: deckEl.attributes['drawFaceUp'] === 'true',
                shuffle: deckEl.attributes['shuffle'] === 'true',
            };
            // Extract cards from deck
            const cardElements = this.findElements(deckEl, 'VASSAL.build.module.CardSlot');
            for (const cardEl of cardElements) {
                const piece = this.extractPiece(cardEl);
                deck.pieces.push(piece);
            }
            decks.push(deck);
        }
        return decks;
    }
    extractDice() {
        if (!this.xmlData) {
            return [];
        }
        const dice = [];
        const dieElements = this.findElements(this.xmlData, 'VASSAL.build.module.DieRoll');
        for (const dieEl of dieElements) {
            dice.push({
                name: dieEl.attributes['name'] || 'Unnamed Die',
                sides: parseInt(dieEl.attributes['max'] || '6', 10),
                value: 1,
            });
        }
        return dice;
    }
    extractGlobalProperties() {
        if (!this.xmlData) {
            return [];
        }
        const props = [];
        const propElements = this.findElements(this.xmlData, 'VASSAL.build.module.GlobalProperty');
        for (const propEl of propElements) {
            props.push({
                name: propEl.attributes['name'] || 'unnamed',
                value: propEl.attributes['value'] || '',
                type: propEl.attributes['type'] || 'string',
            });
        }
        return props;
    }
    /**
     * Extract ZonedGrid data (HexGrid + Zones) from a board element
     */
    extractZonedGrid(boardEl) {
        // Look for ZonedGrid element - try both prefixed and non-prefixed versions
        const zonedGridEls = boardEl.children.filter((el) => el.type === 'VASSAL.build.module.map.boardPicker.board.ZonedGrid' ||
            el.type === 'ZonedGrid');
        if (zonedGridEls.length === 0) {
            return undefined;
        }
        const zonedGridEl = zonedGridEls[0];
        const result = {
            hexGrid: undefined,
            zones: [],
        };
        // Extract HexGrid
        const hexGridEls = zonedGridEl.children.filter((el) => el.type === 'VASSAL.build.module.map.boardPicker.board.HexGrid' ||
            el.type === 'HexGrid');
        if (hexGridEls.length > 0) {
            const hexEl = hexGridEls[0];
            const hexGrid = {
                dx: parseFloat(hexEl.attributes['dx'] || '0'),
                dy: parseFloat(hexEl.attributes['dy'] || '0'),
                x0: parseFloat(hexEl.attributes['x0'] || '0'),
                y0: parseFloat(hexEl.attributes['y0'] || '0'),
                color: hexEl.attributes['color'] || '0,0,0',
                snapTo: hexEl.attributes['snapTo'] === 'true',
                visible: hexEl.attributes['visible'] !== 'false', // default true
                dotsVisible: hexEl.attributes['dotsVisible'] === 'true',
                cornersLegal: hexEl.attributes['cornersLegal'] !== 'false',
                edgesLegal: hexEl.attributes['edgesLegal'] !== 'false',
                sideways: hexEl.attributes['sideways'] === 'true',
            };
            result.hexGrid = hexGrid;
        }
        // Extract Zones
        const zoneEls = zonedGridEl.children.filter((el) => el.type === 'VASSAL.build.module.map.boardPicker.board.mapgrid.Zone' ||
            el.type === 'Zone');
        for (const zoneEl of zoneEls) {
            const useParentGridAttr = zoneEl.attributes['useParentGrid'];
            const zone = {
                name: zoneEl.attributes['name'] || '',
                path: zoneEl.attributes['path'] || '',
                locationFormat: zoneEl.attributes['locationFormat'] || '$name$',
                highlightProperty: zoneEl.attributes['highlightProperty'] || '',
                useHighlight: zoneEl.attributes['useHighlight'] === 'true',
                // Default to true if not specified (undefined or not set)
                useParentGrid: useParentGridAttr === 'true' || useParentGridAttr === undefined,
            };
            if (zone.name && zone.path) {
                result.zones.push(zone);
            }
        }
        // Only return if we have hexGrid or zones
        if (!result.hexGrid && result.zones.length === 0) {
            return undefined;
        }
        return result;
    }
    generateId() {
        return 'piece_' + Math.random().toString(36).substring(2, 9);
    }
}
/**
 * Convenience function to parse a .vmod file
 */
export function parseVmod(filePath) {
    const archive = new VassalArchive(filePath);
    const parser = new VassalParser(archive);
    return parser.parse();
}
//# sourceMappingURL=parser.js.map