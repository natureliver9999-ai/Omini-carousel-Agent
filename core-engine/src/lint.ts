/**
 * The quality gate.
 *
 * The linter is the product's spine: it encodes 2026 platform mechanics, retention
 * structure, copy discipline, WCAG contrast and provenance rules as machine-checkable
 * facts, so an agent can iterate against errors instead of guessing at taste.
 */
import { auditThemeContrast, loadTheme, resolvePalette, type Theme } from './themes.js';
import { LAYOUT_META, validateSpec, type CarouselSpec, type Slide } from './schema.js';
import { countEmoji } from './text.js';
import { planPanorama } from './panorama.js';
import { contrastRatio } from './colors.js';

export type Severity = 'error' | 'warn' | 'info';

export interface LintIssue {
  code: string;
  severity: Severity;
  path: string;
  message: string;
  hint?: string;
}

export interface LintMetrics {
  slides: number;
  totalWords: number;
  avgWordsPerSlide: number;
  readingSeconds: number;
  layouts: Record<string, number>;
  contrastPairs: Array<{ pair: string; ratio: number; required: number; pass: boolean }>;
}

export interface LintReport {
  ok: boolean;
  issues: LintIssue[];
  errors: LintIssue[];
  warnings: LintIssue[];
  infos: LintIssue[];
  metrics: LintMetrics;
}

export interface LintOptions {
  theme?: Theme;
  /** Skip rules that need the filesystem (theme audit). */
  skipThemeAudit?: boolean;
}

const CLICHES: Array<[string, string]> = [
  ['game changer', 'Show the mechanism instead of naming it.'],
  ["in today's fast-paced", 'Delete the throat-clearing and start with the claim.'],
  ['in the ever-evolving', 'Name the specific change, with a date.'],
  ['unlock the power', 'Say what the reader can now do.'],
  ['unleash', 'Use a concrete verb.'],
  ['supercharge', 'Use a number or a verb you could film.'],
  ['revolutionize', 'State the before/after instead.'],
  ['dive in', 'Cut it. The deck should already be in the deep end.'],
  ["let's dive", 'Cut it.'],
  ['delve into', 'Use "look at" or delete.'],
  ['navigate the landscape', 'Name the terrain and the map.'],
  ['cutting-edge', 'Cite the release, not the adjective.'],
  ['synergy', 'Say what combines with what.'],
  ['secret sauce', 'Name the ingredient.'],
  ['10x your', 'Use a measured multiplier or none.'],
  ['elevate your', 'Use a specific outcome.'],
  ['next level', 'Say the level.'],
  ['buckle up', 'Cut it.'],
  ['without further ado', 'Cut it.'],
  ['in conclusion', 'Cut it; the CTA is the conclusion.'],
  ["it's important to note", 'Just note it.'],
  ['look no further', 'Cut it.'],
  ['paradigm shift', 'Say what changed in practice.'],
  ['tapestry', 'Use "mix" or delete.'],
  ['hidden gem', 'Say where it is.'],
];

const BANNED_PHRASES_LINKEDIN = ['link in bio'];

const WORDS = (value: string) => value.trim().split(/\s+/).filter(Boolean);
const wordCount = (value?: string) => (value ? WORDS(value).length : 0);

function slideCopy(slide: Slide): string[] {
  const parts: string[] = [slide.headline];
  if (slide.eyebrow) parts.push(slide.eyebrow);
  if (slide.footer_hook) parts.push(slide.footer_hook);
  const any = slide as Record<string, unknown>;
  for (const key of ['sub', 'kicker', 'verdict', 'body', 'note', 'callout', 'takeaway', 'finding', 'text', 'save_prompt', 'metric_label', 'teaser_label', 'figure_label']) {
    const value = any[key];
    if (typeof value === 'string') parts.push(value);
  }
  for (const key of ['bullets', 'steps', 'tiles', 'layers', 'annotations']) {
    const value = any[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') parts.push(item);
        else if (item && typeof item === 'object') {
          for (const v of Object.values(item as Record<string, unknown>)) {
            if (typeof v === 'string') parts.push(v);
          }
        }
      }
    }
  }
  for (const key of ['left', 'right']) {
    const side = any[key] as { label?: string; text?: string; items?: string[] } | undefined;
    if (side) {
      if (side.label) parts.push(side.label);
      if (side.text) parts.push(side.text);
      if (side.items) parts.push(...side.items);
    }
  }
  if ((any.chart as { labels?: string[] } | undefined)?.labels) parts.push(...((any.chart as { labels: string[] }).labels));
  return parts.filter(Boolean);
}

