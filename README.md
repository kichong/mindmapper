# Mindmapper

Mindmapper is a React + canvas app for sketching mind maps directly in the browser. The UI focuses on quick idea capture, smooth navigation, and easy ways to export or share your map.

## What you can do today
- **Grow ideas visually.** Drag nodes, add children with the toolbar or keyboard (`Enter`), and remove them with `Delete` / `Backspace`. Connectors redraw automatically as you move items.
- **Connect ideas beyond the tree.** Multi-select any two nodes and tap the curved link button to add a cross-link. The app curves the connector around nearby nodes so lateral relationships stay readable.
- **Format content from one toolbar.** A single text editor and size dropdown updates whichever node, floating annotation, or shape label is selected. Double-clicking a node opens the toolbar and moves focus into the text field so you can keep typing.
- **Drop in callouts and shapes.** Place floating annotations, rings, ellipses, rectangles, arrows, and lines. Each shape has a golden resize handle that controls thickness, size, and angle (for arrows and lines).
- **Control the canvas.** Pan with the arrow keys or on-screen D-pad, zoom between 25% and 250%, auto-center the map, toggle light/dark canvas backgrounds, and lock the canvas to prevent accidental edits.
- **Manage revisions.** Undo/redo stacks let you retrace steps. `Clear` resets the canvas back to the single root node.
- **Import and export data.** Save your work as JSON (editable), PNG (image snapshot), or PDF (vector-friendly). Importing a JSON file replaces the current map. The app also auto-saves to `localStorage` so a browser refresh restores your latest state.

## Quick start
1. **Install dependencies** (Node.js 18+ and npm 9+ recommended):
   ```bash
   npm install
   ```
2. **Run the dev server**:
   ```bash
   npm run dev
   ```
   Vite prints a local URL (defaults to `http://localhost:5173`). Opening it shows the canvas with a purple root node at the center. Drag it around, press `Enter` to spawn children, and try the toolbar buttons to add shapes or undo your changes.
3. **Preview a production build** (optional):
   ```bash
   npm run build
   npm run preview
   ```
   `npm run build` compiles TypeScript and bundles the app. `npm run preview` serves the generated build so you can confirm nothing breaks outside the dev server.

## Scripts
- `npm run dev` – Start the Vite dev server with hot reloading.
- `npm run lint` – Run ESLint (with Prettier rules) across the project. Use this before every commit to catch syntax and formatting issues.
- `npm run build` – Type-check the project and emit a production bundle.
- `npm run preview` – Serve the latest production bundle locally.

## Project layout
- `src/App.tsx` – The main React component. It renders the canvas, toolbar, navigation controls, and import/export workflow. Interaction helpers for nodes, annotations, and shapes live here.
- `src/state/MindMapContext.tsx` – Global state container. It defines the mind map data model, reducer actions (add/move/delete, undo/redo, import/export), and local storage persistence.
- `src/utils/pdf.ts` – Builds a lightweight PDF stream so we can export maps without a heavy dependency.
- `AGENTMAPS/` – Reference JSON maps and guidance for assistants who want to script their own diagrams. Start with `AGENTMAPS/AGENTS.MD` to learn the required data structure and workflow.
- `public/`, `index.html`, and `vite.config.ts` – Standard Vite scaffolding.

## Data model at a glance
The importer expects three arrays in every snapshot:

```ts
{
  nodes: MindMapNode[]
  annotations: MindMapAnnotation[]
  shapes: MindMapShape[]
  crossLinks: MindMapCrossLink[]
}
```

Each node records its unique `id`, the `parentId` (use `null` for the root), display `text`, position (`x`, `y` in canvas pixels, with the origin in the center), a `color`, and a `textSize` (`small`, `medium`, or `large`).

Annotations store `id`, `text`, `x`, `y`, and `textSize` so they can float independently of the node tree.

Shapes cover rings, ellipses, rectangles, arrows, and lines. Every shape includes an `id`, `kind`, center coordinates (`x`, `y`), and size fields specific to the shape (for example `radius` for rings, `width`/`height` for rectangles). Thickness and `color` let you style them. Optional angle fields control rotation where relevant.

Cross-links capture lateral connections between ideas. Each record stores an `id`, the `sourceId` and `targetId` (node ids), and the canvas automatically curves the link between the two when rendering.

Review `AGENTMAPS/mindmapper-guide.json` for a working example that matches what the importer expects.

## Tips for contributors and AI agents
- Read `AGENTS.md` (repo root) for required checks and collaboration norms. It links to deeper guides, including the AGENTMAPS playbook.
- Use the toolbar’s lock toggle before presenting a map to avoid accidental edits.
- When you add new shapes or text entry points, reuse helpers like `normalizeTextSize` so imports and UI interactions stay in sync.
- Document any new conventions or UX tweaks in `AGENTS.md` or the relevant folder’s guide so future collaborators stay aligned.

## Testing and QA expectations
- Run `npm run lint` and `npm run build` before opening a pull request. They catch syntax issues, type errors, and bundling regressions.
- Manual QA: launch `npm run dev`, import/export a JSON map from `AGENTMAPS/`, and confirm the canvas responds to panning, zooming, and undo/redo.

## Need a ready-made map?
The `AGENTMAPS` folder contains shareable JSON files and a playbook tailored to AI assistants. Import `AGENTMAPS/mindmapper-guide.json` through the toolbar to see a complete, spaced-out map. Use that structure as the starting point when authoring new diagrams.
