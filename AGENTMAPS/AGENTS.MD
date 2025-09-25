# AGENTMAPS Playbook for AI Assistants

## What you must read inside this folder
Agents only need three artifacts from `AGENTMAPS/` to build and read mind maps:

1. **This `AGENTS.MD` file** – the contract, workflow, and quick reference.
2. **Example JSON** – `creative-workshop.json` (orbit + vector playground).
3. **Example JSON** – `forest-axis-guide.json` (forest layout with banner line).

Study the JSON side by side so you can trace how coordinates, colors, and optional extras (cross-links, shapes, annotations) become visuals. Every instruction below keeps the schema backward compatible for older maps while showing how to use the latest features.

```
        200 px sibling gap
┌──────────────┐      ┌──────────────┐
│ Parent idea  │──────│ Sibling idea │
└──────────────┘      └──────────────┘
        ▲
        │ 150 px vertical step keeps tiers tidy
        ▼
┌──────────────┐
│ Child idea   │
└──────────────┘
```

Use the spacing diagram above as your scale reference: a 200 px horizontal offset leaves roughly one medium node’s width plus breathing room, and a 140–200 px vertical step keeps connectors from tangling.

## Locked JSON contract (do not change the schema)
Mindmapper relies on a stable data shape. Keep these top-level arrays in every file and feel free to add optional metadata at the top level. Importers ignore unknown keys so long as the four arrays stay intact.

```json
{
  "metadata": {
    "source": "sketch import"
  },
  "exportedAt": "2024-06-18T02:15:00Z",
  "nodes": [],
  "annotations": [],
  "shapes": [],
  "crossLinks": []
}
```

- Always include each array even when you have no entries (`[]`). This keeps older importers happy and future JSON generators predictable.
- Never rename keys or remove required fields. Add-ons should live inside the existing objects so old files keep loading.
- Extra top-level data such as timestamps, author info, or canvas size can live under keys like `metadata`, `exportedAt`, or `canvas`. Keep them optional so every exporter stays compatible.

### ID hygiene
- Prefer UUID v4 strings (`"1e5b4f8e-..."`) for `id`, `parentId`, and cross-link references to avoid collisions.
- Keep ids stable between edits so diffs stay readable and cross-links survive revisions. Store human-friendly labels in the `text` field instead of the id itself.

### Required node fields
- `id`: unique string identifier.
- `parentId`: `null` for every root. Multiple roots are allowed—treat them as a forest layout.
- `text`: label inside the node.
- `x`, `y`: canvas coordinates in pixels. `(0, 0)` is the center of the canvas; positive `x` moves right, positive `y` moves down.
- `color`: hex value. Omit only if you want the default purple.
- `textSize`: `small`, `medium`, or `large`. Anything else normalizes back to `medium`.

Spacing between root clusters: leave 300–600 px between root nodes so long edges do not overlap. When orbits are present, keep the outer ellipse of one root at least 120 px away from the inner ellipse of its neighbor unless you want the sets to intersect.

### Optional layers
- **Annotations** float outside the tree. Use them for banners, slogans, or floating captions that should not carry children. They store `id`, `text`, `x`, `y`, `textSize`. Leave at least 100 px between the annotation anchor point and the nearest node so labels stay readable. Orbit labels work well when you set them at the ellipse tangent: `label.x = center.x + radiusX + 60`, `label.y = center.y + 20` (tweak for your layout).
- **Shapes** support `ring`, `ellipse`, `rectangle`, `arrow`, and `line`. Supply `id`, `kind`, `x`, `y`, and the size properties for that shape (`radius`, `radiusX`, `radiusY`, `width`, `height`, `length`, `thickness`, `angle`, `color`). Size a shape so its bounds extend 20–40 px beyond the cluster it frames. When you draw concentric orbits, add 160–220 px to both radii for each outer ring so the spacing matches the examples.
- **Cross-links** bridge any two nodes with `{ id, sourceId, targetId }`. Today the renderer styles them uniformly (purple, medium weight). Future styling hints can live inside a `metadata` object (for example `{ "metadata": { "color": "#5a6", "thickness": 3 } }`). The current importer strips unknown keys, so those hints do not break compatibility.

