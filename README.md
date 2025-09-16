# Mindmapper React Canvas Seed

This branch starts the React rewrite of Mindmapper with the smallest possible feature set. The app renders a full-screen canvas
and draws an interactive mind map so we can verify rendering, resizing, and device pixel ratio handling.

## What works right now
- Drag any node to reposition it; connectors redraw automatically.
- Use the floating toolbar to add children, delete the active node (except the root), and undo/redo.
- Keyboard shortcuts mirror the toolbar: `Enter` adds a child, `Delete`/`Backspace` removes the selection, `Ctrl/Cmd+Z` undoes,
  and `Ctrl/Cmd+Y` (or `Shift+Ctrl/Cmd+Z`) redoes.
- The app auto-saves to your browser. Refreshing the dev server restores the last map you edited.
- Toolbar buttons now let you export a JSON snapshot, re-import a saved file, or download the current canvas as a PNG.

## Prerequisites
- Node.js 18+
- npm 9+

## Install and run locally
```bash
npm install
npm run dev
```

The dev server prints a local URL (default `http://localhost:5173`). Open it to drag the purple root node, spawn children, and use the toolbar or shortcuts to undo, redo, or delete nodes. Resize the window to confirm the canvas remains responsive.

### Export and import helpers
- **Export JSON** downloads a machine-readable snapshot of every node in the current map.
- **Import JSON** accepts a previously exported file and replaces the current map contents with it.
- **Export PNG** saves an image of the current canvas view so you can share quick diagrams.

Every change is also stored in `localStorage`, so reloading the page brings back the latest map without needing to import.

## Build for production
```bash
npm run build
```
