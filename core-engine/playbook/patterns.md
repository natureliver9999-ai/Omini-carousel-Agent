# The Six Viral Patterns

Each pattern is a *visual mechanic*, not a topic. The engine implements every one with typed layouts, so an agent chooses the mechanic and fills the copy.

## 1. Seamless panorama (`panorama` + any layout)

One wide canvas (`1080 × span`) sliced into exact 1080px tiles. A continuous ribbon, horizon or system diagram crosses every seam.

- **Span:** 3–5 slides. Seven-plus dilutes the novelty.
- **Seam rule:** any motif that bridges a seam keeps ≥ 25% of its width on each side. The engine centres cross-seam nodes so the split is 50/50.
- **Text rule:** all text stays inside the 72px margin, so nothing is ever cut by a seam.
- **Declare once:** only the first slide of a span sets `panorama: { "span": 3 }`; the rest are inferred.

```json
{ "layout": "steps", "panorama": { "span": 3 }, "headline": "Six moves that earn the second swipe", "steps": [ … ] }
```

## 2. Contrast / before-after (`contrast_split`)

One variable flips. Either two panels in one frame (`mode: "split"`) or two consecutive slides (`mode: "before"` then `"after"` sharing a `pair` id).

- Hold geometry constant; change only the variable.
- Never rely on colour alone: `✕`/`✓` and a word carry the meaning.
- The pair is exempt from the layout-repetition rule because the swipe *is* the comparison.

## 3. Layer-by-layer transformation (`layer_stack`)

The same five-row stack, two to four slides, one more layer lit each swipe. Inactive layers stay as dashed ghosts so the reader sees how much remains.

- Geometry must be pixel-identical between consecutive slides.
- `active_layers` must increase by exactly one, or omit it and let the engine infer the sequence position.

## 4. Hold-and-scroll reveal (`reveal_hold`)

Slide N raises tension and bleeds a teaser card 8–15% past the right edge of the canvas; slide N+1 resolves it.

- Never the final slide (linter error: unresolved cliffhanger).
- Only the teaser bleeds; the headline and body stay inside the margin.

## 5. Bento grid (`bento_grid`)

4–9 self-contained tiles on a deterministic 6-column grid. Best used mid-deck as a framework, or as the save-worthy cheat sheet.

- ≤ 8 words per tile.
- One accent tile maximum per grid: it is the tile the eye lands on first.
- The engine packs tiles into complete rows, so there are never orphan cells.

## 6. Anti-aesthetic scrapbook (`scrapbook`)

Paper grain, masking tape, marker underline, ±2.5° rotation. The counter-signal to template fatigue.

- Rotation is derived from a hash of the slide id, never `Math.random()`, so goldens stay byte-identical.
- One scrapbook slide per deck is usually enough; it works because it is rare.

---

## Choosing a pattern

| If the idea is… | Use |
|---|---|
| A system or process with stages | panorama + `steps`, or `layer_stack` |
| A myth to overturn | `contrast_split` pair |
| A number that changes a decision | `data_chart` + `proof` |
| An opinion that needs a human voice | `scrapbook` |
| A framework with 4–9 parts | `bento_grid` |
| A cliffhanger mid-deck | `reveal_hold` |

## Pattern mixing rules

1. Never repeat the same pattern three times in a row (except a panorama span or an explicit pair).
2. Put the densest frame at slide 5–7, never at slide 2.
3. Close every pattern you open: a reveal is resolved, a panorama ends, a contrast pair lands a verdict.
