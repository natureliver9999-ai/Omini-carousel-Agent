/**
 * Local runner: executes a tool call in-process against the engine.
 *
 * This is how an app skips MCP entirely — no subprocess, no HTTP, no schema
 * drift, because the runner and the MCP server call the same engine functions.
 */
import path from 'node:path';
import {
  buildFullPlaybook,
  buildPlaybook,
  defaultOutputRoot,
  fetchAsset,
  formatLintReport,
  lintSpec,
  listThemes,
  LAYOUT_META,
  ICON_NAMES,
  renderCarousel,
  renderChartPng,
  renderChartSvg,
  renderDiagramSvg,
  renderSlidePreview,
  sanitizeSlug,
} from '@omni-carousel/engine';
import type { PlaybookTopic } from '@omni-carousel/engine';
import { ToolInputs, type ToolName } from './schemas.js';

export interface ToolResult {
  text: string;
  /** PNG payloads, when the tool produced images. */
  images?: Array<{ base64: string; mimeType: string }>;
  data?: unknown;
  isError?: boolean;
}

export interface RunOptions {
  /** Where renders and assets are written. Defaults to $OMNI_OUTPUT_DIR or ./carousels. */
  outputDir?: string;
  /** Base URL for `output_mode: "url"` (only meaningful when you serve /files yourself). */
  publicUrl?: string;
  /** Quiet mode for library use. Defaults to true. */
  quiet?: boolean;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

export async function runTool(name: ToolName, input: unknown, options: RunOptions = {}): Promise<ToolResult> {
  const schema = ToolInputs[name];
  if (!schema) return { text: `Unknown tool "${String(name)}"`, isError: true };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      text: `Invalid arguments for ${name}:\n${parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')}`,
      isError: true,
    };
  }
  const args = parsed.data as Record<string, unknown>;
  const root = options.outputDir ?? defaultOutputRoot();

  switch (name) {
    case 'get_playbook': {
      const topic = (args.topic as PlaybookTopic | 'all' | undefined) ?? 'all';
      return { text: topic === 'all' ? buildFullPlaybook() : buildPlaybook(topic as PlaybookTopic) };
    }
    case 'list_layouts': {
      return {
        text: json({ layouts: Object.entries(LAYOUT_META).map(([id, meta]) => ({ id, ...meta })), icons: ICON_NAMES }),
        data: LAYOUT_META,
      };
    }
    case 'list_themes': {
      const themes = listThemes();
      return { text: json({ themes }), data: themes };
    }
    case 'validate_spec': {
      const report = lintSpec(args.spec);
      return {
        text: `${formatLintReport(report)}\n\n${json({ ok: report.ok, errors: report.errors, warnings: report.warnings, metrics: report.metrics })}`,
        data: report,
      };
    }
    case 'render_carousel': {
      const result = await renderCarousel(args.spec, {
        theme: args.theme as string | undefined,
        formats: args.formats as Array<'png' | 'pdf' | 'zip' | 'html' | 'json' | 'caption'> | undefined,
        strict: args.strict as boolean | undefined,
        outputRoot: root,
        quiet: options.quiet ?? true,
      });
      const summary = {
        ok: result.lint.ok,
        renderer: result.renderer,
        duration_ms: result.durationMs,
        dir: result.dir,
        slides: result.slides.map((slide) => ({ index: slide.index, layout: slide.layout, file: `slides/${slide.filename}` })),
        files: Object.fromEntries(Object.entries(result.files).filter(([, value]) => Boolean(value))),
        warnings: result.warnings,
        caption: result.spec.caption?.text ?? '',
      };
      const images = (args.output_mode as string | undefined) === 'inline'
        ? result.buffers.map((buffer) => ({ base64: buffer.toString('base64'), mimeType: 'image/png' }))
        : undefined;
      return { text: json(summary), images, data: summary };
    }
    case 'preview_slide': {
      const preview = await renderSlidePreview(args.spec, args.slide_index as number, { theme: args.theme as string | undefined });
      return {
        text: json({ slide_index: args.slide_index, layout: preview.slide.layout, width: 1080, height: 1350 }),
        images: [{ base64: preview.png!.toString('base64'), mimeType: 'image/png' }],
      };
    }
    case 'fetch_asset': {
      const asset = await fetchAsset({
        provider: args.provider as 'unsplash' | 'pexels' | 'pattern' | undefined,
        query: args.query as string | undefined,
        width: args.width as number | undefined,
        height: args.height as number | undefined,
        accent: args.accent as string | undefined,
        background: args.background as string | undefined,
      });
      return {
        text: json({
          provider: asset.provider,
          kind: asset.kind,
          width: asset.width,
          height: asset.height,
          alt: asset.alt,
          attribution: asset.attribution,
          note: asset.note,
          saved_to: path.join(root, 'assets', `${sanitizeSlug(asset.attribution.asset)}.${asset.data_uri?.startsWith('data:image/svg+xml') ? 'svg' : 'jpg'}`),
        }),
        data: asset.attribution,
      };
    }
    case 'make_chart': {
      const theme = args.theme as string | undefined;
      const width = args.width as number | undefined;
      const height = args.height as number | undefined;
      const title = args.title as string | undefined;
      const svg = renderChartSvg(args.chart as never, { theme, width, height, title });
      const png = renderChartPng(args.chart as never, { theme, width, height, title });
      return { text: json({ bytes: png.length, svg }), images: [{ base64: png.toString('base64'), mimeType: 'image/png' }] };
    }
    case 'make_diagram': {
      const svg = renderDiagramSvg(args.source as string, {
        theme: args.theme as string | undefined,
        direction: args.direction as 'TD' | 'LR' | undefined,
        title: args.title as string | undefined,
      });
      return { text: svg };
    }
    default:
      return { text: `Unhandled tool ${String(name)}`, isError: true };
  }
}
