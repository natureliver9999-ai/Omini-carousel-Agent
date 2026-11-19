# Instagram Carousel Playbook (2026)

Rules an agent must follow when `platform: "instagram"`. Numbers are from the research corpus in `docs/research/01-carousel-engagement-benchmarks-2026.md`.

## 1. Format facts you cannot design around

| Constraint | Value | Consequence for the deck |
|---|---|---|
| Slides per post | 2–20 (20 since Aug 2024) | 7–10 is the completion sweet spot; more than 12 needs an earned reason |
| Canvas | 1080 × 1350 (4:5) | 25% more vertical feed space than 1:1; the engine always renders 4:5 |
| Safe margins | 72 px all sides | Instagram's counter pill, rounded corners and profile chrome eat the edges |
| Caption limit | 2,200 characters | The caption carries the keyword CTA and the links |
| Outbound links | Not clickable | Put links in the caption or first comment, never in the art |

## 2. The second-chance rule (most important)

Instagram may re-serve an un-engaged carousel **starting at slide 2**. Therefore:

- Slide 1 must be a complete hook on its own (≤ 12 words).
- Slide 2 must be a **second entry point**: a stake, a number, a mistake, or the "before" half of a contrast. Never "here's some background".
- The linter enforces first-slide `cover_hook` and last-slide `cta`; the playbook enforces slide 2.

## 3. Structural template (8 slides, default)

1. `cover_hook` — one promise, one tension
2. `contrast_split` / `steps` — the stake, stated immediately
3–6. `steps` / `bento_grid` / `layer_stack` / `data_chart` — the mechanism, one idea per frame
7. `summary` — the screenshot frame
8. `cta` — exactly one action

Alternate layouts. Three identical layouts in a row is a linter error; a panorama span is the only exception, because the continuous canvas is itself the variety.

## 4. Copy limits

| Element | Target | Hard max |
|---|---|---|
| Cover headline | ≤ 12 words | 14 (linter error above) |
| Slide headline | ≤ 10 words | 24 before auto-shrink |
| Body per slide | 25 words | layout budget (40–90) |
| Footer hook | ≤ 7 words | 7 |
| Bento tile text | ≤ 8 words | 8 |
| Summary bullet | ≤ 8 words | 8 |
| Emoji | 0 | the bundled fonts have no emoji glyphs; they are stripped |

## 5. Actions that actually convert

| Goal | Slide N action | Why |
|---|---|---|
| Saves | `save` + a summary slide | Saves are the strongest intent signal and lift non-follower reach |
| Comments | `comment` + a one-word keyword | A keyword is a frictionless comment; the DM is the reward |
| Follows | `follow` + what they get next | Only works when the deck proves competence first |
| Leads | `link_in_caption` | Links in art are dead on Instagram |

## 6. Accessibility

- Write `alt_text` for every slide. The linter flags missing alt text on Instagram.
- Never encode meaning in colour alone: pair `before/after` with an icon and a word.
- Keep body type ≥ 36 px so it survives a 40% zoom in a feed preview.

## 7. What to measure (first 48 hours)

- Saves ÷ reach — target ≥ 2% on educational decks
- Shares ÷ reach — the non-follower expansion signal
- Comments naming the final-slide keyword ÷ impressions — a completion proxy
