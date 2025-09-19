# AGENTMAPS Playbook for AI Assistants

## Before you start
- Read `/AGENTS.md` in the repo root so you know the required checks (`npm run lint` and `npm run build`).
- Skim the existing maps in this folder to match tone, spacing, and color choices.
- Clarify the map goal with the user. If any detail is fuzzy, list the questions up front so humans can respond.

## How the Mindmapper importer reads JSON
Each file you create replaces the current canvas. The reducer expects three top-level arrays: `nodes`, `annotations`, and `shapes`. Keep `annotations` and `shapes` present (use `[]` when you do not need them) so the importer never crashes on missing keys.

Every node in the `nodes` array must include these fields:
- `id`: unique string. Reuse an id and the later node overwrites the earlier one.
- `parentId`: `null` for the root node; otherwise match the parent node's id.
- `text`: short label shown inside the node.
- `x` and `y`: numbers measured in canvas pixels. The origin `(0, 0)` is the center of the screen.

Optional styling that the current app honors:
- `color`: hex string. If you leave it out, the UI applies the default purple.
- `textSize`: `small`, `medium`, or `large`. The UI normalizes anything else back to `medium`.

## Build a mindmap step by step
1. **Outline on paper** (or in plain text). Choose one root idea and cluster the supporting ideas into branches.
2. **Translate to JSON.** Create one object per node. Work from the root outward so you always know each `parentId`.
3. **Place nodes.** Keep siblings about 200–320 pixels apart (`x` spacing) and step 140–200 pixels down the `y` axis for deeper levels. This mirrors the working sample file below.
4. **Add styling as needed.** Use bright, readable colors. Reserve `large` text for the root, `medium` for first-level branches, `small` for leaves.
5. **Check your syntax.** Run a JSON formatter or rely on `npm run lint` (it runs Prettier under the hood) to ensure valid JSON.
6. **Import locally.** Drag the file into the Mindmapper import dialog. Confirm that:
   - The root node lands at the center (0,0).
   - Branches fan out without overlapping.
   - Colors and text sizes match your intent.
7. **Document any uncertainties.** If the import reveals odd spacing or behavior, capture it in your final summary so the next agent can adjust quickly.

## Validation checklist before committing
- `npm run lint`
- `npm run build`

## Sharing updates
- Summarize the new map (and any open questions) in your final response to the user.
- If you introduce new conventions or optional helpers, document them here so future agents stay aligned.

## Reference: Minimal working map
You can import `mindmapper-guide.json` in this folder for a quick visual example. It demonstrates the coordinate spacing, colors, and text sizes discussed above.
