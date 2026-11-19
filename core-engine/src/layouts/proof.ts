import { withAlpha } from '../colors.js';
import { rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, textWidth } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, FOOTER_RULE_Y, M,
  bodyFont, displayFont, sourceLine, type SlideContext,
} from '../scene.js';
import type { ProofSlideT } from '../schema.js';

/**
 * One number, one named source, one sentence of meaning. This layout is the
 * engine's anti-fabrication posture in visual form: `source` is required by the
 * schema, so a proof slide cannot exist without provenance.
 */
export function proofLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as ProofSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  nodes.push(rect(M, CONTENT_TOP + 4, 10, 96, p.accent, { rx: 5 }));

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M + 34, y: CONTENT_TOP + 4, maxWidth: CW - 34,
    font: bodyFont(ctx, 32, 600), color: p.textMuted, maxLines: 2,
  });
  nodes.push(...headline.nodes);

  // The number is the slide. Cap the size so a long token never collides with
  // the attribution rail.
  const valueFontSize = Math.min(210, Math.max(120, CW / Math.max(3, slide.metric_value.length) * 1.5));
  const valueY = CONTENT_TOP + 210;
  const valueWidth = textWidth(stripUnsupported(slide.metric_value), {
    family: ctx.theme.typography.display_font, size: valueFontSize, weight: 700,
  });
  nodes.push(text(M, valueY, stripUnsupported(slide.metric_value), {
    family: ctx.theme.typography.display_font,
    size: valueWidth > CW ? Math.floor(valueFontSize * (CW / valueWidth)) : valueFontSize,
    weight: 700, fill: p.accent, letterSpacing: -2,
  }));

  const label = paragraph(stripUnsupported(slide.metric_label), {
    x: M, y: valueY + 34, maxWidth: CW * 0.9, font: bodyFont(ctx, 40, 600), color: p.text, maxLines: 2,
  });
  nodes.push(...label.nodes);

  const findingTop = valueY + 34 + label.height + 50;
  nodes.push(rect(M, findingTop, 3, Math.min(300, CONTENT_BOTTOM - findingTop - 120), withAlpha(p.accent, 0.5)));
  const finding = paragraph(stripUnsupported(slide.finding), {
    x: M + 34, y: findingTop + 4, maxWidth: CW - 34,
    font: { ...bodyFont(ctx, 38, 400), lineHeight: 1.38 }, color: p.textSecondary, maxLines: 5,
  });
  nodes.push(...finding.nodes);

  if (slide.attribution) {
    const attribution = `— ${stripUnsupported(slide.attribution)}`;
    const font = { family: ctx.theme.typography.body_font, size: 28, weight: 600 };
    nodes.push(text(M, CONTENT_BOTTOM - 30, attribution, {
      family: font.family, size: font.size, weight: font.weight, fill: p.textMuted,
    }));
  }
  nodes.push(sourceLine(ctx, M, FOOTER_RULE_Y - 26, slide.source));
  return nodes;
}