/** Per-layout word budgets for rendered copy (excluding chrome). */
const COPY_BUDGET: Record<Slide['layout'], number> = {
  cover_hook: 40,
  contrast_split: 72,
  layer_stack: 70,
  bento_grid: 70,
  reveal_hold: 60,
  scrapbook: 90,
  data_chart: 45,
  steps: 80,
  proof: 70,
  summary: 70,
  cta: 45,
  generative: 60,
};

export function lintSpec(input: unknown, options: LintOptions = {}): LintReport {
  const issues: LintIssue[] = [];
  const add = (severity: Severity, code: string, path: string, message: string, hint?: string) => {
    issues.push({ severity, code, path, message, hint });
  };

  const schema = validateSpec(input);
  if (!schema.ok) {
    for (const issue of schema.issues) add('error', 'SCHEMA_INVALID', issue.path, issue.message);
    return {
      ok: false,
      issues,
      errors: issues.filter((i) => i.severity === 'error'),
      warnings: [],
      infos: [],
      metrics: { slides: 0, totalWords: 0, avgWordsPerSlide: 0, readingSeconds: 0, layouts: {}, contrastPairs: [] },
    };
  }

  const spec = input as CarouselSpec;
  const slides = spec.slides;
  const n = slides.length;

  /* ---------- structure ---------- */
  if (slides[0].layout !== 'cover_hook') {
    add('error', 'FIRST_SLIDE_NOT_COVER', 'slides.0.layout', 'Slide 1 must be `cover_hook`.', 'The first frame is the entire hook; every pattern depends on it.');
  }
  if (slides[n - 1].layout !== 'cta') {
    add('error', 'LAST_SLIDE_NOT_CTA', `slides.${n - 1}.layout`, 'The final slide must be `cta`.', 'One deck, one action.');
  }
  const ctaCount = slides.filter((s) => s.layout === 'cta').length;
  if (ctaCount > 1) add('error', 'MULTIPLE_CTA', 'slides', `${ctaCount} CTA slides found; exactly one is allowed.`, 'A second CTA splits attention and drops conversion.');
  if (n < 3) add('warn', 'TOO_FEW_SLIDES', 'slides', 'Fewer than 3 slides barely outperforms a single image.');
  if (!slides.some((s) => s.layout === 'summary')) {
    add('info', 'NO_SUMMARY_SLIDE', 'slides', 'No `summary` slide: the deck has no screenshot-worthy recap.', 'Saves are the highest-intent Instagram signal; a recap earns them.');
  }
  if (!slides.some((s) => s.layout === 'proof' || s.layout === 'data_chart')) {
    add('info', 'NO_EVIDENCE_SLIDE', 'slides', 'No `proof` or `data_chart` slide: the deck asserts without evidence.');
  }

  /* ---------- platform pacing ---------- */
  if (spec.platform === 'instagram') {
    if (n < 5) add('warn', 'IG_SLIDE_COUNT', 'slides', `${n} slides is below the Instagram sweet spot (7-10).`);
    if (n > 12) add('warn', 'IG_SLIDE_COUNT', 'slides', `${n} slides exceeds the completion sweet spot (7-10); padding costs completion.`);
    if (n > 20) add('error', 'IG_HARD_LIMIT', 'slides', 'Instagram allows a maximum of 20 slides.');
  }
  if (spec.platform === 'linkedin') {
    if (n < 4) add('warn', 'LI_SLIDE_COUNT', 'slides', `${n} pages is too thin to earn LinkedIn document dwell time (5-10 recommended).`);
    if (n > 12) add('warn', 'LI_SLIDE_COUNT', 'slides', `${n} pages exceeds the LinkedIn mobile completion sweet spot (5-10).`);
  }

  /* ---------- generative art ---------- */
  const denseLayouts = new Set(['bento_grid', 'data_chart', 'steps', 'summary', 'contrast_split']);
  slides.forEach((slide, i) => {
    const art = (slide as { art?: { style?: string; density?: number; opacity?: number } }).art;
    if (!art) return;
    if (slide.layout === 'generative') {
      if (!art.style) {
        add('info', 'ART_STYLE_IMPLICIT', `slides.${i}.art.style`, 'No art style set: the engine picks one deterministically from the slide seed.', 'Pin a style per slide when you want a deliberate sequence (topography → orbital → halftone).');
      }
      if (!(slide as { figure_label?: string }).figure_label) {
        add('info', 'ART_FIGURE_LABEL', `slides.${i}.figure_label`, 'No figure_label: the caption falls back to `FIG. NN — STYLE`.', 'Word the caption like a paper figure when the plot is claiming to be evidence.');
      }
      return;
    }
    if (denseLayouts.has(slide.layout)) {
      add('warn', 'ART_BACKDROP_DENSE', `slides.${i}.art`, `A generative backdrop behind \`${slide.layout}\` competes with dense copy.`, 'Keep art backdrops for sparse layouts, or set art.backdrop=false.');
    }
    if (art.opacity !== undefined && art.opacity > 0.5) {
      add('warn', 'ART_BACKDROP_LOUD', `slides.${i}.art.opacity`, `Backdrop opacity ${art.opacity} will fight the text it sits under.`, '0.1-0.25 is the legible range for a backdrop; use the `generative` layout for full-strength art.');
    }
  });

  /* ---------- per-slide copy ---------- */
  let totalWords = 0;
  const headlineSeen = new Map<string, number>();
  slides.forEach((slide, i) => {
    const path = `slides.${i}`;
    const copy = slideCopy(slide);
    const words = copy.reduce((sum, part) => sum + wordCount(part), 0);
    totalWords += words;

    if (words > COPY_BUDGET[slide.layout]) {
      add('error', 'SLIDE_COPY_BUDGET', path, `${words} words exceeds the ${COPY_BUDGET[slide.layout]}-word budget for \`${slide.layout}\`.`, 'Mobile readers scan; move the overflow into the caption.');
    }
    const headlineWords = wordCount(slide.headline);
    if (slide.layout === 'cover_hook') {
      if (headlineWords > 14) add('error', 'HOOK_TOO_LONG', `${path}.headline`, `Cover headline is ${headlineWords} words (max 14, target <= 12).`);
      else if (headlineWords > 12) add('warn', 'HOOK_TOO_LONG', `${path}.headline`, `Cover headline is ${headlineWords} words (target <= 12).`);
    } else if (headlineWords > 24) {
      add('warn', 'HEADLINE_TOO_LONG', `${path}.headline`, `Headline is ${headlineWords} words; it will auto-shrink below the legible floor.`);
    }

    if (slide.footer_hook && wordCount(slide.footer_hook) > 7) {
      add('warn', 'FOOTER_HOOK_TOO_LONG', `${path}.footer_hook`, `Footer hook is ${wordCount(slide.footer_hook)} words (max 7).`, 'It is a glance-length teaser, not a sentence.');
    }

    const lower = copy.join(' ').toLowerCase();
    for (const [phrase, hint] of CLICHES) {
      if (lower.includes(phrase)) add('warn', 'CLICHE_LANGUAGE', path, `AI-slop phrase detected: "${phrase}".`, hint);
    }
    if (spec.platform === 'linkedin') {
      for (const phrase of BANNED_PHRASES_LINKEDIN) {
        if (lower.includes(phrase)) add('warn', 'LI_LINK_IN_BIO', path, `"${phrase}" is an Instagram idiom; use "link in the comments".`);
      }
    }
    const emoji = copy.reduce((sum, part) => sum + countEmoji(part), 0);
    if (emoji > 3) add('error', 'EMOJI_OVERLOAD', path, `${emoji} emoji on one slide.`, 'The bundled text fonts have no emoji glyphs; they will be stripped at render time.');
    else if (emoji > 0) add('warn', 'EMOJI_STRIPPED', path, 'Emoji have no glyph in the bundled OFL fonts and will be stripped from the rendered art.', 'Put emoji in the caption instead.');

    if (slide.layout === 'bento_grid') {
      for (const tile of slide.tiles) {
        if (wordCount(tile.text) > 8) add('warn', 'BENTO_TILE_LONG', `${path}.tiles`, `Tile "${tile.label}" has ${wordCount(tile.text)} words (max 8).`);
      }
    }
    if (slide.layout === 'summary') {
      for (const bullet of slide.bullets) {
        if (wordCount(bullet) > 8) add('warn', 'SUMMARY_BULLET_LONG', `${path}.bullets`, `Bullet has ${wordCount(bullet)} words (max 8): "${bullet.slice(0, 40)}…"`);
      }
    }
    if (slide.layout === 'reveal_hold' && i === n - 1) {
      add('error', 'REVEAL_UNRESOLVED', path, 'A `reveal_hold` slide cannot be the last slide; its open loop must be paid off.');
    }
    if (slide.layout === 'cta' && slide.action === 'comment' && !slide.keyword) {
      add('error', 'CTA_KEYWORD_MISSING', path, 'CTA action is `comment` but no keyword is set.');
    }
    if (slide.layout === 'data_chart') {
      const chart = slide.chart;
      if (chart.values.every((v) => v === 0)) add('warn', 'CHART_ALL_ZERO', path, 'Every chart value is zero.');
      if (chart.kind === 'donut' && chart.values.some((v) => v < 0)) add('error', 'CHART_NEGATIVE_DONUT', path, 'Donut charts cannot represent negative values.');
    }
    if (slide.layout === 'proof' && /^\d+(\.\d+)?$/.test(slide.source.trim())) {
      add('error', 'SOURCE_NOT_NAMED', `${path}.source`, 'Source looks like a bare number, not a named source.');
    }

    const key = slide.headline.trim().toLowerCase();
    if (headlineSeen.has(key)) {
      add('warn', 'DUPLICATE_HEADLINE', path, `Headline duplicates slide ${headlineSeen.get(key)! + 1}.`);
    } else {
      headlineSeen.set(key, i);
    }

    if (spec.platform === 'instagram' && !slide.alt_text) {
      add('info', 'MISSING_ALT_TEXT', path, 'No alt_text; Instagram captions are read by screen readers and by search.');
    }
    if (/\bhttps?:\/\//i.test(copy.join(' ')) && spec.platform === 'linkedin') {
      add('warn', 'URL_IN_SLIDE', path, 'URL inside LinkedIn slide art is untappable in the PDF viewer.', 'Move it to the caption or first comment.');
    }
  });

  /* ---------- layout rhythm ---------- */
  const plan = planPanorama(slides);
  const samePanoramaSpan = (from: number, to: number) => {
    const a = plan.assignments.get(from);
    const b = plan.assignments.get(to);
    return Boolean(a && b && a.spanStart === b.spanStart);
  };
  const allowedLongRun = (run: Slide[]) => {
    if (run.every((s) => s.layout === 'layer_stack')) {
      const actives = run.map((s) => (s as { active_layers?: number }).active_layers);
      const monotonic = actives.every((v, idx) => idx === 0 || v === undefined || actives[idx - 1] === undefined || v === (actives[idx - 1] as number) + 1);
      return monotonic;
    }
    if (run.every((s) => s.layout === 'contrast_split')) {
      // A contrast run is legal when it decomposes into 1- or 2-slide units, and a
      // 2-slide unit shares one `pair` id (the before/after flip). Max four.
      if (run.length > 4) return false;
      const pairs = run.map((s) => (s as { pair?: string }).pair);
      let i = 0;
      while (i < pairs.length) {
        if (pairs[i] !== undefined && pairs[i] === pairs[i + 1]) { i += 2; continue; }
        i += 1;
      }
      return true;
    }
    return false;
  };
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && slides[j + 1].layout === slides[i].layout) j += 1;
    const runLength = j - i + 1;
    const run = slides.slice(i, j + 1);
    const inPanorama = samePanoramaSpan(i, j);
    if (runLength >= 3 && !allowedLongRun(run) && !inPanorama) {
      add('error', 'LAYOUT_REPEAT', `slides.${i}-${j}`, `${runLength} consecutive \`${slides[i].layout}\` slides.`, 'Alternate layouts so peripheral vision does not classify the deck as repetitive.');
    }
    i = j + 1;
  }
  let denseRun = 0;
  slides.forEach((slide, i) => {
    if (LAYOUT_META[slide.layout].density === 'dense') {
      denseRun += 1;
      if (denseRun === 4) {
        add('warn', 'DENSITY_RHYTHM', `slides.${i}`, '4 consecutive dense slides: insert a sparse frame to reset attention.');
      }
    } else {
      denseRun = 0;
    }
  });

  /* ---------- panorama geometry ---------- */
  for (const error of plan.errors) add('error', 'PANORAMA_CONFLICT', 'slides', error);
  for (const span of plan.spans) {
    const group = slides.slice(span.start, span.start + span.length);
    if (span.length > 5) add('warn', 'PANORAMA_TOO_LONG', `slides.${span.start}.panorama`, `Panorama spans ${span.length} slides; 3-5 keeps visual novelty high.`);
    const distinct = new Set(group.map((s) => s.layout));
    if (distinct.size > 1) {
      add('warn', 'PANORAMA_MIXED_LAYOUTS', `slides.${span.start}.panorama`, 'A panorama span mixes layouts; the continuous canvas will still render, but verify visually.');
    }
    if (span.start === n - span.length) {
      add('warn', 'PANORAMA_AT_END', `slides.${span.start}.panorama`, 'A panorama ending on the final slide cannot resolve its motion into a CTA.');
    }
  }

  /* ---------- caption & goals ---------- */
  if (!spec.caption?.text) {
    add('warn', 'MISSING_CAPTION', 'caption.text', 'No caption text. The caption is where the CTA and the keyword live.');
  } else {
    const len = spec.caption.text.length;
    const limit = spec.platform === 'instagram' ? 2200 : 3000;
    if (len > limit) add('error', 'CAPTION_TOO_LONG', 'caption.text', `Caption is ${len} characters; ${spec.platform} limit is ${limit}.`);
    if (len < 80) add('info', 'CAPTION_THIN', 'caption.text', 'Caption is very short; it carries the keyword CTA and the save prompt.');
    if (!spec.caption.text.includes('\n') && len > 300) {
      add('warn', 'CAPTION_NO_LINEBREAKS', 'caption.text', 'Long caption without line breaks is hard to scan on mobile.');
    }
  }
  if (spec.caption?.hashtags) {
    const tags = spec.caption.hashtags.length;
    if (spec.platform === 'instagram' && tags > 15) add('warn', 'TOO_MANY_HASHTAGS', 'caption.hashtags', `${tags} hashtags is over Instagram's practical ceiling (3-8).`);
    if (spec.platform === 'linkedin' && tags > 5) add('warn', 'TOO_MANY_HASHTAGS', 'caption.hashtags', `${tags} hashtags is over LinkedIn's practical ceiling (3-5).`);
  }
  if (spec.goal === 'saves' && !slides.some((s) => (s.layout === 'cta' && (s.action === 'save' || s.action === 'comment')) || s.layout === 'summary')) {
    add('info', 'GOAL_NOT_SERVED', 'goal', 'Goal is `saves` but no summary slide or save CTA exists to earn them.');
  }
  if (spec.platform === 'instagram' && spec.cta_link && !spec.caption?.first_comment) {
    add('info', 'LINK_PLACEMENT', 'cta_link', 'Instagram suppresses outbound links; consider `caption.first_comment`.');
  }

  /* ---------- colour ---------- */
  const contrastPairs: LintMetrics['contrastPairs'] = [];
  if (!options.skipThemeAudit) {
    let theme: Theme | undefined = options.theme;
    if (!theme) {
      try { theme = loadTheme(spec.theme); } catch (error) {
        add('error', 'THEME_NOT_FOUND', 'theme', (error as Error).message);
      }
    }
    if (theme) {
      const audits = auditThemeContrast(theme);
      for (const audit of audits) contrastPairs.push({ pair: audit.pair, ratio: audit.ratio, required: audit.required, pass: audit.pass });
      const failures = audits.filter((a) => !a.pass && a.required >= 4.5);
      for (const failure of failures) {
        add('warn', 'CONTRAST_LOW', 'theme', `${failure.pair} is ${failure.ratio}:1 (needs ${failure.required}:1); the engine will auto-correct toward AA at render time.`);
      }
      // Brand accent override must still work as a foreground on both surfaces.
      const override = spec.brand?.accent_override;
      if (override) {
        const ratio = contrastRatio(override, theme.colors.bg_primary);
        if (ratio < 3) add('error', 'BRAND_ACCENT_CONTRAST', 'brand.accent_override', `Brand accent ${override} is only ${ratio}:1 on the theme background (needs 3:1).`);
        contrastPairs.push({ pair: 'brand.accent_override on bg_primary', ratio, required: 3, pass: ratio >= 3 });
      }
      const palette = resolvePalette(theme, undefined, false, spec.brand?.accent_override ? { accent: spec.brand.accent_override } : undefined);
      void palette;
    }
  }

  /* ---------- metrics ---------- */
  const layouts: Record<string, number> = {};
  for (const slide of slides) layouts[slide.layout] = (layouts[slide.layout] ?? 0) + 1;
  const readingSeconds = Math.round((totalWords / 3.6) * 10) / 10;

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warn');
  const infos = issues.filter((i) => i.severity === 'info');

  return {
    ok: errors.length === 0,
    issues,
    errors,
    warnings,
    infos,
    metrics: {
      slides: n,
      totalWords,
      avgWordsPerSlide: Math.round((totalWords / n) * 10) / 10,
      readingSeconds,
      layouts,
      contrastPairs,
    },
  };
}

/** Human-readable report used by the CLI and MCP `validate_spec` tool. */
export function formatLintReport(report: LintReport): string {
  const lines: string[] = [];
  const status = report.ok ? (report.warnings.length ? 'PASS (with warnings)' : 'PASS') : 'FAIL';
  lines.push(`${status} — ${report.metrics.slides} slides, ${report.metrics.totalWords} words, ~${report.metrics.readingSeconds}s read`);
  const icon: Record<Severity, string> = { error: 'ERROR', warn: 'WARN ', info: 'INFO ' };
  for (const issue of [...report.errors, ...report.warnings, ...report.infos]) {
    lines.push(`${icon[issue.severity]} ${issue.code} [${issue.path}] ${issue.message}${issue.hint ? `\n        ↳ ${issue.hint}` : ''}`);
  }
  if (report.metrics.contrastPairs.length) {
    const failing = report.metrics.contrastPairs.filter((p) => !p.pass);
    lines.push(`CONTRAST ${report.metrics.contrastPairs.length - failing.length}/${report.metrics.contrastPairs.length} pairs pass WCAG AA`);
  }
  return lines.join('\n');
}
