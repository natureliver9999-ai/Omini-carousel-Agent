/**
 * Deterministic SVG chart renderer.
 *
 * Charts are drawn from the numbers in the spec, never from an external chart
 * API, so a rendered slide can always be re-derived from its JSON (and a golden
 * test can assert pixel equality).
 */
import { withAlpha } from './colors.js';
import { circle, path, rect, text, type Node } from './svg.js';
import { oneLine, textWidth, truncateToWidth, type FontSpec } from './text.js';
import type { ResolvedPalette, Theme } from './themes.js';
import type { z } from 'zod';
import type { ChartSchema } from './schema.js';

export type Chart = z.infer<typeof ChartSchema>;

export interface ChartBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ChartDeps {
  palette: ResolvedPalette;
  theme: Theme;
  box: ChartBox;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const scaled = value / base;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
  return nice * base;
}

function formatValue(value: number, unit?: string): string {
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000) body = `${(value / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  else if (abs >= 10_000) body = `${(value / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  else if (Number.isInteger(value)) body = String(value);
  else if (abs < 1) body = value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  else if (abs < 10) body = value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  else body = value.toFixed(abs < 100 ? 1 : 0).replace(/\.0$/, '');
  return `${body}${unit ?? ''}`;
}

export function drawChart(chart: Chart, deps: ChartDeps): Node[] {
  switch (chart.kind) {
    case 'bar': return verticalBars(chart, deps);
    case 'horizontal_bar': return horizontalBars(chart, deps);
    case 'line': return lineChart(chart, deps);
    case 'donut': return donutChart(chart, deps);
    default: return [];
  }
}

function axisLabelFont(theme: Theme): FontSpec {
  return { family: theme.typography.body_font, size: 26, weight: 600 };
}

function valueFont(theme: Theme): FontSpec {
  return { family: theme.typography.display_font, size: 40, weight: 700 };
}

function verticalBars(chart: Chart, { palette, theme, box }: ChartDeps): Node[] {
  const nodes: Node[] = [];
  const max = chart.max ?? niceMax(Math.max(...chart.values));
  const labelFont = axisLabelFont(theme);
  const labelH = 46;
  const valueH = 52;
  const plotY = box.y + valueH;
  const plotH = box.h - labelH - valueH - 18;
  const n = chart.values.length;
  const slot = box.w / n;
  const barW = Math.min(slot * 0.56, 108);
  // baseline
  nodes.push(rect(box.x, plotY + plotH, box.w, 1.5, withAlpha(palette.text, 0.25)));
  for (let i = 0; i < n; i++) {
    const value = chart.values[i];
    const h = Math.max(3, (Math.max(0, value) / max) * plotH);
    const x = box.x + slot * i + (slot - barW) / 2;
    const y = plotY + plotH - h;
    const highlighted = chart.highlight === i;
    const color = highlighted ? palette.accent : palette.chart[i % palette.chart.length];
    nodes.push(rect(x, y, barW, h, color, {
      rx: theme.style === 'brutal' ? 0 : 8,
      opacity: highlighted ? 1 : 0.86,
    }));
    nodes.push(text(x + barW / 2, y - 16, formatValue(value, chart.unit), {
      family: theme.typography.display_font, size: 34, weight: 700,
      fill: highlighted ? palette.accent : palette.text, anchor: 'middle',
    }));
    const label = truncateToWidth(chart.labels[i], slot - 8, labelFont);
    nodes.push(text(x + barW / 2, plotY + plotH + 38, label.toUpperCase(), {
      family: theme.typography.body_font, size: 24, weight: 600, letterSpacing: 0.6,
      fill: palette.textMuted, anchor: 'middle',
    }));
  }
  return nodes;
}

function horizontalBars(chart: Chart, { palette, theme, box }: ChartDeps): Node[] {
  const nodes: Node[] = [];
  const max = chart.max ?? niceMax(Math.max(...chart.values));
  const n = chart.values.length;
  const rowH = Math.min(96, box.h / n);
  const labelW = Math.min(240, box.w * 0.3);
  const valueW = 140;
  const trackX = box.x + labelW + 16;
  const trackW = box.w - labelW - valueW - 32;
  const labelFont = axisLabelFont(theme);
  for (let i = 0; i < n; i++) {
    const y = box.y + rowH * i + rowH / 2;
    const value = chart.values[i];
    const w = Math.max(4, (Math.max(0, value) / max) * trackW);
    const highlighted = chart.highlight === i;
    const color = highlighted ? palette.accent : palette.chart[i % palette.chart.length];
    const label = truncateToWidth(chart.labels[i], labelW, labelFont);
    nodes.push(text(box.x, y + 9, label, { family: theme.typography.body_font, size: 26, weight: 600, fill: palette.text }));
    nodes.push(rect(trackX, y - 15, trackW, 30, withAlpha(palette.text, 0.08), { rx: 15 }));
    nodes.push(rect(trackX, y - 15, w, 30, color, { rx: 15 }));
    nodes.push(text(box.x + box.w, y + 10, formatValue(value, chart.unit), {
      family: theme.typography.display_font, size: 34, weight: 700,
      fill: highlighted ? palette.accent : palette.text, anchor: 'end',
    }));
  }
  void valueFont;
  return nodes;
}

function lineChart(chart: Chart, { palette, theme, box }: ChartDeps): Node[] {
  const nodes: Node[] = [];
  const max = chart.max ?? niceMax(Math.max(...chart.values));
  const labelH = 46;
  const top = box.y + 24;
  const plotH = box.h - labelH - 24;
  const n = chart.values.length;
  const stepX = n > 1 ? box.w / (n - 1) : box.w;
  for (let g = 0; g <= 3; g++) {
    const y = top + (plotH / 3) * g;
    nodes.push(rect(box.x, y, box.w, 1, withAlpha(palette.text, g === 3 ? 0.25 : 0.1)));
    const value = max - (max / 3) * g;
    nodes.push(text(box.x - 12, y + 8, formatValue(value, chart.unit), {
      family: theme.typography.body_font, size: 22, weight: 500, fill: palette.textMuted, anchor: 'end',
    }));
  }
  const points = chart.values.map((v, i) => ({
    x: box.x + stepX * i,
    y: top + plotH - (Math.max(0, v) / max) * plotH,
  }));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  const area = `${d}L${points[points.length - 1].x.toFixed(1)} ${top + plotH}L${points[0].x.toFixed(1)} ${top + plotH}Z`;
  nodes.push(path(area, { fill: withAlpha(palette.accent, 0.14) }));
  nodes.push(path(d, { fill: 'none', stroke: palette.accent, strokeWidth: 6, linecap: 'round', linejoin: 'round' }));
  points.forEach((p, i) => {
    const highlighted = chart.highlight === i;
    nodes.push(circle(p.x, p.y, highlighted ? 12 : 8, highlighted ? palette.accent : palette.bg, { stroke: palette.accent, strokeWidth: 4 }));
    if (highlighted) {
      nodes.push(text(p.x, p.y - 26, formatValue(chart.values[i], chart.unit), {
        family: theme.typography.display_font, size: 36, weight: 700, fill: palette.accent, anchor: 'middle',
      }));
    }
    nodes.push(text(p.x, top + plotH + 40, truncateToWidth(chart.labels[i], stepX, axisLabelFont(theme)).toUpperCase(), {
      family: theme.typography.body_font, size: 22, weight: 600, letterSpacing: 0.6,
      fill: palette.textMuted, anchor: n > 4 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle',
    }));
  });
  return nodes;
}

function donutChart(chart: Chart, { palette, theme, box }: ChartDeps): Node[] {
  const nodes: Node[] = [];
  const total = chart.values.reduce((sum, v) => sum + Math.max(0, v), 0) || 1;
  const cx = box.x + Math.min(box.w, box.h) / 2;
  const cy = box.y + box.h / 2;
  const r = Math.min(box.w, box.h) * 0.36;
  const thickness = r * 0.34;
  let angle = -Math.PI / 2;
  chart.values.forEach((value, i) => {
    const sweep = (Math.max(0, value) / total) * Math.PI * 2;
    const end = angle + sweep;
    const color = chart.highlight === i ? palette.accent : palette.chart[i % palette.chart.length];
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + Math.cos(angle) * r;
    const y1 = cy + Math.sin(angle) * r;
    const x2 = cx + Math.cos(end) * r;
    const y2 = cy + Math.sin(end) * r;
    const ix1 = cx + Math.cos(angle) * (r - thickness);
    const iy1 = cy + Math.sin(angle) * (r - thickness);
    const ix2 = cx + Math.cos(end) * (r - thickness);
    const iy2 = cy + Math.sin(end) * (r - thickness);
    const d = [
      `M${x1.toFixed(1)} ${y1.toFixed(1)}`,
      `A${r.toFixed(1)} ${r.toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      `L${ix2.toFixed(1)} ${iy2.toFixed(1)}`,
      `A${(r - thickness).toFixed(1)} ${(r - thickness).toFixed(1)} 0 ${large} 0 ${ix1.toFixed(1)} ${iy1.toFixed(1)}`,
      'Z',
    ].join('');
    nodes.push(path(d, { fill: color, opacity: chart.highlight === i ? 1 : 0.9 }));
    angle = end;
  });
  const centerLabel = chart.highlight !== undefined ? formatValue(chart.values[chart.highlight], chart.unit) : formatValue(total, chart.unit);
  nodes.push(text(cx, cy + 6, centerLabel, {
    family: theme.typography.display_font, size: 66, weight: 700, fill: palette.text, anchor: 'middle',
  }));
  if (chart.highlight !== undefined) {
    nodes.push(text(cx, cy + 46, truncateToWidth(chart.labels[chart.highlight], r * 2, axisLabelFont(theme)).toUpperCase(), {
      family: theme.typography.body_font, size: 20, weight: 700, letterSpacing: 1.4, fill: palette.textMuted, anchor: 'middle',
    }));
  }
  // Legend to the right of the donut when there is room.
  const legendX = box.x + Math.min(box.w, box.h) + 40;
  const legendW = box.w - (legendX - box.x);
  if (legendW > 180) {
    chart.labels.forEach((label, i) => {
      const y = box.y + 40 + i * 46;
      const color = chart.highlight === i ? palette.accent : palette.chart[i % palette.chart.length];
      nodes.push(rect(legendX, y - 14, 20, 20, color, { rx: 4 }));
      nodes.push(oneLine(`${Math.round((chart.values[i] / total) * 100)}% ${label}`, {
        x: legendX + 32, y, maxWidth: legendW - 32,
        font: { family: theme.typography.body_font, size: 26, weight: 500 }, color: palette.textSecondary,
      }));
    });
  }
  void textWidth;
  return nodes;
}
