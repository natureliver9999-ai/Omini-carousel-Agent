/**
 * Tool input schemas — the single source for Anthropic, OpenAI and Vercel tool
 * definitions. They intentionally mirror the MCP server's `inputSchema` shapes so
 * a model cannot tell which transport it is talking to.
 */
import { z } from 'zod';
import { CarouselSpecSchema, ChartSchema } from '@omni-carousel/engine';

export const TOOL_DESCRIPTIONS = {
  get_playbook: 'Read the carousel craft rules for a platform (slide counts, copy limits, patterns, hooks). Always call before planning a deck.',
  list_layouts: 'List the 11 typed slide layouts with role, density and copy budget, plus valid icon names.',
  list_themes: 'List the bundled WCAG-audited themes with accents and measured contrast.',
  validate_spec: 'Validate and lint a CarouselSpec: retention backbone, copy budgets, clichés, alternation, panorama geometry, contrast, provenance.',
  render_carousel: 'Render a validated CarouselSpec to 1080x1350 PNG slides, a multi-page PDF, an HTML deck and a ZIP bundle with caption and provenance.',
  preview_slide: 'Render one slide of a deck as an image, without writing a full bundle.',
  fetch_asset: 'Fetch license-tracked stock photography or generate deterministic theme-native art offline. SSRF-guarded.',
  make_chart: 'Draw a bar, horizontal bar, line or donut chart from explicit numbers; returns a PNG path and the SVG.',
  make_diagram: 'Render a Mermaid-style flow diagram as theme-aware SVG. Offline, no browser.',
} as const;

export const ToolInputs = {
  get_playbook: z.object({
    topic: z.enum(['instagram', 'linkedin', 'hooks', 'patterns', 'layouts', 'all']).optional(),
  }),
  list_layouts: z.object({}),
  list_themes: z.object({}),
  validate_spec: z.object({
    spec: CarouselSpecSchema,
  }),
  render_carousel: z.object({
    spec: CarouselSpecSchema,
    output_mode: z.enum(['path', 'url', 'inline']).optional(),
    theme: z.string().optional(),
    formats: z.array(z.enum(['png', 'pdf', 'zip', 'html', 'json', 'caption'])).optional(),
    strict: z.boolean().optional(),
  }),
  preview_slide: z.object({
    spec: CarouselSpecSchema,
    slide_index: z.number().int().min(0),
    theme: z.string().optional(),
  }),
  fetch_asset: z.object({
    provider: z.enum(['unsplash', 'pexels', 'pattern']).optional(),
    query: z.string().max(120).optional(),
    width: z.number().int().min(200).max(2400).optional(),
    height: z.number().int().min(200).max(2400).optional(),
    accent: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
    background: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  }),
  make_chart: z.object({
    chart: ChartSchema,
    theme: z.string().optional(),
    width: z.number().int().min(320).max(2000).optional(),
    height: z.number().int().min(240).max(2000).optional(),
    title: z.string().max(80).optional(),
  }),
  make_diagram: z.object({
    source: z.string().min(3).max(4000),
    theme: z.string().optional(),
    direction: z.enum(['TD', 'LR']).optional(),
    title: z.string().max(80).optional(),
    save: z.boolean().optional(),
  }),
} as const;

export type ToolName = keyof typeof ToolInputs;
export const TOOL_NAMES = Object.keys(ToolInputs) as ToolName[];
