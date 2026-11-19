import { withAlpha } from '../colors.js';
import { type Node } from '../svg.js';
import { paragraph, stripUnsupported } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M, FOOTER_RULE_Y,
  bodyFont, displayFont, panel, sourceLine, type SlideContext,
} from '../scene.js';
import { drawChart } from '../charts.js';
import type { DataChartSlideT } from '../schema.js';

/**
 * Evidence, not decoration. The chart is drawn straight from the arrays in the
 * spec, and the source line is mandatory in the schema.
 */
export function dataChartLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as DataChartSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP, maxWidth: CW * 0.92, font: displayFont(ctx, 700), color: p.text,
    maxLines: 2, fit: { min: ctx.theme.typography.headline_px * 0.48 },
  });
  nodes.push(...headline.nodes);

  const chartTop = CONTENT_TOP + headline.height + 40;
  const chartH = Math.min(560, CONTENT_BOTTOM - chartTop - (slide.takeaway ? 130 : 40));
  nodes.push(...panel(ctx, {
    x: M, y: chartTop, w: CW, h: chartH, fill: p.surface, stroke: withAlpha(p.text, 0.1), rx: 24, shadow: false,
  }));
  nodes.push(...drawChart(slide.chart, {
    palette: p,
    theme: ctx.theme,
    box: { x: M + 40, y: chartTop + 36, w: CW - 80, h: chartH - 72 },
  }));

  if (slide.takeaway) {
    const takeaway = paragraph(stripUnsupported(slide.takeaway), {
      x: M, y: chartTop + chartH + 30, maxWidth: CW, font: bodyFont(ctx, 34, 600), color: p.text, maxLines: 2,
    });
    nodes.push(...takeaway.nodes);
  }

  nodes.push(sourceLine(ctx, M, FOOTER_RULE_Y - 26, slide.source));
  return nodes;
}
