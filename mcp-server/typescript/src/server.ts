/**
 * The MCP surface: 9 tools, 3 resources, 1 prompt.
 *
 * Everything here is a thin, typed wrapper over `@omni-carousel/engine`. No
 * design decisions are made in the server — the agent plans, the engine renders,
 * and the linter is the judge both of them answer to.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  CarouselSpecSchema,
  ChartSchema,
  ICON_NAMES,
  LAYOUT_META,
  auditThemeContrast,
  buildFullPlaybook,
  buildPlaybook,
  defaultOutputRoot,
  fetchAsset,
  formatLintReport,
  lintSpec,
  listThemes,
  loadTheme,
  PLAYBOOK_TOPICS,
  registerArtifact,
  renderCarousel,
  renderChartPng,
  renderChartSvg,
  renderDiagramSvg,
  renderSlidePreview,
  sanitizeSlug,
  signedFileUrl,
} from '@omni-carousel/engine';
import type { PlaybookTopic, RenderResult } from '@omni-carousel/engine';

export const SERVER_NAME = 'omni-carousel';
export const SERVER_VERSION = '0.1.0';

export interface ServerOptions {
  /** Base URL used to mint `output_mode: "url"` links. */
  publicUrl?: string;
  outputRoot?: string;
  /** Default signed-link lifetime. */
  urlTtlSeconds?: number;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

function artifactUrls(result: RenderResult, publicUrl: string, ttl: number) {
  const record = registerArtifact(result.dir, [
    ...result.slides.map((slide) => `slides/${slide.filename}`),
    ...Object.values(result.files).filter((file): file is string => Boolean(file)),
  ]);
  const rel = (file?: string) => (file ? path.relative(result.dir, file).split(path.sep).join('/') : undefined);
  return {
    artifact_id: record.id,
    slides: result.slides.map((slide) => ({
      index: slide.index,
      width: slide.width,
      height: slide.height,
      layout: slide.layout,
      url: signedFileUrl({ baseUrl: publicUrl, artifactId: record.id, relativePath: `slides/${slide.filename}`, ttlSeconds: ttl }),
    })),
    files: {
      pdf: rel(result.files.pdf) && signedFileUrl({ baseUrl: publicUrl, artifactId: record.id, relativePath: rel(result.files.pdf)!, ttlSeconds: ttl }),
      zip: rel(result.files.zip) && signedFileUrl({ baseUrl: publicUrl, artifactId: record.id, relativePath: rel(result.files.zip)!, ttlSeconds: ttl }),
      html: rel(result.files.html) && signedFileUrl({ baseUrl: publicUrl, artifactId: record.id, relativePath: rel(result.files.html)!, ttlSeconds: ttl }),
      spec: rel(result.files.spec) && signedFileUrl({ baseUrl: publicUrl, artifactId: record.id, relativePath: rel(result.files.spec)!, ttlSeconds: ttl }),
      caption: rel(result.files.caption) && signedFileUrl({ baseUrl: publicUrl, artifactId: record.id, relativePath: rel(result.files.caption)!, ttlSeconds: ttl }),
    },
    expires_in_seconds: ttl,
  };
}

