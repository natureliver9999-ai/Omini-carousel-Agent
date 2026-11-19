# Platform specifications (2026)

## Instagram

| Parameter | Value |
|---|---|
| Canvas | 1080 × 1350 px (4:5) |
| Slides | 2–20 (20 since Aug 2024) · sweet spot **7–10** |
| Safe margins | 72 px left/right/top · bottom 110 px reserved for chrome |
| Caption | 2,200 characters |
| Hashtags | 3–8 (hard ceiling ~15 before it reads as spam) |
| Links | Not clickable in-feed → caption or first comment |
| Emoji in art | Not supported by the bundled fonts; stripped at render |
| Accessibility | Write `alt_text` on every slide |

**Second-chance rule:** Instagram may re-serve the post starting at slide 2 → slide 2 must work standalone.

**Benchmarks (2025 – Q3 2026):** carousels 0.50–0.55% engagement by followers (#1 format), Reels 0.48–0.52%, images 0.35–0.37%. Reach rate 4.50% (carousels) vs 4.10% (Reels) vs 4.00% (images); Reels still win *discovery* reach on accounts under 50K. Source: Socialinsider, 67.5M posts.

## LinkedIn

| Parameter | Value |
|---|---|
| Format | Native **document post** (one multi-page PDF) |
| Page size | 1080 × 1350 pt (4:5) |
| Pages | 5–10 recommended · platform max 300 pages / 100 MB |
| Links inside PDF | **None** — untappable, leaks the reader out |
| Caption | 3,000 characters; first two lines are the hook |
| Hashtags | 3–5, at the end |
| Sources | Required on any quantitative page |

**Benchmarks (March 2026):** documents 7.00% engagement by impressions (#1, +14% YoY) vs multi-image 6.45%, video ~5.1%, text 4.5%, platform average 5.20%. Reach-weighted: 21.77% median vs video 7.35% (Buffer, 52M+ posts). Mechanism: dwell time.

## Both

- Body type ≥ 36 px so it survives feed zoom (~40%).
- Contrast: ≥ 4.5:1 for body, ≥ 3:1 for display type (WCAG AA). The engine auto-corrects and reports.
- Never encode meaning in colour alone: pair with an icon and a word.
- One action per deck.

## Timing and cadence

Brands publish ~5 carousels/month vs ~8 Reels/month, so the highest-engaging format is under-supplied. Suggested mix: 60% short video (cold reach), 30% carousels (depth + saves), 10% single frames.

## Measurement (first 48h)

| Metric | Target | Meaning |
|---|---|---|
| Saves ÷ reach | ≥ 2% (educational) | Highest-intent signal |
| Shares ÷ reach | rising week over week | Non-follower expansion |
| Keyword comments ÷ impressions | any measurable lift | Completion proxy |
