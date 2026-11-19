/**
 * The render pipeline.
 *
 * spec + theme -> composed scenes (SVG) -> rasters -> PNG slides / panorama
 * slices / PDF pages / HTML deck / ZIP bundle. Both backends (native resvg and
 * optional Playwright) consume the exact same scenes, so switching renderers can
 * never change the design.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { fontFiles } from './fontmetrics.js';
import { lintSpec, type LintReport } from './lint.js';
import { buildZip, buildCaptionMarkdown, type AttributionRecord, type BundleInput } from './bundle.js';
import { buildDeckHtml, type DeckSlide } from './deck-html.js';
import { planPanorama, slicePanorama } from './panorama.js';
import { buildPdf } from './pdf.js';
import { captureWithPlaywright, playwrightAvailability } from './playwright.js';
import { drawSlide } from './layouts/index.js';
import {
  H, W, backgroundNodes, chromeNodes, panoramaBackground, type SlideContext,
} from './scene.js';
import { parseSpec, type CarouselSpec } from './schema.js';
import { sceneToSvg, translateScene, type Scene } from './svg.js';
import { loadTheme, resolvePalette, type Theme } from './themes.js';

export type RendererKind = 'auto' | 'resvg' | 'playwright';

export interface RenderOptions {
  /** Explicit output directory. When omitted a deterministic folder is derived from the spec. */
  outDir?: string;
  /** Root under which generated folders are created (defaults to OMNI_OUTPUT_DIR or ./carousels). */
  outputRoot?: string;
  renderer?: RendererKind;
  theme?: string;
  /** Skip the linter (not recommended; the CLI/MCP default keeps it on). */
  skipLint?: boolean;
  /** Throw instead of rendering when the linter reports errors. */
  strict?: boolean;
  /** Which artifacts to write. */
  formats?: Array<'png' | 'pdf' | 'zip' | 'html' | 'json' | 'caption' | 'attribution'>;
  /** Additional attribution entries (stock assets, brand-supplied art). */
  attribution?: AttributionRecord[];
  /** Suppress console noise (CLI prints its own summary). */
  quiet?: boolean;
}

export interface RenderedSlide {
  index: number;
  id: string;
  layout: string;
  filename: string;
  file: string;
  width: number;
  height: number;
  alt: string;
  panorama?: { spanLength: number; indexInSpan: number };
}

export interface RenderResult {
  spec: CarouselSpec;
  theme: Theme;
  dir: string;
  renderer: 'resvg' | 'playwright';
  slides: RenderedSlide[];
  files: {
    pdf?: string;
    zip?: string;
    html?: string;
    spec?: string;
    caption?: string;
    attribution?: string;
    manifest?: string;
  };
  lint: LintReport;
  warnings: string[];
  durationMs: number;
  /** PNG bytes kept in memory for tools that stream results (MCP preview). */
  buffers: Buffer[];
}

export interface ComposedSlide {
  index: number;
  scene: Scene;
  sceneWidth: number;
  panorama?: { spanStart: number; spanLength: number; indexInSpan: number };
  alt: string;
  layout: string;
  id: string;
  /** Viewbox offset used when a wide panorama scene is previewed as one frame. */
  portionX: number;
}

