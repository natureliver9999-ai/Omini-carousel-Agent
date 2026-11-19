# Research Report 02: Viral Carousel Patterns, Cognitive Psychology & Visual Design Rules

**Last Updated:** 19 November 2026  
**Scope:** Psychological swipe mechanics, the 6 viral carousel architectures, the 11 deterministic layout specifications, WCAG 2.1 contrast mathematics, and typographic pacing.

---

## 1. Cognitive Mechanics of the Swipe

Why does a user swipe from Slide 1 all the way to Slide 10 instead of scrolling vertically to the next post? Three cognitive mechanisms govern horizontal carousel retention:

1. **The Zeigarnik Open-Loop Effect:** Incomplete visual or semantic patterns occupy working memory until resolved.
   - *Visual open loop:* Cropping an element 8–15% off the right edge (`x = 1080`) or running a continuous bezier path across slide boundaries physically signals that the frame is incomplete.
   - *Verbal open loop:* Ending Slide `N` with a <=7-word footer micro-hook (*"Slide 4: the metric nobody checks ->"*) creates an immediate low-cost curiosity gap resolved one thumb-flick away.
2. **Cognitive Load Partitioning (One-Idea-Per-Slide):** Mobile readers scan rather than read linear paragraphs. Capping body slides at **25 target / 40 max words** with **>=40 px body copy** reduces per-slide parsing time to **2.5–4 seconds**, creating a rhythmic "micro-reward" loop per swipe.
3. **Visual Rhythm & Habituation Prevention:** When three consecutive slides share identical visual density and layout structure, peripheral vision classifies the deck as repetitive ("banner blindness") and triggers vertical scroll exit. Enforcing **layout alternation** and **sparse/dense oscillation** resets visual attention on every swipe.

---

## 2. Deep Specification of the 6 Viral Carousel Patterns

