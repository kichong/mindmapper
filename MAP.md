# Mindmapper Map

## Purpose
- Small Vite + React mind-mapping app.
- Keep this as a root-only map unless the repo grows enough that one file stops routing quickly.

## Start Here
- `README.md`: product overview, quick start, and current source layout.
- `llms.txt`: locked JSON contract and map-authoring guidance. Keep imports/exports backward compatible with this file.
- `src/App.tsx`: canvas runtime, interaction flow, selection logic, and panel wiring.
- `src/state/MindMapContext.tsx`: state model, reducer, undo/redo, and local persistence.
- `src/utils/mindMapDocument.ts`: JSON import/export sanitization and serialization. Start here for schema-safe changes.

## Quick Routing
- UI chrome and panel layout: `src/components/`, `src/App.css`, `src/index.css`
- Canvas behavior and input handling: `src/App.tsx`
- Shared constants and shortcuts: `src/constants/mindMap.ts`
- Geometry, typography, view fitting, and export rendering: `src/utils/`
- Persistence and history behavior: `src/state/MindMapContext.tsx`
- Import/export compatibility: `llms.txt`, `src/utils/mindMapDocument.ts`

## Layout
- `src/components/`: extracted desktop panels and navigation controls
- `src/constants/`: shared canvas, shortcut, color, and sizing constants
- `src/state/`: app state types, reducer, and persistence
- `src/utils/`: document parsing, download helpers, export rendering, geometry, typography, and view math
- `public/`: static image asset used by the app/repo
- `.github/`: GitHub metadata only

## Commands
- `npm run dev`: local dev server
- `npm run lint`: lint check
- `npm run build`: type-check and production build
- `npm run preview`: preview built app

## Ignore
- `dist/`, `node_modules/`, and `.codex/` are not useful orientation targets.

## Maintenance
- Update this file when file ownership or routing changes.
- Prefer improving this root map over adding more `MAP.md` files.
