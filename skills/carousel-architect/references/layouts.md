# Layout map

Eleven typed layouts, each with one job. `list_layouts` returns the machine-readable catalog.

| Layout | Job | Required fields | Copy budget |
|---|---|---|---|
| `cover_hook` | Slide 1 scroll-stopper | `headline` | 40 words |
| `contrast_split` | Flip one variable | `headline`, `left`, `right` | 72 |
| `layer_stack` | Progressive build, +1 layer per swipe | `headline`, `layers[2-5]` | 70 |
| `bento_grid` | Framework / metric matrix | `headline`, `tiles[4-9]` | 70 |
| `reveal_hold` | Cliffhanger with a bleeding card | `headline`, `body`, `teaser_label` | 60 |
| `scrapbook` | Human, tactile, opinionated | `headline`, `note` | 90 |
| `data_chart` | Quantitative evidence | `headline`, `chart`, `source` | 45 |
| `steps` | Sequential how-to | `headline`, `steps[2-5]` | 80 |
| `proof` | Cited case metric | `headline`, `metric_value`, `metric_label`, `finding`, `source` | 70 |
| `summary` | The screenshot frame | `headline`, `bullets[3-6]` | 70 |
| `cta` | One action | `headline`, `action`, `text` | 45 |

## Minimal valid slide objects

```json
{ "layout": "cover_hook", "headline": "Your best post is the one they swipe twice", "sub": "Nine frames, one idea.", "icon": "repeat" }

{ "layout": "steps", "headline": "Four moves", "steps": [{ "title": "Stop the thumb", "detail": "Twelve words, no setup." }] }

{ "layout": "bento_grid", "headline": "What you get", "tiles": [{ "label": "Saves", "value": "2-3x", "text": "Vs single image", "accent": true }, { "label": "Dwell", "value": "25s+" }] }

{ "layout": "data_chart", "headline": "Carousels lead", "chart": { "kind": "bar", "labels": ["Carousels","Reels"], "values": [0.5,0.48], "unit": "%", "highlight": 0 }, "source": "Socialinsider, Q3 2026" }

{ "layout": "contrast_split", "mode": "before", "pair": "myth-1", "headline": "\"Carousels are dead.\"", "left": { "label": "CLAIM", "items": ["2023 advice"] }, "right": { "label": "DATA", "items": ["0.50% vs 0.48%"] } }

{ "layout": "layer_stack", "headline": "Layer two", "layers": [{ "label": "Intent" }, { "label": "Spec" }], "active_layers": 2, "total_layers": 2 }

{ "layout": "reveal_hold", "headline": "Frame two introduces", "body": "It should raise a stake instead.", "teaser_label": "The fix" }

{ "layout": "proof", "headline": "Documents lead LinkedIn", "metric_value": "7.00%", "metric_label": "Engagement by impressions", "finding": "Ahead of every other organic format.", "source": "Socialinsider, March 2026 — 2.45M posts" }

{ "layout": "summary", "headline": "The checklist", "bullets": ["Hook in twelve words", "Frame two stands alone"], "save_prompt": "Save it" }

{ "layout": "cta", "action": "comment", "keyword": "RETENTION", "headline": "Want the spec?", "text": "Comment RETENTION and we will send it.", "handle": "yourhandle" }
```

## Shared fields

`id` · `eyebrow` · `footer_hook` (≤7 words) · `bg` (primary/secondary/surface/elevated/accent) · `accent` (boolean) · `alt_text` · `notes` · `panorama: { span: 2-6 }` (first slide of the span only).

## Panorama

```json
{ "layout": "steps", "panorama": { "span": 3 }, "headline": "One continuous path" }
```
Only the first slide declares the span. Keep text inside the 72px margin — the engine slices the wide canvas into exact 1080px tiles, so text near a seam would be cut.

## Common lint errors and the fix

| Error | Fix |
|---|---|
| `FIRST_SLIDE_NOT_COVER` | Slide 1 must be `cover_hook` |
| `LAST_SLIDE_NOT_CTA` | Add a `cta` as the final slide |
| `LAYOUT_REPEAT` | Alternate layouts; only a panorama span may repeat 3+ |
| `SLIDE_COPY_BUDGET` | Move overflow into the caption |
| `SLIDE_COPY_BUDGET` / `HOOK_TOO_LONG` | Cut the cover to ≤ 12 words |
| `REVEAL_UNRESOLVED` | Move the `reveal_hold` earlier and resolve it next slide |
| `PANORAMA_CONFLICT` | Spans must be contiguous; declare `span` on the first slide |
| `BRAND_ACCENT_CONTRAST` | Pick a darker/lighter accent override |
