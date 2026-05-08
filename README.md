# VASSAL Web

VASSAL Engine reimplemented in JavaScript for web browser. A board game engine that allows you to create and play turn-based strategy games in the browser.

## Features

- Load VASSAL modules (.vmod files) in the browser
- Interactive game board with zoom and pan
- Piece management and dragging
- Game state save/load (.vsav files)
- Multi-package monorepo architecture

## Requirements

- Node.js >= 20.0.0
- pnpm >= 8.0.0

## Modulo de pruebas

Donnerschlag_v1.22.vmod

Es el modulo que se eta usando para las pruebas de desarrollo.

## Installation

```bash
# Install dependencies
pnpm install
```

## Development

```bash
# Start development server (port 3000)
pnpm dev

# Build all packages
pnpm run build

# Run tests
pnpm test

# Lint code
pnpm run lint
```

## Project Structure

```
vassal-web/
├── packages/
│   ├── parser/      # VASSAL module (.vmod) parsing
│   ├── renderer/   # Canvas rendering engine
│   ├── engine/    # Game logic and state
│   ├── server/    # Local server utilities
│   └── ui/        # React UI
├── modulos/       # Test modules
├── pnpm-workspace.yaml
└── package.json
```

## Architecture

This is a **monorepo** using pnpm workspaces:

- **parser** - Parses .vmod (ZIP) files, extracts buildFile.xml, maps, piece windows, images
- **renderer** - Canvas-based rendering with zoom/pan, piece shadows
- **engine** - Game state management, piece positioning
- **server** - Serves module assets and game save/load
- **ui** - React interface for module loading, map display, piece selection

### VASSAL Module Structure

VASSAL modules (.vmod) are ZIP archives containing:

- `buildFile.xml` - Module definition (boards, pieces, game logic)
- `images/` - Game assets (board images, piece images)
- `sounds/` - Audio files (optional)
- `extensions/` - Module extensions (optional)

### XML Element Types

VASSAL uses prefixed element types. Try both formats:

```typescript
// Without prefix (older modules)
findElements(xmlData, 'GameModule')
findElements(xmlData, 'BoardPicker')
findElements(xmlData, 'Board')

// With prefix (newer modules)
findElements(xmlData, 'VASSAL.build.module.GameModule')
findElements(xmlData, 'VASSAL.build.module.map.BoardPicker')
findElements(xmlData, 'VASSAL.build.module.map.boardPicker.Board')
```

## Known Issues

- Parser must handle both prefixed and non-prefixed element types
- Piece images stored in module's images/ folder
- Some modules use different XML structures

## Usage

1. Start dev server: `pnpm dev`
2. Open http://localhost:3000
3. Click "Load Module" and select a .vmod file
4. The module loads and displays the game board
5. Drag pieces from sidebar to the board
6. Use mouse wheel to zoom, Alt+drag to pan
7. Save game with Save button, restore with Load

## Technologies

- **TypeScript** - Type-safe JavaScript
- **React** - UI framework
- **Vite** - Build tool and dev server
- **pnpm** - Package manager (workspaces)
- **JSZip** - ZIP file handling

## License

Open source. Based on the [VASSAL](https://vassalengine.org/) project.

## Credits

- [VASSAL Engine](https://vassalengine.org/) - Original Java project
- [Reference Manual](https://vassalengine.org/doc/latest/ReferenceManual/Concepts.html) - Module structure documentation
- IA Opencode - MiniMax M2.5 Free OpenCode Zen