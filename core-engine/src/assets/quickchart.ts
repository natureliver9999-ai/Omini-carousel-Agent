/**
 * Standalone chart rendering (the offline half of `make_chart`).
 *
 * The engine can always draw a chart from numbers using its own SVG charts, so a
 * host never depends on a third-party image service. When `remote` is requested
 * and the network permits it, QuickChart's public API is used through the SSRF
 * guard — but it is strictly optional.
 */
import { Resvg } from '@resvg/resvg-js';
import { fontFiles } from '../fontmetrics.js';
import { drawChart } from '../charts.js';
import { CarouselSpecSchema, type ChartSchema } from '../schema.js';
import { loadTheme, resolvePalette } from '../themes.js';
import type { z } from 'zod';

export type ChartInput = z.infer<typeof ChartSchema>;

export interface ChartRenderOptions {
  theme?: string;
  width?: number;
  height?: number;
  title?: string;
  background?: string;
}

export function renderChartSvg(chart: ChartInput, options: ChartRenderOptions = {}): string {
  const theme = loadTheme(options.theme ?? 'editorial');
  const palette = resolvePalette(theme);
  const width = options.width ?? 1000;
  const height = options.height ?? 600;
  const nodes = drawChart(chart, {
    palette,
    theme,
    box: { x: 40, y: 40, w: width - 80, h: height - 80 },
  });
  const title = options.title
    ? `<text x="40" y="34" font-family="${theme.typography.body_font}" font-size="20" font-weight="700" fill="${palette.textMuted}">${escapeXml(options.title.toUpperCase())}</text>`
    : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${options.background ?? palette.bg}"/>`,
    title,
    nodes.map((node) => (node.type === 'text'
      ? `<text x="${node.x}" y="${node.y}" font-family="${node.family}" font-size="${node.size}" font-weight="${node.weight ?? 400}" fill="${node.fill}" text-anchor="${node.anchor ?? 'start'}">${escapeXml(node.text)}</text>`
      : node.type === 'rect'
        ? `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" fill="${node.fill}" rx="${node.rx ?? 0}"/>`
        : node.type === 'circle'
          ? `<circle cx="${node.cx}" cy="${node.cy}" r="${node.r}" fill="${node.fill}"/>`
          : node.type === 'path'
            ? `<path d="${node.d}" fill="${node.fill ?? 'none'}" stroke="${node.stroke ?? 'none'}" stroke-width="${node.strokeWidth ?? 0}"/>`
            : '')).join(''),
    '</svg>',
  ].join('');
}

export function renderChartPng(chart: ChartInput, options: ChartRenderOptions = {}): Buffer {
  const svg = renderChartSvg(chart, options);
  const resvg = new Resvg(svg, {
    font: { fontFiles: fontFiles(), loadSystemFonts: false, defaultFontFamily: 'Inter' },
    fitTo: { mode: 'original' },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Validates a chart payload against the same schema the slides use. */
export function parseChart(input: unknown): ChartInput {
  const spec = CarouselSpecSchema.parse({
    platform: 'generic',
    slides: [
      { layout: 'data_chart', headline: 'Chart', chart: input, source: 'inline' },
      { layout: 'cta', action: 'save', text: 'Save' },
    ],
  });
  const slide = spec.slides[0];
  if (slide.layout !== 'data_chart') throw new Error('unreachable');
  return slide.chart;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
