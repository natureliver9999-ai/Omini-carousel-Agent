# LinkedIn Document Playbook (2026)

Rules for `platform: "linkedin"`. On LinkedIn a "carousel" is a **native document post**: one multi-page PDF uploaded to the feed.

## 1. Why the PDF wins

| Metric | Value | Source |
|---|---|---|
| Engagement by impressions, documents | 7.00% (#1 format, +14% YoY) | Socialinsider, March 2026 — 2.45M posts |
| Median engagement by reach, documents | 21.77% | Buffer, March 2026 — 52M+ posts |
| Platform average, all formats | 5.20% | Socialinsider, March 2026 |

The mechanism is **dwell time**: five to ten structured pages hold a reader on the post for 25–60 seconds, and LinkedIn's ranker rewards time-on-post. Reach is not the lever; depth is.

## 2. Hard rules

| Rule | Value | Notes |
|---|---|---|
| Pages | 5–10 (max 300 pages, 100 MB) | 8 pages is the reliable default |
| Page size | 1080 × 1350 pt (4:5) | Rendered by the engine as exact 1080×1350 PNG pages |
| Links inside the PDF | **None** | Untappable on mobile and they leak traffic out of the feed |
| Emoji | None | The bundled fonts have no glyphs; they are stripped |
| Sources | Every quantitative slide | A bare number without a named source is a credibility failure |
| Colour-only meaning | Forbidden | Pair every state with an icon and a word |

## 3. Structure for an executive audience

1. `cover_hook` — the claim, not the topic ("AI adoption: what the data actually shows")
2. `proof` — the headline number, with the dataset named on the page
3. `data_chart` — the comparison that makes the number legible
4. `proof` — the second, independent measurement
5. `bento_grid` — the framework ("three moves that survive scrutiny")
6. `steps` — the plan ("a four-week pilot you can defend")
7. `summary` — what to take into the room
8. `cta` — `comment` with a keyword, or `link_in_caption`

## 4. Copy rules

- Headlines read like findings, not labels. "The gap is dwell time, not reach" beats "Key insights".
- Sentences ≤ 22 words. Executives skim on a phone between meetings.
- No more than two numbers per slide.
- Every `finding` names what the number *means*, then stops.

## 5. Caption

- 1,200–1,800 characters performs well on LinkedIn; first two lines are the entire hook.
- 3–5 hashtags, at the end. More reads as spam.
- End with a question that a specific person can answer, not "thoughts?".

## 6. Export

`omni-carousel render spec.json --formats png,pdf` produces:

- `slides/slide-01.png …` — 1080×1350, for a "swipe" preview or an alternate upload path
- `<id>.pdf` — multi-page, full-bleed, no link annotations, created with a fixed timestamp so builds are reproducible
