# AGENTS

## Required checks
- Run `npm run lint` before committing.
- Run `npm run build` before committing.

## Style notes
- Keep explanations and inline comments in clear, plain English so non-developers can follow along.

## Features in progress
- Shape tools now include rings and ellipses that use a golden resize handle. Follow the same interaction pattern when you introduce more shapes.
- Nodes and floating text boxes now store a `textSize` of `small`, `medium`, or `large`. Use the shared `normalizeTextSize` helper when adding new entry points that create or import these records.