export function createOmniServer(options: ServerOptions = {}): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: 'Omni Carousel' },
    {
      instructions: [
        'Omni Carousel turns a topic into a publish-ready carousel: 1080x1350 Instagram PNG slides, a multi-page LinkedIn PDF, a seamless panorama, and a caption pack.',
        '',
        'Workflow:',
        '1. get_playbook({ topic }) for the platform rules (always before planning).',
        '2. Plan the deck as a CarouselSpec: 7-10 slides for Instagram, 5-10 pages for LinkedIn, cover_hook first, cta last.',
        '3. validate_spec({ spec }) and fix every error before rendering.',
        '4. render_carousel({ spec }) and return the links/paths plus the caption.',
        '',
        'Never invent statistics, quotes, or case studies. A proof or data_chart slide requires a named source.',
      ].join('\n'),
    },
  );

  /* ------------------------------------------------------------------ tools */

  server.registerTool(
    'get_playbook',
    {
      title: 'Get the carousel playbook',
      description:
        'Returns the craft rules for a platform (Instagram, LinkedIn), the hook library, the six viral patterns, or the layout reference. Read this before planning a deck.',
      inputSchema: {
        topic: z.enum(['instagram', 'linkedin', 'hooks', 'patterns', 'layouts', 'all']).optional()
          .describe('Which chapter to load. Defaults to `all` (concise index + both platforms).'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ topic }) => {
      const markdown = !topic || topic === 'all'
        ? `${buildPlaybook('index')}\n\n---\n\n${buildPlaybook('instagram')}\n\n---\n\n${buildPlaybook('linkedin')}\n\n---\n\n${buildPlaybook('patterns')}\n\n---\n\n${buildPlaybook('hooks')}`
        : buildPlaybook(topic as PlaybookTopic);
      return { content: [{ type: 'text', text: markdown }] };
    },
  );

  server.registerTool(
    'list_layouts',
    {
      title: 'List slide layouts',
      description: 'The 11 typed slide layouts, their role, visual density, copy budget and when to use each. Also returns the available icon names.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => ({
      content: [{
        type: 'text',
        text: json({
          layouts: Object.entries(LAYOUT_META).map(([id, meta]) => ({ id, ...meta })),
          icons: ICON_NAMES,
        }),
      }],
    }),
  );

  server.registerTool(
    'list_themes',
    {
      title: 'List themes',
      description: 'The bundled, WCAG-audited themes with their accent colours and measured contrast ratios.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const themes = listThemes().map((theme) => {
        const audit = auditThemeContrast(loadTheme(theme.id));
        return {
          ...theme,
          contrast: {
            min: Math.min(...audit.map((a) => a.ratio)),
            failing: audit.filter((a) => !a.pass).map((a) => a.pair),
          },
        };
      });
      return { content: [{ type: 'text', text: json({ themes }) }] };
    },
  );

  server.registerTool(
    'validate_spec',
    {
      title: 'Validate and lint a CarouselSpec',
      description:
        'Schema-validate and lint a deck before rendering: slide-count pacing, retention backbone, copy budgets, cliché language, layout alternation, panorama geometry, WCAG contrast and provenance.',
      inputSchema: {
        spec: CarouselSpecSchema.describe('The CarouselSpec to validate.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ spec }) => {
      const report = lintSpec(spec);
      return {
        content: [
          { type: 'text', text: formatLintReport(report) },
          { type: 'text', text: json({ ok: report.ok, errors: report.errors, warnings: report.warnings, infos: report.infos, metrics: report.metrics }) },
        ],
        isError: false,
      };
    },
  );

  server.registerTool(
    'render_carousel',
    {
      title: 'Render a carousel',
      description:
        'Renders a validated CarouselSpec to 1080x1350 PNG slides, a multi-page PDF, a printable HTML deck and a ZIP bundle with caption + provenance. `output_mode` chooses how artifacts are returned: `path` (server filesystem), `url` (signed expiring links, for remote hosts), or `inline` (image bytes for small decks).',
      inputSchema: {
        spec: CarouselSpecSchema.describe('The CarouselSpec to render.'),
        output_mode: z.enum(['path', 'url', 'inline']).optional().describe('Default `path`.'),
        theme: z.string().optional().describe('Theme id override.'),
        formats: z.array(z.enum(['png', 'pdf', 'zip', 'html', 'json', 'caption'])).optional().describe('Artifacts to write. Default: all.'),
        strict: z.boolean().optional().describe('Refuse to render when the linter reports errors (recommended).'),
        max_inline_slides: z.number().int().min(1).max(20).optional().describe('Cap for `inline` mode. Default 10.'),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ spec, output_mode = 'path', theme, formats, strict, max_inline_slides }) => {
      const result = await renderCarousel(spec, {
        theme,
        formats,
        strict,
        quiet: true,
        outputRoot: options.outputRoot ?? defaultOutputRoot(),
      });
      const summary = {
        ok: result.lint.ok,
        renderer: result.renderer,
        duration_ms: result.durationMs,
        dir: result.dir,
        slides: result.slides.map((slide) => ({
          index: slide.index, layout: slide.layout, file: `slides/${slide.filename}`,
          width: slide.width, height: slide.height, panorama: slide.panorama ?? null,
        })),
        files: Object.fromEntries(Object.entries(result.files).filter(([, value]) => Boolean(value))),
        warnings: result.warnings,
        lint: { ok: result.lint.ok, errors: result.lint.errors, warnings_count: result.lint.warnings.length },
        caption: result.spec.caption?.text ?? '',
        caption_markdown_file: result.files.caption,
      };

      if (output_mode === 'inline') {
        const limit = max_inline_slides ?? 10;
        const images = result.buffers.slice(0, limit).map((buffer, index) => ({
          type: 'image' as const,
          data: buffer.toString('base64'),
          mimeType: 'image/png',
        }));
        return {
          content: [
            { type: 'text', text: json(summary) },
            ...images,
            ...(result.buffers.length > limit
              ? [{ type: 'text' as const, text: `Returned the first ${limit} of ${result.buffers.length} slides to stay under host image limits.` }]
              : []),
          ],
        };
      }

      if (output_mode === 'url') {
        const publicUrl = options.publicUrl ?? process.env.OMNI_PUBLIC_URL;
        if (!publicUrl) {
          return {
            content: [{
              type: 'text',
              text: json({
                ...summary,
                error: 'output_mode "url" requires OMNI_PUBLIC_URL (or run the server with --http so it can serve /files itself).',
              }),
            }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: json({ ...summary, urls: artifactUrls(result, publicUrl, options.urlTtlSeconds ?? 3600) }) }],
        };
      }

      return { content: [{ type: 'text', text: json(summary) }] };
    },
  );

  server.registerTool(
    'preview_slide',
    {
      title: 'Preview one slide',
      description: 'Renders a single slide of a deck as an image, without writing a full bundle. Use it to check a hook or a dense frame quickly.',
      inputSchema: {
        spec: CarouselSpecSchema,
        slide_index: z.number().int().min(0).describe('0-based slide index.'),
        theme: z.string().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ spec, slide_index, theme }) => {
      const preview = await renderSlidePreview(spec, slide_index, { theme });
      return {
        content: [
          { type: 'text', text: json({ slide_index, layout: preview.slide.layout, width: 1080, height: 1350 }) },
          { type: 'image', data: preview.png!.toString('base64'), mimeType: 'image/png' },
        ],
      };
    },
  );

  server.registerTool(
    'fetch_asset',
    {
      title: 'Fetch a license-tracked asset',
      description:
        'Fetches stock photography (Unsplash/Pexels, when API keys are configured) or generates deterministic theme-native art offline. Returns a local file path, dimensions and the attribution record that must ship with the deck. SSRF-guarded; never scrapes arbitrary URLs.',
      inputSchema: {
        provider: z.enum(['unsplash', 'pexels', 'pattern']).optional().describe('Defaults to `pattern` (offline, no key needed).'),
        query: z.string().max(120).optional().describe('Search term or seed for generated art.'),
        id: z.string().max(80).optional(),
        width: z.number().int().min(200).max(2400).optional(),
        height: z.number().int().min(200).max(2400).optional(),
        accent: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional().describe('Accent colour for generated art.'),
        background: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
        inline: z.boolean().optional().describe('Include base64 bytes in the response (small assets only).'),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ provider, query, id, width, height, accent, background, inline }) => {
      const asset = await fetchAsset({ provider, query, id, width, height, accent, background });
      const root = path.join(options.outputRoot ?? defaultOutputRoot(), 'assets');
      await fsp.mkdir(root, { recursive: true });
      const mime = asset.data_uri?.slice(5, asset.data_uri.indexOf(';')) ?? 'application/octet-stream';
      const ext = mime === 'image/svg+xml' ? 'svg' : 'jpg';
      const file = path.join(root, `${sanitizeSlug(query ?? 'asset')}-${Date.now().toString(36)}.${ext}`);
      const base64 = asset.data_uri?.split(',')[1] ?? '';
      if (base64) await fsp.writeFile(file, Buffer.from(base64, 'base64'));

      const payload = {
        provider: asset.provider,
        kind: asset.kind,
        file,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        attribution: asset.attribution,
        note: asset.note,
      };
      return {
        content: [
          { type: 'text' as const, text: json(payload) },
          ...(inline && base64
            ? [{ type: 'image' as const, data: base64, mimeType: mime }]
            : []),
        ],
      };
    },
  );

  server.registerTool(
    'make_chart',
    {
      title: 'Render a standalone chart',
      description:
        'Draws a bar, horizontal bar, line or donut chart from explicit numbers and returns a PNG path plus the SVG. Deterministic and offline — no third-party chart service.',
      inputSchema: {
        chart: ChartSchema,
        theme: z.string().optional(),
        width: z.number().int().min(320).max(2000).optional(),
        height: z.number().int().min(240).max(2000).optional(),
        title: z.string().max(80).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ chart, theme, width, height, title }) => {
      const svg = renderChartSvg(chart, { theme, width, height, title });
      const png = renderChartPng(chart, { theme, width, height, title });
      const root = path.join(options.outputRoot ?? defaultOutputRoot(), 'charts');
      await fsp.mkdir(root, { recursive: true });
      const file = path.join(root, `chart-${Date.now().toString(36)}.png`);
      await fsp.writeFile(file, png);
      return { content: [{ type: 'text', text: json({ file, width: width ?? 1000, height: height ?? 600, svg }) }] };
    },
  );

  server.registerTool(
    'make_diagram',
    {
      title: 'Render a Mermaid-style diagram',
      description:
        'Renders a small flow or system diagram from Mermaid-like source (flowchart TD/LR, `A[Label] --> B[Label]`, optional edge labels) as theme-aware SVG. Offline, no Mermaid CDN or browser needed.',
      inputSchema: {
        source: z.string().min(3).max(4000).describe('Mermaid-style source, e.g. "flowchart LR\\nA[Intent] --> B[Spec]".'),
        theme: z.string().optional(),
        direction: z.enum(['TD', 'LR']).optional(),
        title: z.string().max(80).optional(),
        save: z.boolean().optional().describe('Write the SVG to the output directory and return the path.'),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ source, theme, direction, title, save }) => {
      const svg = renderDiagramSvg(source, { theme, direction, title });
      if (!save) return { content: [{ type: 'text', text: svg }] };
      const root = path.join(options.outputRoot ?? defaultOutputRoot(), 'diagrams');
      await fsp.mkdir(root, { recursive: true });
      const file = path.join(root, `diagram-${Date.now().toString(36)}.svg`);
      await fsp.writeFile(file, svg);
      return { content: [{ type: 'text', text: json({ file, bytes: svg.length }) }] };
    },
  );

  /* -------------------------------------------------------------- resources */

  server.registerResource(
    'playbook',
    'carousel://playbook',
    { title: 'Carousel playbook', description: 'Full craft rules: platforms, patterns, hooks, layouts.', mimeType: 'text/markdown' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: buildFullPlaybook() }],
    }),
  );

  server.registerResource(
    'schema',
    'carousel://schema.json',
    { title: 'CarouselSpec JSON Schema', description: 'JSON Schema 2020-12 for the carousel contract.', mimeType: 'application/schema+json' },
    async (uri) => {
      const candidates = [
        path.resolve(process.cwd(), 'spec/carousel.schema.json'),
        path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../spec/carousel.schema.json'),
        path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../spec/carousel.schema.json'),
      ];
      const file = candidates.find((candidate) => fs.existsSync(candidate));
      const text = file
        ? await fsp.readFile(file, 'utf8')
        : json({ note: 'schema file not found next to the server; see carousel://playbook/layouts', layouts: Object.keys(LAYOUT_META) });
      return { contents: [{ uri: uri.href, mimeType: 'application/schema+json', text }] };
    },
  );

  server.registerResource(
    'theme',
    new ResourceTemplate('carousel://themes/{id}', {
      list: async () => ({
        resources: listThemes().map((theme) => ({
          uri: `carousel://themes/${theme.id}`,
          name: theme.name,
          description: theme.description,
          mimeType: 'application/json',
        })),
      }),
    }),
    { title: 'Theme tokens', description: 'One theme as raw JSON tokens, including contrast measurements.', mimeType: 'application/json' },
    async (uri, variables) => {
      const id = String((variables as Record<string, unknown>).id ?? 'editorial');
      const theme = loadTheme(id);
      const audit = auditThemeContrast(theme);
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: json({ ...theme, contrast: audit }),
        }],
      };
    },
  );

  /* ----------------------------------------------------------------- prompt */

  server.registerPrompt(
    'create_carousel',
    {
      title: 'Create a carousel',
      description: 'Draft, validate and render a carousel for a topic on a given platform.',
      argsSchema: {
        topic: z.string().describe('What the carousel is about.'),
        platform: z.enum(['instagram', 'linkedin']).describe('Target platform.'),
        goal: z.enum(['awareness', 'saves', 'authority', 'leads', 'community']).optional(),
      },
    },
    ({ topic, platform, goal }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Create a ${platform} carousel about: ${topic}`,
              goal ? `Primary goal: ${goal}.` : '',
              '',
              'Process:',
              `1. Call get_playbook({ topic: "${platform}" }) and follow it exactly.`,
              '2. Draft a CarouselSpec: cover_hook first, cta last, 7-10 slides (Instagram) or 5-10 pages (LinkedIn).',
              '3. Call validate_spec and fix every error. Do not render with errors outstanding.',
              '4. Call render_carousel with output_mode "url" or "path", then present the slides and the caption.',
              '',
              'Hard rules: no invented statistics or quotes; proof and data_chart slides need a named source; one CTA only.',
            ].filter(Boolean).join('\n'),
          },
        },
      ],
    }),
  );

  return server;
}

export { PLAYBOOK_TOPICS };
