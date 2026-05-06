# VASSAL Web - Agent Instructions

## Project Overview
VASSAL Engine reimplemented in JavaScript for web browser.

## Build & Run
```bash
npm run dev     # Start dev server (port 3000)
npm run build  # Build all packages
```

## Architecture
- **Monorepo** with pnpm workspaces: `packages/*`
- **Packages**: parser, renderer, engine, server, ui
- **Entry**: packages/ui/src/main.tsx → packages/ui/index.html

## VASSAL Module Structure (Critical)
Based on Reference Manual (https://vassalengine.org/doc/latest/ReferenceManual/Concepts.html):

Try BOTH formats - some modules use prefix, some don't:
```typescript
// WITHOUT prefix (older modules)
findElements(xmlData, 'GameModule')
findElements(xmlData, 'BoardPicker')
findElements(xmlData, 'Board')
findElements(xmlData, 'TabWidget')
findElements(xmlData, 'ListWidget')
findElements(xmlData, 'PieceSlot')

// WITH prefix (newer modules)  
findElements(xmlData, 'VASSAL.build.module.GameModule')
findElements(xmlData, 'VASSAL.build.module.map.BoardPicker')
findElements(xmlData, 'VASSAL.build.module.map.Board')
findElements(xmlData, 'VASSAL.build.module.TabWidget')
findElements(xmlData, 'VASSAL.build.module.ListWidget')
findElements(xmlData, 'PieceSlot')
```

## Known Test Module
- Location: `/home/crafol/Desarrollo/vassal-web/modulos/Donnerschlag_v122.vmod`
- Maps: 1 (named "Main Map")
- Boards: 1 (image: DS_Map_2x.png)
- Pieces: ~156 in PieceWindow + ~16 Markers

## Current Features Working
- Zoom/pan on canvas (mouse wheel + Alt/Shift drag)
- Piece shadows (normal and lifted during drag)
- Drag pieces from sidebar to canvas
- Selection info panel (click to see coords)
- Save/Load game state (.vsav files)

## Common Pitfalls
1. **Parser rewriting destroys working code** - DO NOT rewrite parser.ts without testing! The working parser was lost by rewriting.
2. **Image lookup** - try both `path.png` and `images/path.png`
3. **Coordinate transformation** - use viewportTransform for screen→world conversion
4. **React hooks** - must be called in same order every render (no early returns in component body)
5. **TypeScript strictness** - CanvasManagerHandle type must match between packages

## Test Before Committing
1. Load Donnerschlag module
2. Verify map displays
3. Verify pieces appear in sidebar
4. Drag piece to canvas → should show shadow
5. Zoom with scroll wheel → should work
6. Save → verify .vsav downloads
7. Load → verify pieces restorecorrectly

## Console Commands for Debug
- Browser F12 → Console shows parser logs
- Look for: "extractMaps:", "extractPieceWindows:", "Parsed maps:", "Parsed piece windows:"