/** Builds one wide scene per panorama span, and one 1080-wide scene otherwise. */
export function composeScenes(spec: CarouselSpec, theme: Theme): { slides: ComposedSlide[]; errors: string[] } {
  const plan = planPanorama(spec.slides);
  const errors = [...plan.errors];
  const slides: ComposedSlide[] = [];
  const paletteOverride = spec.brand?.accent_override ? { accent: spec.brand.accent_override } : undefined;

  const makeContext = (
    index: number,
    panorama: { spanLength: number; indexInSpan: number } | undefined,
    canvasWidth: number,
    originX: number,
  ): SlideContext => {
    const slide = spec.slides[index];
    const accentSlide = slide.accent === true || (slide.layout === 'cta' && slide.accent !== false && !slide.bg);
    return {
      spec,
      slide,
      index,
      total: spec.slides.length,
      palette: resolvePalette(theme, slide.bg, accentSlide, paletteOverride),
      theme,
      panorama,
      canvasWidth,
      originX,
    };
  };

  for (let i = 0; i < spec.slides.length; i++) {
    const assignment = plan.assignments.get(i);
    if (assignment && assignment.indexInSpan !== 0) continue; // emitted with its span

    if (assignment) {
      const canvasWidth = W * assignment.spanLength;
      const firstCtx = makeContext(i, { spanLength: assignment.spanLength, indexInSpan: 0 }, canvasWidth, 0);
      const nodes = panoramaBackground(firstCtx, `pano-${firstCtx.spec.id ?? 'carousel'}-${i}`);
      const scene: Scene = { width: canvasWidth, height: H, nodes: [...nodes], background: firstCtx.palette.bg };

      for (let k = 0; k < assignment.spanLength; k++) {
        const slideIndex = i + k;
        const ctx = makeContext(slideIndex, { spanLength: assignment.spanLength, indexInSpan: k }, canvasWidth, k * W);
        // Per-slide art is translated onto the wide canvas; nothing is drawn twice.
        const local = [...chromeNodes(ctx), ...drawSlide(ctx)];
        scene.nodes.push(...translateScene(local, k * W, 0));
        slides.push({
          index: slideIndex,
          scene,
          sceneWidth: canvasWidth,
          panorama: { spanStart: i, spanLength: assignment.spanLength, indexInSpan: k },
          alt: spec.slides[slideIndex].alt_text ?? '',
          layout: spec.slides[slideIndex].layout,
          id: spec.slides[slideIndex].id ?? `slide-${String(slideIndex + 1).padStart(2, '0')}`,
          portionX: k * W,
        });
      }
      continue;
    }

    const ctx = makeContext(i, undefined, W, 0);
    const local = [...backgroundNodes(ctx), ...chromeNodes(ctx), ...drawSlide(ctx)];
    const scene: Scene = { width: W, height: H, nodes: local, background: ctx.palette.bg };
    slides.push({
      index: i,
      scene,
      sceneWidth: W,
      alt: spec.slides[i].alt_text ?? '',
      layout: spec.slides[i].layout,
      id: spec.slides[i].id ?? `slide-${String(i + 1).padStart(2, '0')}`,
      portionX: 0,
    });
  }
  return { slides, errors };
}

export function svgForSlide(slide: ComposedSlide): string {
  if (slide.sceneWidth === W) return sceneToSvg(slide.scene);
  return sceneToSvg(slide.scene, { x: slide.portionX, width: W, height: H });
}

/** Native raster path: resvg (Rust) with bundled OFL fonts, no browser involved. */
export function rasterizeScene(scene: Scene): Buffer {
  const svg = sceneToSvg(scene);
  const resvg = new Resvg(svg, {
    background: scene.background,
    font: {
      fontFiles: fontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
    fitTo: { mode: 'original' },
  });
  return Buffer.from(resvg.render().asPng());
}

export function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'carousel';
}

export function defaultOutputRoot(): string {
  return path.resolve(process.env.OMNI_OUTPUT_DIR ?? './carousels');
}

function uniqueDir(root: string, slug: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return path.join(root, `${slug}-${stamp}`);
}

