/**
 * The single source of truth for the carousel contract.
 *
 * Zod -> (this file) -> spec/carousel.schema.json -> Python Pydantic models -> OpenAPI 3.1.
 * Nothing else may define slide shapes; every renderer, linter, MCP tool and SDK
 * derives from these definitions so a plan that validates anywhere renders everywhere.
 */
import { z } from 'zod';
import { ART_STYLES } from './generative.js';

export const SPEC_VERSION = '1.0' as const;

export const SLIDE_LAYOUTS = [
  'cover_hook',
  'contrast_split',
  'layer_stack',
  'bento_grid',
  'reveal_hold',
  'scrapbook',
  'data_chart',
  'steps',
  'proof',
  'summary',
  'cta',
  'generative',
] as const;

export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

export const PLATFORMS = ['instagram', 'linkedin', 'generic'] as const;
export const GOALS = ['awareness', 'saves', 'authority', 'leads', 'community'] as const;
export const ACTIONS = ['save', 'comment', 'follow', 'link_in_caption', 'share'] as const;
export const CHART_KINDS = ['bar', 'horizontal_bar', 'line', 'donut'] as const;
export const BG_TOKENS = ['primary', 'secondary', 'surface', 'elevated', 'accent'] as const;
export const DENSITY = ['sparse', 'medium', 'dense'] as const;

const nonEmpty = (max: number, label: string) =>
  z.string().trim().min(1, `${label} must not be empty`).max(max, `${label} must be <= ${max} characters`);

const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label} must be <= ${max} characters`).optional();

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` only — the linter's contrast math needs resolvable colors. */
const HexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Expected a hex color like #1A1A1A');

export const PanoramaSchema = z
  .object({
    span: z
      .number()
      .int()
      .min(2)
      .max(6)
      .describe('Number of consecutive slides sharing one continuous wide canvas (2-6).'),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Optional 0-based position inside the span. Inferred from slide order when omitted.'),
  })
  .describe('Declares this slide as part of a seamless panorama span.');

/**
 * Generative backdrop config. Shared by slides and the deck-level default, so an
 * agent can say "plot something behind every slide" once, or override per frame.
 */
export const ArtSchema = z
  .object({
    style: z.enum(ART_STYLES).optional().describe('Composition to plot. Omit to let the engine choose deterministically from the slide seed.'),
    seed: z.string().trim().min(1).max(64).optional().describe('Stable seed. Same seed + style always renders the same drawing.'),
    density: z.number().min(0).max(1).optional().describe('How much ink the composition spends (0 sparse .. 1 dense).'),
    opacity: z.number().min(0).max(1).optional().describe('Global alpha multiplier for the composition.'),
    backdrop: z.boolean().optional().describe('Also plot a low-opacity field behind a sparse layout. Default true where it is safe.'),
  })
  .describe('Deterministic generative art (topography, orbital, halftone, isometric, flowfield, constellation, moire, ribbon).');

const baseFields = {
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,40}$/, 'Slide id must be a short kebab-case slug')
    .optional()
    .describe('Optional stable slide id (used for deterministic scrapbook jitter and alt text).'),
  eyebrow: optionalText(48, 'eyebrow').describe('Small kicker line above the headline, e.g. "RETENTION 101" or "SLIDE 04".'),
  headline: nonEmpty(180, 'headline').describe('The single dominant line of the slide.'),
  footer_hook: optionalText(64, 'footer_hook').describe('Micro-hook (<= 7 words) teasing the next slide.'),
  bg: z.enum(BG_TOKENS).optional().describe('Background token override for this slide.'),
  accent: z.boolean().optional().describe('Render this slide on the theme accent surface for emphasis.'),
  alt_text: optionalText(280, 'alt_text').describe('Accessibility description used in captions and the HTML deck.'),
  notes: optionalText(400, 'notes').describe('Private production/speaker notes. Never rendered.'),
  panorama: PanoramaSchema.optional(),
  art: ArtSchema.optional(),
};

const CoverHookSlide = z.object({
  ...baseFields,
  layout: z.literal('cover_hook'),
  sub: optionalText(180, 'sub').describe('One supporting line under the headline.'),
  badge: optionalText(40, 'badge').describe('Tiny corner badge, e.g. "2026 DATA" or "PART 2".'),
  icon: optionalText(40, 'icon').describe('Lucide icon name rendered as a vector glyph (e.g. "sparkles", "trending-up").'),
  kicker: optionalText(60, 'kicker').describe('Lead-in above the headline ("Most teams get this wrong:").'),
});

