# AGENTMAPS Guide for AI Assistants

## Purpose
- Capture mindmaps that teach or document workflows for this project.
- Keep instructions friendly to non-coders and future agents.

## Quick workflow
1. Read `/AGENTS.md` at the repo root for global expectations (lint + build before commit).
2. Skim existing maps in this folder so new work stays consistent.
3. Agree with the user on the topic and the level of detail.
4. Outline the map: pick one root idea, group related thoughts as branches.
5. Translate the outline into JSON using the schema below.
6. Validate your JSON:
   - Run a JSON formatter or `npm run lint` to catch syntax slips.
   - Import it in the Mindmapper app (drop the file into the import dialog) and confirm nodes land where you expect.
7. Summarize what changed in your final message and log any follow-up ideas here if needed.

## JSON schema reminder
Each mindmap file must follow the structure the app reducer expects:

```json
{
  "nodes": [
    {
      "id": "string",            // unique per node
      "parentId": "string|null", // null for root, otherwise parent node id
      "text": "string",           // short label shown in the map
      "x": 0,                      // horizontal canvas position in pixels
      "y": 0,                      // vertical canvas position in pixels
      "color": "#hex",            // optional; defaults to theme if missing
      "textSize": "small|medium|large" // optional; defaults to medium
    }
  ],
  "annotations": [],
  "shapes": []
}
```

Tips:
- Keep coordinates spaced (≈200–300px apart) so branches do not overlap.
- Colors are optional; pick readable contrasts if you add them.
- Use `textSize` to emphasize root or summary nodes; keep deeper branches small.

## Testing checklist
- `npm run lint`
- `npm run build`

## When updating this folder
- Describe any new conventions or gotchas in this file so the next agent is ready.
- If you add helper scripts or assets, explain how to use them.