export async function renderCarousel(input: unknown, options: RenderOptions = {}): Promise<RenderResult> {
  const started = Date.now();
  const spec = parseSpec(input);
  const theme = loadTheme(options.theme ?? spec.theme);
  const lint = options.skipLint
    ? { ok: true, issues: [], errors: [], warnings: [], infos: [], metrics: { slides: spec.slides.length, totalWords: 0, avgWordsPerSlide: 0, readingSeconds: 0, layouts: {}, contrastPairs: [] } }
    : lintSpec(spec, { theme });

  if (options.strict && !lint.ok) {
    const detail = lint.errors.map((e) => `${e.code} [${e.path}] ${e.message}`).join('\n');
    throw new Error(`Refusing to render: ${lint.errors.length} blocking lint error(s)\n${detail}`);
  }

  const warnings = [...lint.warnings.map((w) => `${w.code}: ${w.message}`)];
  const { slides: composed, errors } = composeScenes(spec, theme);
  warnings.push(...errors);

  // Choose backend.
  let renderer: 'resvg' | 'playwright' = 'resvg';
  if (options.renderer === 'playwright') {
    const availability = await playwrightAvailability();
    if (!availability.available) throw new Error(`Playwright backend requested but unavailable: ${availability.reason}`);
    renderer = 'playwright';
  } else if (options.renderer === 'auto' || options.renderer === undefined) {
    const availability = await playwrightAvailability();
    renderer = availability.available && process.env.OMNI_RENDERER === 'playwright' ? 'playwright' : 'resvg';
  }

  const formats = new Set(options.formats ?? ['png', 'pdf', 'zip', 'html', 'json', 'caption']);
  const slug = sanitizeSlug(spec.id ?? spec.title ?? `${spec.platform}-carousel`);
  const dir = options.outDir
    ? path.resolve(options.outDir)
    : uniqueDir(path.resolve(options.outputRoot ?? defaultOutputRoot()), slug);
  await fs.mkdir(path.join(dir, 'slides'), { recursive: true });

  // Rasterize: one pass per scene, then slice panorama spans with exact integer boxes.
  const pngBySlide = new Map<number, Buffer>();
  if (renderer === 'playwright') {
    const svgs = composed.map((slide) => svgForSlide(slide));
    const buffers = await captureWithPlaywright(svgs, { width: W, height: H });
    composed.forEach((slide, i) => pngBySlide.set(slide.index, buffers[i]));
  } else {
    const sceneCache = new Map<number, Buffer[]>();
    for (const slide of composed) {
      const key = slide.sceneWidth === W ? slide.index : (slide.panorama?.spanStart ?? slide.index);
      if (!sceneCache.has(key)) {
        const raster = rasterizeScene(slide.scene);
        if (slide.panorama) {
          const spanLength = slide.panorama?.spanLength ?? slide.scene.width / W;
          const tiles = await slicePanorama(raster, spanLength, W, H);
          sceneCache.set(key, tiles);
        } else {
          sceneCache.set(key, [raster]);
        }
      }
      const tiles = sceneCache.get(key)!;
      const tileIndex = slide.panorama?.indexInSpan ?? 0;
      const png = tiles[tileIndex] ?? tiles[0];
      pngBySlide.set(slide.index, await sharp(png).resize(W, H, { fit: 'fill' }).png({ compressionLevel: 9 }).toBuffer());
    }
  }

  const renderedSlides: RenderedSlide[] = [];
  const buffers: Buffer[] = [];
  const bundleSlides: BundleInput['slides'] = [];
  for (const slide of composed) {
    const filename = `slide-${String(slide.index + 1).padStart(2, '0')}.png`;
    const png = pngBySlide.get(slide.index)!;
    const file = path.join(dir, 'slides', filename);
    if (formats.has('png')) await fs.writeFile(file, png);
    buffers.push(png);
    renderedSlides.push({
      index: slide.index,
      id: slide.id,
      layout: slide.layout,
      filename,
      file,
      width: W,
      height: H,
      alt: slide.alt,
      panorama: slide.panorama ? { spanLength: slide.panorama.spanLength, indexInSpan: slide.panorama.indexInSpan } : undefined,
    });
    bundleSlides.push({
      index: slide.index,
      filename,
      png,
      layout: slide.layout,
      alt: slide.alt,
      panorama: slide.panorama ? { spanLength: slide.panorama.spanLength, indexInSpan: slide.panorama.indexInSpan } : undefined,
    });
  }

  const files: RenderResult['files'] = {};
  let pdfBuffer: Buffer | undefined;

  if (formats.has('pdf')) {
    const pdf = await buildPdf(buffers, {
      title: spec.title ?? spec.id ?? 'Carousel',
      author: spec.brand?.name ?? spec.meta.author ?? 'omni-carousel-agent',
      subject: `${spec.platform} carousel — ${spec.slides.length} pages`,
      keywords: spec.caption?.hashtags ?? [],
    });
    files.pdf = path.join(dir, `${slug}.pdf`);
    await fs.writeFile(files.pdf, pdf);
    pdfBuffer = pdf;
  }

  const caption = {
    caption: spec.caption?.text ?? '',
    hashtags: spec.caption?.hashtags ?? [],
    firstComment: spec.caption?.first_comment,
    ctaLink: spec.cta_link,
  };

  const attribution: AttributionRecord[] = [
    ...(options.attribution ?? []),
    ...themeFontsAttribution(theme),
  ];

  if (formats.has('caption')) {
    files.caption = path.join(dir, 'caption.md');
    await fs.writeFile(files.caption, buildCaptionMarkdown({
      spec, theme, slides: bundleSlides, caption, attribution, warnings, renderer, durationMs: Date.now() - started,
    }));
  }
  if (formats.has('json')) {
    files.spec = path.join(dir, 'spec.json');
    await fs.writeFile(files.spec, JSON.stringify(spec, null, 2));
  }
  files.attribution = path.join(dir, 'attribution.json');
  await fs.writeFile(files.attribution, JSON.stringify({ assets: attribution }, null, 2));
  if (formats.has('html')) {
    const deckSlides: DeckSlide[] = composed.map((slide) => ({
      index: slide.index,
      svg: svgForSlide(slide),
      alt: slide.alt,
      layout: slide.layout,
      panorama: slide.panorama ? { spanLength: slide.panorama.spanLength, indexInSpan: slide.panorama.indexInSpan } : undefined,
    }));
    files.html = path.join(dir, 'deck.html');
    await fs.writeFile(files.html, buildDeckHtml({
      spec, theme, slides: deckSlides, caption: caption.caption, hashtags: caption.hashtags,
    }));
  }

  const manifest = {
    generator: 'omni-carousel-agent',
    engine: '0.1.0',
    renderer,
    platform: spec.platform,
    theme: theme.id,
    canvas: { width: W, height: H },
    slides: renderedSlides.map((s) => ({ index: s.index + 1, id: s.id, layout: s.layout, file: `slides/${s.filename}`, panorama: s.panorama ?? null })),
    lint: { ok: lint.ok, errors: lint.errors.length, warnings: lint.warnings.length },
    warnings,
    duration_ms: Date.now() - started,
  };
  files.manifest = path.join(dir, 'manifest.json');
  await fs.writeFile(files.manifest, JSON.stringify(manifest, null, 2));

  if (formats.has('zip')) {
    const zip = await buildZip({
      spec, theme, slides: bundleSlides,
      pdf: pdfBuffer,
      caption, attribution, warnings, renderer, durationMs: Date.now() - started,
    });
    files.zip = path.join(dir, `${slug}.zip`);
    await fs.writeFile(files.zip, zip);
  }

  if (!options.quiet) {
    warnings.forEach((warning) => console.error(`warn: ${warning}`));
  }

  return {
    spec, theme, dir, renderer, slides: renderedSlides, files, lint, warnings,
    durationMs: Date.now() - started, buffers,
  };
}

