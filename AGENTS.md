# Mindmapper Agent Guide

## Start here
- Skim `README.md` for the product tour, feature list, and data model overview.
- Read `AGENTMAPS/AGENTS.MD` before editing or generating map JSON. It explains how the importer expects nodes, annotations, and shapes to be structured and includes a working sample.
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
- Nodes and floating text boxes store a `textSize` of `small`, `medium`, or `large`. Always pass values through `normalizeTextSize` when creating or importing records.
- The top toolbar collapses. Leave creation buttons visible when collapsed and tuck detailed controls into the expanded panel.
- The toolbar hosts one text editor that updates whichever node, annotation, or shape label is selected. Follow the `selectedTextTarget` logic when adding text-based controls.
- Double-clicking any node or floating text box should pop the toolbar open and move focus to the shared text editor so users can type immediately.

## Shipping checklist
- Update documentation (including `README.md` or scoped guides) whenever you add capabilities or conventions that other agents must know.
- Summarize changes, test results, and any remaining questions in your final message to the user.
- Leave the repository clean (`git status` should report no pending changes) before wrapping up.
