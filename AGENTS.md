# AGENTS

## Required checks
- Run `npm run lint` before committing.
- Run `npm run build` before committing.

## Style notes
- Keep explanations and inline comments in clear, plain English so non-developers can follow along.

## Features in progress
- Shape tools now include rings and ellipses that use a golden resize handle. Follow the same interaction pattern when you introduce more shapes.
- Nodes and floating text boxes now store a `textSize` of `small`, `medium`, or `large`. Use the shared `normalizeTextSize` helper when adding new entry points that create or import these records.
- The top toolbar is now collapsible; keep creation buttons available when collapsed and tuck detailed controls inside the expanded panel.
- The toolbar now has a single text editor that updates whichever node or text box is selected. Follow the `selectedTextTarget` pattern when wiring future text-based controls.
- Double-clicking any node or floating text box should pop the toolbar open and move focus to the shared text editor so users can type right away.