function themeFontsAttribution(theme: Theme): AttributionRecord[] {
  const fonts = new Set([theme.typography.display_font, theme.typography.body_font, theme.typography.mono_font]);
  return Array.from(fonts).map((font) => ({
    provider: 'engine' as const,
    asset: font,
    license: 'SIL Open Font License 1.1',
    source_url: 'https://github.com/google/fonts',
  }));
}

/** Renders a single slide in-memory (used by `preview_slide`). */
export async function renderSlidePreview(
  input: unknown,
  index: number,
  opts: { theme?: string; format?: 'png' | 'svg' } = {},
): Promise<{ png?: Buffer; svg: string; slide: ComposedSlide; theme: Theme }> {
  const spec = parseSpec(input);
  const theme = loadTheme(opts.theme ?? spec.theme);
  const { slides } = composeScenes(spec, theme);
  const slide = slides[index];
  if (!slide) throw new Error(`Slide index ${index} out of range (0-${slides.length - 1})`);
  const svg = svgForSlide(slide);
  if (opts.format === 'svg') return { svg, slide, theme };
  const raster = rasterizeScene(slide.scene);
  if (slide.sceneWidth === W) {
    return { png: await sharp(raster).png().toBuffer(), svg, slide, theme };
  }
  const tiles = await slicePanorama(raster, slide.panorama?.spanLength ?? slide.scene.width / W, W, H);
  return { png: tiles[slide.panorama?.indexInSpan ?? 0], svg, slide, theme };
}
