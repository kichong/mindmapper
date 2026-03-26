# Mindmapper Agent Guide

## Start
- Read `MAP.md` first for routing.
- Read `README.md` for product scope and current layout.
- Read `llms.txt` before touching JSON import/export behavior.

## High-Signal Files
- `src/App.tsx`: canvas runtime, input handling, selection, and feature orchestration.
- `src/components/`: toolbar, workspace panel, actions panel, and viewport controls.
- `src/state/MindMapContext.tsx`: types, reducer, history rules, and local persistence.
- `src/utils/mindMapDocument.ts`: backward-compatible JSON sanitization and serialization.
- `src/constants/mindMap.ts`: shared sizing, colors, shortcuts, and canvas constants.

## Guardrails
- Preserve the four-array JSON contract: `nodes`, `annotations`, `shapes`, `crossLinks`.
- Route all import/export changes through `src/utils/mindMapDocument.ts`.
- Keep `normalizeTextSize` in the loop for created, imported, or updated text records.
- Reuse shared constants and utility modules instead of redefining geometry, typography, or view math in components.
- Keep desktop panel changes inside `src/components/` and styling in `src/App.css` / `src/index.css`.
- Ignore `dist/`, `node_modules/`, and `.codex/` when orienting or documenting the repo.

## Efficient Workflow
1. Start from `MAP.md`, then open only the files for the task area.
2. For behavior changes, inspect `src/App.tsx` plus the relevant shared utility or state file.
3. For UI chrome changes, inspect the extracted component in `src/components/` before editing `src/App.tsx`.
4. After changes, run `npm run lint` and `npm run build`.

## Maintenance
- Update `MAP.md` if routing changes.
- Update this file when guardrails or high-signal entry points change.
