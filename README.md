# Mindmapper

Mindmapper is a Vite + React canvas app for sketching and sharing mind maps. It keeps idea capture fast, supports keyboard-first editing, and exports JSON, PNG, or PDF snapshots.

## Quick start
1. `npm install`
2. `npm run dev` and open the URL Vite prints (defaults to `http://localhost:5173`).
3. Optional sanity check: `npm run build` followed by `npm run preview` to inspect the production bundle.

## JSON format promise
- Every export keeps the same four top-level arrays: `nodes`, `annotations`, `shapes`, and `crossLinks`. Importers ignore extra top-level keys such as `metadata`, `canvas`, or `exportedAt` as long as those arrays exist (empty arrays are valid).
- Nodes always include `id`, `parentId`, `text`, `x`, `y`, `color`, and `textSize` (`small`/`medium`/`large`). Multiple `parentId: null` entries form a forest layout.
- UUID v4 ids are recommended so cross-links and revisions stay stable. Stick to the allowed text sizes; the app normalizes anything else back to `medium`.

Full spacing, orbit, banner, and arrow guidance lives in `AGENTMAPS/AGENTS.MD`. That playbook shows how JSON coordinates translate to the rendered canvas while staying backward compatible.

## Learn by example
- `AGENTMAPS/creative-workshop.json` – orbit stacks, arrows, curved cross-links, and banner captions working together.
- `AGENTMAPS/forest-axis-guide.json` – multiple roots spaced as a forest, a horizon axis with a banner annotation, and bridges between clusters.

Study each JSON file to see how coordinates, colors, and optional metadata map onto the canvas. These two examples cover every supported feature without changing the schema.

## Project scripts
- `npm run dev` – start the hot-reload dev server.
- `npm run lint` – lint and format check (run before every commit).
- `npm run build` – type-check and bundle for production.
- `npm run preview` – serve the bundled output locally.

## For contributors and agents
- Read the repo-level `AGENTS.md` for required checks and collaboration norms.
- Inside `AGENTMAPS/`, follow `AGENTS.MD` plus the two JSON references—those three files are all a new agent needs to create or interpret a map from scratch.