const ContrastSide = z.object({
  label: nonEmpty(40, 'contrast label'),
  text: optionalText(220, 'contrast text'),
  items: z.array(nonEmpty(90, 'contrast item')).max(4).optional(),
  icon: optionalText(40, 'icon').optional(),
});

const ContrastSplitSlide = z.object({
  ...baseFields,
  layout: z.literal('contrast_split'),
  mode: z.enum(['split', 'before', 'after']).default('split').describe('`split` shows both halves; `before`/`after` pair across consecutive slides.'),
  pair: z.string().regex(/^[a-z0-9-]{1,24}$/).optional().describe('Shared id linking a before/after pair.'),
  left: ContrastSide,
  right: ContrastSide,
  verdict: optionalText(120, 'verdict').describe('One-line takeaway printed under the split.'),
});

const LayerSchema = z.object({
  label: nonEmpty(60, 'layer label'),
  detail: optionalText(140, 'layer detail'),
});

const LayerStackSlide = z.object({
  ...baseFields,
  layout: z.literal('layer_stack'),
  layers: z.array(LayerSchema).min(2).max(5).describe('Ordered stack of layers; geometry is identical across the sequence.'),
  active_layers: z.number().int().min(1).max(5).optional().describe('How many layers are lit on this slide (default: inferred from sequence position).'),
  total_layers: z.number().int().min(2).max(5).optional(),
});

const BentoTile = z.object({
  label: nonEmpty(40, 'tile label'),
  value: optionalText(16, 'tile value').describe('Big number or short token, e.g. "3.2x".'),
  text: optionalText(80, 'tile text').describe('<= 8 words so the tile stays scannable at phone size.'),
  span: z.union([z.literal(1), z.literal(2)]).optional().describe('Column span (1 or 2) inside the bento grid.'),
  accent: z.boolean().optional(),
  icon: optionalText(40, 'icon').optional(),
});

const BentoGridSlide = z.object({
  ...baseFields,
  layout: z.literal('bento_grid'),
  tiles: z.array(BentoTile).min(4).max(9).describe('4-9 tiles; the engine picks a deterministic grid topology for the count.'),
});

const RevealHoldSlide = z.object({
  ...baseFields,
  layout: z.literal('reveal_hold'),
  body: nonEmpty(360, 'body').describe('The tension/claim that slide N+1 resolves.'),
  teaser_label: nonEmpty(32, 'teaser_label').describe('Label on the card that bleeds past the right edge.'),
  bleed_ratio: z.number().min(0.05).max(0.2).optional().describe('Fraction of the teaser card cut off by the canvas edge (0.08-0.15 recommended).'),
});

const ScrapbookSlide = z.object({
  ...baseFields,
  layout: z.literal('scrapbook'),
  note: nonEmpty(420, 'note').describe('The hand-written style body copy.'),
  callout: optionalText(120, 'callout').describe('Short highlighted phrase.'),
  sticker: optionalText(24, 'sticker').describe('Tiny sticker word, e.g. "honestly" or "unpopular".'),
  underline_word: optionalText(40, 'underline_word').describe('A word inside the headline to underline with a marker scribble.'),
});

export const ChartSchema = z.object({
  kind: z.enum(CHART_KINDS),
  labels: z.array(nonEmpty(24, 'chart label')).min(2).max(8),
  values: z.array(z.number().finite()).min(2).max(8),
  unit: optionalText(12, 'chart unit').describe('Suffix printed on values, e.g. "%", "k", "hrs".'),
  max: z.number().positive().optional().describe('Optional axis ceiling; defaults to a nice rounded max of the data.'),
  highlight: z.number().int().min(0).optional().describe('Index of the bar/point to highlight in the accent color.'),
}).refine((c) => c.labels.length === c.values.length, {
  message: 'chart.labels and chart.values must be the same length',
});

const DataChartSlide = z.object({
  ...baseFields,
  layout: z.literal('data_chart'),
  chart: ChartSchema,
  takeaway: optionalText(140, 'takeaway'),
  source: nonEmpty(160, 'source').describe('Provenance line printed under the chart. Required: no sourced number, no slide.'),
});

const StepSchema = z.object({
  title: nonEmpty(70, 'step title'),
  detail: optionalText(180, 'step detail'),
});

const StepsSlide = z.object({
  ...baseFields,
  layout: z.literal('steps'),
  steps: z.array(StepSchema).min(2).max(5),
  emphasis: z.enum(['numbered', 'checklist']).optional(),
});

