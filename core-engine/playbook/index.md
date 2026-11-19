# Carousel Playbook

The knowledge layer of `omni-carousel-agent`. An agent reads this, then writes a `CarouselSpec`.

## Read in this order

1. [`instagram.md`](./instagram.md) — slide counts, the second-chance rule, copy limits, CTAs
2. [`linkedin.md`](./linkedin.md) — why native PDFs win, page counts, no-link rule
3. [`patterns.md`](./patterns.md) — the six viral mechanics and when to use each
4. [`hooks.md`](./hooks.md) — six hook formulas, anti-patterns, a pre-publish score
5. [`layouts.md`](./layouts.md) — the eleven typed layouts and their exact fields

## The 60-second version

```
Platform  → instagram: 7-10 slides, 4:5, no links in art
            linkedin:  5-10 PDF pages, sourced numbers, no links in art

Slide 1   → cover_hook, <= 12 words, create a question
Slide 2   → second entry point (Instagram may start here)
Slides 3-6→ mechanism: steps / layer_stack / bento / chart / proof
Slide N-1 → summary (the screenshot frame)
Slide N   → cta (one action only)
```

## Non-negotiables

- No fabricated numbers, quotes, or case studies. A `proof` or `data_chart` slide without a named source does not pass the schema.
- No AI-slop phrasing ("game-changer", "unlock the power", "in today's fast-paced world"). The linter flags ~25 phrases.
- No colour-only meaning, no emoji in art, no URLs inside LinkedIn pages.
- WCAG AA contrast on every text surface; the engine auto-corrects and the linter reports.

## Machine-readable companions

| File | What it is |
|---|---|
| `../carousel.schema.json` | JSON Schema 2020-12 for `CarouselSpec` |
| `../layouts.json` | Layout catalog with roles, density and usage notes |
| `../themes/*.json` | Four contrast-audited themes |
