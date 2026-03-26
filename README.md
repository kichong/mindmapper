# Mindmapper

Mindmapper is a Vite + React canvas app for sketching and sharing mind maps. It is optimized for fast idea capture, keyboard-first editing, and backward-compatible JSON interchange.

## Quick start
1. `npm install`
2. `npm run dev`
3. Open the local URL Vite prints, usually `http://localhost:5173`

Optional production check:
1. `npm run build`
2. `npm run preview`

## JSON format promise
- Exports keep the same four top-level arrays: `nodes`, `annotations`, `shapes`, and `crossLinks`.
- Importers ignore extra top-level keys such as `metadata`, `canvas`, or `exportedAt` as long as those arrays exist.
- Nodes keep `id`, `parentId`, `text`, `x`, `y`, `color`, and `textSize`.
- Text sizes stay within `small`, `medium`, or `large`; invalid values are normalized back to `medium`.

Read `llms.txt` for the full contract, coordinate guidance, spacing patterns, and example JSON documents.

## What the app supports
- Node trees with multiple root nodes
- Floating text annotations
- Rings, ellipses, rectangles, arrows, and lines
- Cross-links between any two nodes
- Keyboard shortcuts for navigation and editing
- Export to JSON and PNG

## Source layout
- `MAP.md`: repo navigation map for fast orientation
- `AGENTS.md`: minimal working rules for future agents
- `src/App.tsx`: canvas runtime and feature orchestration
- `src/components/`: extracted desktop panels and viewport controls
- `src/state/MindMapContext.tsx`: state types, reducer, history, and persistence
- `src/constants/mindMap.ts`: shared constants and shortcuts
- `src/utils/mindMapDocument.ts`: JSON import/export sanitization and serialization
- `src/utils/`: geometry, typography, export rendering, view math, and download helpers

## Scripts
- `npm run dev`: start the dev server
- `npm run lint`: run ESLint
- `npm run build`: type-check and build for production
- `npm run preview`: preview the built app

## Contributor notes
- Preserve JSON import/export backward compatibility. `llms.txt` and `src/utils/mindMapDocument.ts` are the first places to check before schema-related edits.
- Prefer shared constants and shared utilities over one-off logic in components.
- Run `npm run lint` and `npm run build` before wrapping up changes.
