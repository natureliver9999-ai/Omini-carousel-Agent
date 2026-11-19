# Layout Reference

Twelve typed layouts. Each has a fixed job, a copy budget enforced by the linter, and a deterministic geometry.

| Layout | Job | Density | Copy budget | Required fields |
|---|---|---|---|---|
| `cover_hook` | Slide 1 scroll-stopper | sparse | 40 words | `headline` |
| `contrast_split` | Flip one variable | medium | 72 words | `headline`, `left`, `right` |
| `layer_stack` | Progressive system build | medium | 70 words | `headline`, `layers[2-5]` |
| `bento_grid` | Framework / multi-metric matrix | dense | 70 words | `headline`, `tiles[4-9]` |
| `reveal_hold` | Open-loop cliffhanger | sparse | 60 words | `headline`, `body`, `teaser_label` |
| `scrapbook` | Human, opinionated note | medium | 90 words | `headline`, `note` |
| `data_chart` | Quantitative evidence | medium | 45 words | `headline`, `chart`, `source` |
| `steps` | Sequential playbook | medium | 80 words | `headline`, `steps[2-5]` |
| `proof` | Cited case study | sparse | 70 words | `headline`, `metric_value`, `metric_label`, `finding`, `source` |
| `summary` | Saveable recap | medium | 70 words | `headline`, `bullets[3-6]` |
| `cta` | Slide N, one action | sparse | 45 words | `headline`, `action`, `text` |
| `generative` | Seeded vector plot as visual proof | sparse | 60 words | `headline` |

## Generative art

`generative` (and the optional `art` block on any slide) plots a deterministic
vector composition from a seed. Eight styles ship in the engine:

| Style | Reads as | Best for |
|---|---|---|
| `topography` | Contour rings | terrain, depth, "we mapped this" |
| `orbital` | Compass arcs + satellites | cycles, systems, cadence |
| `halftone` | Dot-density field | print texture with no photo |
| `isometric` | Wireframe volumes | architecture, infrastructure |
| `flowfield` | Streamlines through a vector field | momentum, traffic, funnels |
| `constellation` | Nearest-neighbour graph | networks, evidence density |
| `moire` | Rotated line interference | tension, contrast, before/after |
| `ribbon` | Stacked waves | sequence, rhythm, layering |

```json
{ "layout": "generative", "headline": "Terrain is just data with a horizon",
  "sub": "Contour rings computed from a hash of the slide id.",
  "figure_label": "FIG. 03 — DRIFT",
  "art": { "style": "topography", "density": 0.6 },
  "annotations": ["seed derives from spec id + slide id", "zero network requests"] }
```

The seed defaults to `<spec.id>-<slide.id>`, so the same spec always draws the
same deck. Pin `art.seed` at deck level to lock a whole deck's look, or
`art.backdrop: true` to run a faint field behind every other layout.

## Field cheat sheet

### `cover_hook`
```json
{ "layout": "cover_hook", "eyebrow": "RETENTION 2026", "kicker": "The format nobody schedules:",
  "headline": "Your best post is the one they swipe twice", "sub": "Nine frames, one continuous idea.",
  "badge": "2026 DATA", "icon": "repeat" }
```

### `contrast_split`
```json
{ "layout": "contrast_split", "mode": "before", "pair": "myth-1", "headline": "\"Carousels are dead.\"",
  "left": { "label": "THE CLAIM", "text": "…", "items": ["…", "…"] },
  "right": { "label": "THE DATA", "text": "…", "items": ["…"] },
  "verdict": "Video owns discovery. Carousels own intent.", "icon": "x" }
```

### `layer_stack`
```json
{ "layout": "layer_stack", "headline": "Layer three: the contract",
  "layers": [{ "label": "Intent", "detail": "…" }, { "label": "Playbook" }, { "label": "Spec" }],
  "active_layers": 3, "total_layers": 3 }
```

### `bento_grid`
```json
{ "layout": "bento_grid", "headline": "Four things a carousel buys you",
  "tiles": [{ "label": "Saves", "value": "2-3x", "text": "Higher than a single image", "accent": true, "icon": "bookmark" },
            { "label": "Dwell", "value": "25s+", "text": "Reader time on post" }] }
```
`span: 2` widens a tile to half the grid; omit it for the automatic 6-column pack.

### `reveal_hold`
```json
{ "layout": "reveal_hold", "headline": "Frame two introduces. It should raise a stake.",
  "body": "…", "teaser_label": "The fix is one rule", "bleed_ratio": 0.13 }
```

### `scrapbook`
```json
{ "layout": "scrapbook", "headline": "Templates fail identically.", "note": "…",
  "callout": "Nothing was wrong. Everything was the same.", "sticker": "honestly", "underline_word": "identically" }
```

### `data_chart`
```json
{ "layout": "data_chart", "headline": "Carousels still lead engagement",
  "chart": { "kind": "bar", "labels": ["Carousels", "Reels", "Images"], "values": [0.5, 0.48, 0.35], "unit": "%", "highlight": 0 },
  "takeaway": "Engagement per follower.", "source": "Socialinsider, Q3 2026 — 67.5M posts" }
```
`kind`: `bar` · `horizontal_bar` · `line` · `donut`. Values must match labels in length.

### `steps`
```json
{ "layout": "steps", "headline": "Four calls, start to finish",
  "steps": [{ "title": "get_playbook", "detail": "Rules land in context." }],
  "emphasis": "numbered" }
```

### `proof`
```json
{ "layout": "proof", "headline": "Format beats volume", "metric_value": "7.00%",
  "metric_label": "Engagement by impressions", "finding": "…",
  "source": "Socialinsider, March 2026 — 2.45M posts", "attribution": "Socialinsider" }
```

### `summary`
```json
{ "layout": "summary", "headline": "The retention checklist",
  "bullets": ["Hook in twelve words", "Frame two stands alone"], "save_prompt": "Save it" }
```

### `cta`
```json
{ "layout": "cta", "action": "comment", "keyword": "RETENTION",
  "headline": "Want the exact spec?", "text": "Comment RETENTION and we will send it.", "handle": "omnicarousel" }
```
`action`: `save` · `comment` · `follow` · `link_in_caption` · `share`.

## Shared fields (every layout)

| Field | Purpose |
|---|---|
| `id` | Stable slug; seeds deterministic scrapbook jitter |
| `eyebrow` | Small kicker in the header strip |
| `footer_hook` | ≤ 7-word teaser in the footer |
| `bg` | `primary` · `secondary` · `surface` · `elevated` · `accent` |
| `accent` | Force the accent surface for emphasis |
| `alt_text` | Accessibility description |
| `notes` | Private production notes, never rendered |
| `panorama` | `{ "span": 2-6 }` to join a seamless span |

## Icons

`icon` accepts any name from `omni-carousel layouts --json` (engine-drawn glyphs): `sparkles, trending-up, trending-down, arrow-right, arrow-up-right, arrow-down, check, x, alert-triangle, target, zap, clock, users, dollar-sign, bar-chart, layers, lightbulb, bookmark, message-circle, share, heart, search, compass, shield-check, rocket, brain, bot, database, file-text, image, play, lock, flame, thumbs-up, grid, repeat, eye, book, cpu, git-branch, pen, magnet`.