const ProofSlide = z.object({
  ...baseFields,
  layout: z.literal('proof'),
  metric_value: nonEmpty(16, 'metric_value').describe('The single number that carries the slide, e.g. "-38%".'),
  metric_label: nonEmpty(60, 'metric_label'),
  finding: nonEmpty(400, 'finding').describe('What the number means, in plain language.'),
  source: nonEmpty(160, 'source').describe('Named, checkable source. Fabricated proof is a hard product failure.'),
  attribution: optionalText(80, 'attribution').describe('Person/company behind the result.'),
});

const SummarySlide = z.object({
  ...baseFields,
  layout: z.literal('summary'),
  bullets: z.array(nonEmpty(100, 'summary bullet')).min(3).max(6).describe('3-6 bullets, each <= 8 words: this is the save-worthy cheat sheet.'),
  save_prompt: optionalText(90, 'save_prompt'),
});

const CtaSlide = z.object({
  ...baseFields,
  layout: z.literal('cta'),
  action: z.enum(ACTIONS),
  keyword: optionalText(24, 'keyword').describe('Comment keyword when action is `comment`.'),
  text: nonEmpty(240, 'cta text'),
  handle: optionalText(40, 'handle').describe('Handle to follow, without the @.'),
});

const GenerativeSlide = z.object({
  ...baseFields,
  layout: z.literal('generative'),
  sub: optionalText(180, 'sub').describe('One supporting line under the headline.'),
  figure_label: optionalText(48, 'figure_label').describe('Caption printed above the plot, e.g. "FIG. 03 — SHA256 DRIFT".'),
  annotations: z
    .array(nonEmpty(90, 'annotation'))
    .min(1)
    .max(3)
    .optional()
    .describe('Up to three plotter-style legend rows read as data, not body copy.'),
});

export const SlideSchema = z.discriminatedUnion('layout', [
  CoverHookSlide,
  ContrastSplitSlide,
  LayerStackSlide,
  BentoGridSlide,
  RevealHoldSlide,
  ScrapbookSlide,
  DataChartSlide,
  StepsSlide,
  ProofSlide,
  SummarySlide,
  CtaSlide,
  GenerativeSlide,
]);

export type Slide = z.infer<typeof SlideSchema>;
export type CoverHookSlideT = z.infer<typeof CoverHookSlide>;
export type ContrastSplitSlideT = z.infer<typeof ContrastSplitSlide>;
export type LayerStackSlideT = z.infer<typeof LayerStackSlide>;
export type BentoGridSlideT = z.infer<typeof BentoGridSlide>;
export type RevealHoldSlideT = z.infer<typeof RevealHoldSlide>;
export type ScrapbookSlideT = z.infer<typeof ScrapbookSlide>;
export type DataChartSlideT = z.infer<typeof DataChartSlide>;
export type StepsSlideT = z.infer<typeof StepsSlide>;
export type ProofSlideT = z.infer<typeof ProofSlide>;
export type SummarySlideT = z.infer<typeof SummarySlide>;
export type CtaSlideT = z.infer<typeof CtaSlide>;
export type GenerativeSlideT = z.infer<typeof GenerativeSlide>;

export const BrandSchema = z.object({
  name: nonEmpty(48, 'brand name'),
  handle: optionalText(40, 'handle'),
  website: optionalText(90, 'website'),
  accent_override: HexColor.optional().describe('Overrides the theme accent for brand alignment (contrast re-checked by the linter).'),
  mark: optionalText(4, 'mark').describe('1-4 character monogram drawn in the footer.'),
});

export const CaptionSchema = z.object({
  text: z.string().max(3200).describe('The post caption. Platform length rules are enforced by the linter.'),
  hashtags: z.array(z.string().max(40)).max(30).optional(),
  first_comment: optionalText(600, 'first_comment'),
});

export const ThemeOverrideSchema = z.object({
  colors: z.record(HexColor).optional(),
  typography: z.record(z.number().positive()).optional(),
  radii: z.record(z.number().nonnegative()).optional(),
});

