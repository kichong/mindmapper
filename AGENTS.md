# Mindmapper Agent Guide

## Start here
- Skim `README.md` for the product tour, feature list, and data model overview. It now documents the locked JSON contract so future work stays backward compatible.
- Read `AGENTMAPS/AGENTS.MD` before editing or generating map JSON. It explains how the importer expects nodes, annotations, shapes, and cross-links to be structured, how optional metadata stays compatible, and links to the two reference JSON files.
- Share open questions early. If a requirement is unclear, restate it in your own words and list the follow-up questions so humans can respond quickly.

## Required checks (run before every commit)
1. `npm run lint`
2. `npm run build`

These commands validate syntax, formatting, types, and bundling. Rerun them after each change until they pass.

## Local workflow
1. Install dependencies with `npm install`.
2. Start the dev server (`npm run dev`) to confirm UX flows such as node editing, shape handles, import/export, and zoom controls.
3. Keep explanations, inline comments, and commit messages in plain English so non-developers can follow the changes.
4. Describe what someone should see when they test locally (for example, "Running `npm run dev` shows the updated toolbar labels").

## Collaboration tips
- Document new conventions (UI tweaks, data shapes, helper utilities) directly in the scoped `AGENTS.MD` file so future agents inherit the context.
- Prefer enhancing existing patterns instead of adding parallel solutions. Reuse helpers like `normalizeTextSize`, the shared toolbar text editor, and the `selectedTextTarget` pattern.
- When expanding shape tools, match the golden resize handle interaction already used by rings and ellipses.
- Keep node and text box edits wired through the shared toolbar so double-click-to-edit continues to work.

## Features to keep in mind
- Shape tools now include rings, ellipses, rectangles, arrows, and lines that rely on a single golden resize handle.
- Cross-links connect any two nodes. They live in `state.crossLinks`, export with the map JSON, and render as curved connectors that arc around nearby nodes.
- Nodes and floating text boxes store a `textSize` of `small`, `medium`, or `large`. Always pass values through `normalizeTextSize` when creating or importing records.
- Nodes expose color swatches in the toolbar. Use `DEFAULT_NODE_COLOR`, `NODE_COLOR_OPTIONS`, and dispatch `UPDATE_NODES` so single and multi-select color changes land in one history entry.
- Keyboard shortcuts now include Space (or C) to recentre the view and Shift+Enter to add a detached idea. Keep the shortcut list in `KEYBOARD_SHORTCUTS` (App.tsx) in sync when you add or remove shortcuts so the in-app cheat sheet stays accurate.
- Selection now tracks an ordered array. Shift or Meta/Ctrl-click toggles membership, batch reducers like `MOVE_NODES`, `DELETE_NODES`, and `UPDATE_NODES` keep history tidy, and the first id in the array is the "primary" node when a single target is required.
- Copy/Paste is wired through `handleCopyNodes` / `handlePasteNodes` in `App.tsx`. The `ADD_NODES` reducer clones every selected node into new top-level entries, offsets them slightly, and keeps the whole paste in a single undo step. Buttons live in the bottom-left command panel alongside Ctrl/Cmd+C and Ctrl/Cmd+V shortcuts.
- Circular node labels now wrap into multiple centered lines. Reuse `measureNodeLabel`/`calculateNodeLabelLayout` to keep padding and radius calculations in sync with the wrapped text.
- The top toolbar collapses. Leave creation buttons visible when collapsed and tuck detailed controls into the expanded panel.
- The toolbar hosts one text editor that updates whichever node, annotation, or shape label is selected. Follow the `selectedTextTarget` logic when adding text-based controls.
- Double-clicking any node or floating text box should pop the toolbar open and move focus to the shared text editor so users can type immediately.
- Creating a node (from the toolbar or as a child) should auto-select it, open the toolbar if needed, and focus the shared text editor so typing starts right away.

## Shipping checklist
- Update documentation (including `README.md` or scoped guides) whenever you add capabilities or conventions that other agents must know.
- Summarize changes, test results, and any remaining questions in your final message to the user.
- Leave the repository clean (`git status` should report no pending changes) before wrapping up.
