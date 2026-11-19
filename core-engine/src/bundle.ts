/**
 * Distribution bundle: everything needed to publish, plus the provenance needed
 * to defend every number on every slide.
 */
import JSZip from 'jszip';
import type { CarouselSpec } from './schema.js';
import type { Theme } from './themes.js';

export interface AttributionRecord {
  provider: 'unsplash' | 'pexels' | 'engine' | 'user';
  asset: string;
  photographer?: string;
  photographer_url?: string;
  source_url?: string;
  license: string;
  slide?: number;
}

export interface CaptionBundle {
  caption: string;
  hashtags: string[];
  firstComment?: string;
  ctaLink?: string;
}

export interface BundleInput {
  spec: CarouselSpec;
  theme: Theme;
  slides: Array<{ index: number; filename: string; png: Buffer; layout: string; alt: string; panorama?: { spanLength: number; indexInSpan: number } }>;
  pdf?: Buffer;
  caption: CaptionBundle;
  attribution: AttributionRecord[];
  warnings: string[];
  renderer: string;
  durationMs: number;
}

export function buildCaptionMarkdown(input: BundleInput): string {
  const { spec, caption } = input;
  const parts: string[] = [];
  parts.push(`# ${spec.title ?? spec.id ?? 'Carousel'} — caption pack`);
  parts.push(`\n_Platform:_ ${spec.platform} &nbsp;·&nbsp; _Goal:_ ${spec.goal} &nbsp;·&nbsp; _Slides:_ ${spec.slides.length}`);
  parts.push('\n## Caption\n');
  parts.push(caption.caption.trim() || '_(no caption supplied)_');
  if (caption.hashtags.length) parts.push(`\n\n${caption.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}`);
  if (caption.firstComment) parts.push(`\n## First comment\n\n${caption.firstComment}`);
  if (caption.ctaLink) parts.push(`\n## Link\n\n${caption.ctaLink}`);
  const alt = input.slides.filter((s) => s.alt);
  if (alt.length) {
    parts.push('\n## Alt text (per slide)\n');
    alt.forEach((slide) => parts.push(`- **${slide.index + 1}** (${slide.layout}): ${slide.alt}`));
  }
  parts.push('\n## Posting checklist\n');
  parts.push('- [ ] Upload PNGs in order (or the PDF for LinkedIn document posts)');
  parts.push('- [ ] Paste the caption exactly as written; keep line breaks');
  parts.push('- [ ] Pin the first comment if it carries the link');
  parts.push('- [ ] Reply to the first 10 comments within the first hour');
  return parts.join('\n');
}

export async function buildZip(input: BundleInput): Promise<Buffer> {
  const zip = new JSZip();
  const root = zip.folder(input.spec.id ?? 'carousel') ?? zip;

  for (const slide of input.slides) {
    root.file(`slides/${slide.filename}`, slide.png);
  }
  if (input.pdf) root.file(`${input.spec.id ?? 'carousel'}.pdf`, input.pdf);
  root.file('spec.json', JSON.stringify(input.spec, null, 2));
  root.file('caption.md', buildCaptionMarkdown(input));
  root.file('attribution.json', JSON.stringify({ generated_at: new Date(0).toISOString(), renderer: input.renderer, assets: input.attribution }, null, 2));
  root.file('manifest.json', JSON.stringify({
    generator: 'omni-carousel-agent',
    version: input.spec.version,
    platform: input.spec.platform,
    theme: input.theme.id,
    renderer: input.renderer,
    duration_ms: input.durationMs,
    slides: input.slides.map((s) => ({ index: s.index + 1, file: `slides/${s.filename}`, layout: s.layout, panorama: s.panorama ?? null })),
    warnings: input.warnings,
  }, null, 2));
  root.file('README.txt', [
    'omni-carousel-agent bundle',
    '=========================',
    '',
    'slides/        1080x1350 PNG slides, in posting order',
    '*.pdf          multi-page PDF for LinkedIn native document posts',
    'spec.json      the exact contract used to render these pixels',
    'caption.md     caption, hashtags, first comment, alt text, checklist',
    'attribution.json  licenses and credits for every external asset',
    'manifest.json  provenance: renderer, timing, warnings',
    '',
    'Re-render with: omni-carousel render spec.json --theme <id> --out <dir>',
  ].join('\n'));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