### Parent or cross-link?
- Use parent/child when an idea belongs under another or extends a branch.
- Use cross-links for lateral relationships across clusters. Keep them intentional and sparse so the canvas stays readable.

### Axis vs. vector patterns
**Banner / axis recipe** – combine a `line` shape with an annotation that names the strip:

```json
{
  "id": "2d1f6c59-9c9f-4f5d-bf44-4c96fc8fc9bb",
  "kind": "line",
  "x": 0,
  "y": 120,
  "length": 1320,
  "angle": 0.01,
  "thickness": 2,
  "color": "#38bdf8"
}
```

- Choose a length slightly wider than the canvas (about 110% of your intended width) and keep the angle near zero (`±0.003–0.02`) so rendering stays crisp without snapping to a perfect horizontal. Place an annotation roughly 120 px above or below the line for the caption or banner text.

**Vector / arrow recipe** – use `arrow` when you need direction or flow:

```json
{
  "id": "b087ae54-4f3a-4d25-9d8f-15f5a9aeb3a2",
  "kind": "arrow",
  "x": -60,
  "y": 360,
  "width": 440,
  "height": 200,
  "thickness": 48,
  "angle": -0.4,
  "color": "#f97316"
}
```

- Importers accept `width`/`height` or `length` fields for arrows. Exporters should preserve whichever pair they receive. Match the example JSON by pairing the arrow with the related nodes instead of banner text.

### Shape selection cheat sheet
| Shape | When to use it | Key size fields |
| --- | --- | --- |
| `ellipse` | Non-circular orbit or halo | `radiusX`, `radiusY`, `thickness`, `angle` |
| `ring` | Perfect circle sweep | `radius`, `thickness` |

Prefer `ellipse` when you need different horizontal and vertical radii. `creative-workshop` uses an ellipse for the purple orbit and a ring for the cyan sweep.

### Color, emphasis, and precision
- Sample or define exact hex values so colors stay consistent and groups remain clear. Keep orbit colors consistent inside each set.
- Node `textSize` carries hierarchy: larger sizes draw attention (`ETH` in the workshop map). Stick to `small`, `medium`, or `large`; the importer routes through `normalizeTextSize` so stray values collapse to `medium`.
- Coordinates, lengths, radii, and angles accept floating-point numbers. Use small offsets (`0.003`–`0.02`) to suggest “almost horizontal” or “almost vertical” lines without fighting pixel snapping.

Keep coordinates and styling readable. The spacing defaults of 200–320 px between siblings and 140–200 px vertical steps prevent overlaps. Treat those distances as defaults; organic or network-style compositions can flex to match your concept.

### Orbit placement recipe
For concentric orbit layouts (`creative-workshop`):

1. Center the orbit shapes on the cluster core (`cx`, `cy`).
2. Start with an inner ellipse (thickness 12–16) then add 160–220 px to `radiusX` and `radiusY` for each outer ring.
3. Drop labels as annotations using the tangent formula above.
4. To place a node along an orbit at angle `θ`, compute `node.x = cx + radiusX * cos(θ)` and `node.y = cy + radiusY * sin(θ)`, then nudge ±20–40 px for legible labels.

## Creative workflow to follow
1. **Outline ideas first.** Start with plain text or a hand sketch so you know the hierarchy before touching JSON.
2. **Draft the nodes.** Work from each root outward. Update `parentId` as you branch so relationships stay intact and leave 300–600 px between separate root clusters.
3. **Position with intent.** Map your outline into coordinates. Use the spacing diagram to judge distance, and relax the defaults when chasing organic compositions.
4. **Layer on visuals.** Use annotations for callouts, shapes for emphasis (rings, rectangles, axes), and cross-links for lateral thinking. The two example JSON files show every shape kind plus curved links.
5. **Validate syntax.** Keep the file formatted and valid JSON. The repo lint command (`npm run lint`) will catch trailing commas or typos.
6. **Spot-check imports.** When possible, import into the app to confirm spacing, curves, and styling align with your intent.
7. **Record lessons.** Note quirks or styling decisions in your handoff so the next agent can build from them.

## Validation checklist before committing
- `npm run lint`
- `npm run build`

## Sharing updates
- Summarize new or updated maps (plus open questions) in your final message.
- If you discover a repeatable trick—like reliable spacing for cross-links or palette combos—document it here so the knowledge compounds.