export const CarouselSpecSchema = z.object({
  version: z.literal(SPEC_VERSION).default(SPEC_VERSION),
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'id must be a short kebab-case slug')
    .optional()
    .describe('Stable slug for the carousel (used for output folder names and asset attribution).'),
  title: optionalText(140, 'title').describe('Human title for filenames and the HTML deck header.'),
  platform: z.enum(PLATFORMS).describe('Target surface. Drives slide-count rules, PDF export and caption limits.'),
  goal: z.enum(GOALS).default('saves').describe('Primary objective; the linter checks the deck is structured to earn it.'),
  theme: z.string().min(1).default('editorial').describe('Theme id from spec/themes (editorial, brutal-bento, scrapbook, linkedin-executive) or an absolute JSON path.'),
  theme_override: ThemeOverrideSchema.optional(),
  brand: BrandSchema.optional(),
  caption: CaptionSchema.optional(),
  cta_link: optionalText(200, 'cta_link').describe('Destination URL for the caption/CTA (never printed inside LinkedIn slide art).'),
  art: ArtSchema.optional(),
  slides: z.array(SlideSchema).min(2).max(20).describe('Ordered slides. 7-10 is the Instagram sweet spot; 5-10 for LinkedIn PDFs.'),
  meta: z
    .object({
      author: optionalText(80, 'author'),
      language: z.string().min(2).max(12).default('en').describe('BCP-47 language tag of the copy.'),
      sources: z.array(nonEmpty(200, 'source')).max(30).optional(),
      notes: optionalText(600, 'notes'),
      created_at: z.string().optional(),
    })
    .default({ language: 'en' }),
});

export type CarouselSpec = z.infer<typeof CarouselSpecSchema>;
export type Platform = (typeof PLATFORMS)[number];
export type Goal = (typeof GOALS)[number];
export type CtaAction = (typeof ACTIONS)[number];
export type Chart = z.infer<typeof ChartSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/** Validates unknown input without throwing, converting Zod issues to stable codes. */
export function validateSpec(input: unknown): ValidationResult {
  const parsed = CarouselSpecSchema.safeParse(input);
  if (parsed.success) return { ok: true, issues: [] };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
      code: String(issue.code),
    })),
  };
}

/** Parses and throws a readable error listing every schema violation. */
export function parseSpec(input: unknown): CarouselSpec {
  const result = validateSpec(input);
  if (!result.ok) {
    const detail = result.issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n');
    throw new Error(`Invalid CarouselSpec:\n${detail}`);
  }
  return CarouselSpecSchema.parse(input);
}

export const LAYOUT_META: Record<SlideLayout, { name: string; role: string; density: 'sparse' | 'medium' | 'dense'; useWhen: string }> = {
  cover_hook: {
    name: 'Cover Hook',
    role: 'Slide 1 scroll-stopper',
    density: 'sparse',
    useWhen: 'Always slide 1. One promise, one tension, <= 12 words.',
  },
  contrast_split: {
    name: 'Contrast Split',
    role: 'Before/after, myth/fact, old/new',
    density: 'medium',
    useWhen: 'When the idea is best explained by a single flipped variable.',
  },
  layer_stack: {
    name: 'Layer Stack',
    role: 'Progressive system build',
    density: 'medium',
    useWhen: '2-4 consecutive slides, identical geometry, +1 active layer per swipe.',
  },
  bento_grid: {
    name: 'Bento Grid',
    role: 'Framework / multi-metric matrix',
    density: 'dense',
    useWhen: 'Mid-deck overview or the save-worthy cheat sheet.',
  },
  reveal_hold: {
    name: 'Reveal & Hold',
    role: 'Open-loop cliffhanger',
    density: 'sparse',
    useWhen: 'Never last. A teaser card bleeds 8-15% past the right edge.',
  },
  scrapbook: {
    name: 'Scrapbook',
    role: 'Human, opinionated, tactile',
    density: 'medium',
    useWhen: 'Stories, hot takes, founder notes. Breaks template fatigue.',
  },
  data_chart: {
    name: 'Data Chart',
    role: 'Quantitative evidence',
    density: 'medium',
    useWhen: 'Only with a real, sourced dataset. No invented numbers.',
  },
  steps: {
    name: 'Steps',
    role: 'How-to playbook',
    density: 'medium',
    useWhen: 'Sequential process in one frame (2-5 steps).',
  },
  proof: {
    name: 'Proof',
    role: 'Cited case study / metric',
    density: 'sparse',
    useWhen: 'One number plus a named, checkable source.',
  },
  generative: {
    name: 'Generative Plot',
    role: 'Visual proof / data as texture',
    density: 'sparse',
    useWhen: 'When the idea deserves an image the stock libraries do not have: a seeded plotter composition plus one line.',
  },
  summary: {
    name: 'Summary',
    role: 'Saveable recap',
    density: 'medium',
    useWhen: 'Second to last: 3-6 bullets the reader screenshots.',
  },
  cta: {
    name: 'CTA',
    role: 'Slide N single action',
    density: 'sparse',
    useWhen: 'Always last. Exactly one action.',
  },
};