*(Note on terminology: Patterns #1, #2, #5, and #6 use industry-standard names; Patterns #3 "Layer-by-Layer Transformation" and #4 "Hold-and-Scroll Reveal" are synthesized architectural names codifying recurring high-performing creative formats).*

### Pattern 1: Seamless Panorama / Follow-the-Line (`panorama`)
- **Mechanic:** A wide continuous canvas of width $W = 1080 \times K\text{ px}$ ($K \in [3, 5]$) and height $1350\text{ px}$ is rendered once and sliced at $x \in \{0, 1080, 2160, \dots\}$. A continuous vector ribbon, bezier path, horizon gradient, or architectural wave crosses every seam $x = 1080i$.
- **Strict Engine & Linter Rules:**
  - Span length $K$ should be **3–5 slides** (stretching one background across 7–10 slides dilutes visual novelty).
  - **Zero text across seams:** All text blocks stay strictly within $[1080i + 72, 1080(i+1) - 72]$.
  - **25% object rule:** Any decorative motif intentionally bridging seam $x = 1080i$ must place at least **25% of its bounding width** on Slide $i$ and **25%** on Slide $i+1$ so neither half looks like a rendering glitch.

### Pattern 2: Contrast / Before-vs-After (`contrast`)
- **Mechanic:** Either a single split-frame slide (`left` vs `right` / top vs bottom) or two paired consecutive slides (`pair: "A"`, `side: "before"` then `side: "after"`) that hold geometry constant while flipping **one variable**: amateur vs pro, myth vs data, legacy workflow vs agentic workflow.
- **Strict Engine & Linter Rules:**
  - Paired consecutive `contrast_split` slides are treated by the alternation linter as **one composite layout unit** (explicitly exempt from the adjacent-duplicate layout error when `pair` matches).
  - Left/Before uses muted/warning token (`danger` / desaturated surface); Right/After uses high-clarity `accent` / `success` token—never relying on red/green hue alone (paired with explicit icon badges `✕` vs `✓` for color-vision deficiency safety).

### Pattern 3: Layer-by-Layer Transformation (`layer_stack`)
- **Mechanic:** Consecutive slides show the **exact same base diagram or architecture frame** from a fixed camera viewport while activating one additional semantic layer per swipe (`active_layers = 1`, then `2`, then `3` of `total_layers`).
- **Strict Engine & Linter Rules:**
  - Coordinates of Layers $1 \dots m$ remain pixel-identical on Slide $m+1$; inactive future layers render as subtle ghost outlines (`opacity: 0.16`, dashed stroke) so the viewer sees how much of the system remains to be unlocked.
  - Progressive `layer_stack` sequences with strictly incrementing `active_layers` are permitted across 2–4 consecutive slides.

### Pattern 4: Hold-and-Scroll Reveal (`reveal_hold`)
- **Mechanic:** Slide $N$ establishes a sharp claim, paradox, or diagnostic question and positions a visual card/callout bleeding **8–15% (`90–160 px`) past the right canvas boundary (`x = 1080`)**. Slide $N+1$ immediately resolves the exact tension raised on Slide $N$.
- **Strict Engine & Linter Rules:**
  - `reveal_hold` cannot be the final slide of a deck (linter error: unfulfilled cliffhanger).
  - Only the visual teaser badge/card bleeds off `x = 1080`; primary headline and body text remain inside the `72 px` safe margin.

### Pattern 5: Bento-Grid Data Cards (`bento`)
- **Mechanic:** Modular asymmetric CSS/SVG grid holding **4 to 9 self-contained tiles** (`1x1`, `2x1`, `1x2`, `2x2`), each containing a single metric, principle, or tool card.
- **Strict Engine & Linter Rules:**
  - Preset deterministic grid topologies for 4, 5, 6, 7, 8, and 9 tiles so there are never ragged orphan cells.
  - Max **8 words per tile** body (enforced by linter) to maintain crisp scannability at mobile viewport size.
  - Exceptionally high **Save-to-Reach** conversion when placed as a mid-deck framework overview or Slide 9 cheat sheet.

### Pattern 6: Anti-Aesthetic / Editorial Scrapbook (`scrapbook`)
- **Mechanic:** Deliberate counter-reaction to sterile corporate AI templates: warm paper grain, kraft masking-tape strips, torn-paper card edges, subtle halftone dot matrices, hand-drawn SVG scribble underlines/arrows, and slight card rotation.
- **Strict Engine & Linter Rules:**
  - Card rotation is **strictly bounded to $\theta \in [-2.5^\circ, +2.5^\circ]$** computed via a deterministic hash `mulberry32(seedFrom(topic, slide.id))`—never `Math.random()`—guaranteeing byte-identical golden-image builds while preserving organic imperfection.

---

## 3. Complete Catalog of the 11 Deterministic Slide Layouts

| # | Layout ID | Primary Role | Visual Density | Key Typed Fields |
|---|---|---|---|---|
| 1 | `cover_hook` | Slide 1 Scroll-Stopper | Sparse / High-Impact | `eyebrow`, `headline` (<=12w), `sub`, `badge`, `icon`, `footer_hook` |
| 2 | `contrast_split` | Comparison / Myth-vs-Fact | Medium | `pair`, `mode` (`split` \| `before` \| `after`), `left`, `right`, `headline` |
| 3 | `layer_stack` | Progressive System Build | Medium | `headline`, `layers[]`, `active_layers`, `total_layers` |
| 4 | `bento_grid` | Multi-Stat / Framework Matrix | Dense | `headline`, `tiles[]` (`label`, `value`, `text` <=8w, `span`, `accent`) |
| 5 | `reveal_hold` | Open-Loop Cliffhanger | Sparse | `headline`, `body`, `teaser_label`, `bleed_ratio` (`0.08..0.15`) |
| 6 | `scrapbook` | Opinion / Story / Human Note | Medium | `headline`, `note`, `callout`, `sticker`, `underline_word` |
| 7 | `data_chart` | Quantitative Evidence | Medium-Dense | `headline`, `chart` (`bar`\|`horizontal_bar`\|`line`\|`donut`, `labels`, `values`, `unit`), `takeaway`, `source` |
| 8 | `steps` | Sequential Playbook / How-To | Medium | `headline`, `steps[]` (`number`, `title`, `detail`) |
| 9 | `proof` | Cited Case Study / Metric | Sparse-Medium | `headline`, `metric_value`, `metric_label`, `quote_or_finding`, `source` (required!) |
| 10 | `summary` | Slide N-1 Saveable Cheat Sheet | Medium-Dense | `headline`, `bullets[]` (<=6 items, <=8w each), `save_prompt` |
| 11 | `cta` | Slide N Single-Action Close | Sparse | `headline`, `action` (`save`\|`comment`\|`follow`\|`link_in_caption`), `keyword`, `text` |

---

## 4. Typography, Geometry & WCAG 2.1 Contrast Mathematics

### 4.1 1080 × 1350 Grid & Type Scale

```
+-------------------------------------------------------+ (0, 0)
|  72px top safe zone (eyebrow / handle / slide X of N) |
|  +-------------------------------------------------+  | (72, 96)
|  |                                                 |  |
|  |   ACTIVE CONTENT CANVAS: 936 px × 1120 px       |  |
|  |                                                 |  |
|  |   Headline: 84–112 px (line-height 1.05–1.12)   |  |
|  |   Section / Subhead: 48–60 px                   |  |
|  |   Body Copy: 40–46 px (hard floor: 36 px)       |  |
|  |   Badge / Source Label: 28–32 px                |  |
|  |                                                 |  |
|  +-------------------------------------------------+  | (1008, 1216)
|  110px reserved footer (y = 1240..1350):              |
|  [Handle]            [Micro-hook <=7w ->]   [03 / 10] |
+-------------------------------------------------------+ (1080, 1350)
```

### 4.2 WCAG 2.1 Relative Luminance & Contrast Enforcement

For every theme (`editorial`, `brutal-bento`, `scrapbook`, `linkedin-executive`), the engine computes exact WCAG 2.1 contrast ratios before rendering. Given an sRGB hex color $(R_8, G_8, B_8) \in [0, 255]^3$:

$$c_{\text{lin}} = \begin{cases} \dfrac{c / 255}{12.92} & \text{if } c / 255 \le 0.04045 \\[6pt] \left(\dfrac{c / 255 + 0.055}{1.055}\right)^{2.4} & \text{otherwise} \end{cases}$$

$$L = 0.2126 R_{\text{lin}} + 0.7152 G_{\text{lin}} + 0.0722 B_{\text{lin}}$$

$$\text{CR}(L_1, L_2) = \frac{\max(L_1, L_2) + 0.05}{\min(L_1, L_2) + 0.05}$$

- **Body & Footer Text (`text_primary`, `text_secondary` vs `bg_primary`, `bg_surface`):** Must satisfy $\text{CR} \ge 4.5:1$ (WCAG AA Normal).
- **Display Headlines & Accent Badges (>=36 px bold):** Must satisfy $\text{CR} \ge 3.0:1$ (WCAG AA Large).
- **Theme Audit Results:**
  - `editorial`: Ink `#141413` on Warm Cream `#FAF7F2` -> **17.4:1**; Muted `#524E48` on `#FAF7F2` -> **7.6:1**; Vermilion `#B8331A` on `#FAF7F2` -> **5.4:1**.
  - `brutal-bento`: Crisp White `#F8FAFC` on Obsidian `#0C0D10` -> **18.8:1**; Acid Lime `#C8FF32` on `#0C0D10` -> **16.2:1**; Obsidian `#0C0D10` on `#C8FF32` -> **16.2:1**.
  - `scrapbook`: Marker Ink `#1E1B18` on Tactile Paper `#F4EFE6` -> **15.1:1**; Stamp Crimson `#A62620` on `#F4EFE6` -> **5.9:1**.
  - `linkedin-executive`: Navy `#0F172A` on Crisp Slate `#F8FAFC` -> **17.8:1**; Royal Blue `#1D4ED8` on `#F8FAFC` -> **6.4:1**.
