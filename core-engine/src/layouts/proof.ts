import { withAlpha } from '../colors.js';
import { rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, textWidth } from '../text.js';
import {
  CONTENT_TOP, CW, FOOTER_RULE_Y, M,
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

  // Measure the blocks first, then give the number whatever vertical room is left.
  // (0.1.0 pinned the baseline at a fixed y, so a two-line headline ran into it.)
  const labelText = stripUnsupported(slide.metric_label);
  const labelFont = { ...bodyFont(ctx, 40, 600) };
  const labelProbe = paragraph(labelText, { x: M, y: 0, maxWidth: CW * 0.9, font: labelFont, color: p.text, maxLines: 2 });
  const findingProbe = paragraph(stripUnsupported(slide.finding), {
    x: M + 34, y: 0, maxWidth: CW - 34,
    font: { ...bodyFont(ctx, 38, 400), lineHeight: 1.38 }, color: p.textSecondary, maxLines: 5,
  });

  const sourceTop = FOOTER_RULE_Y - 26;
  const valueTop = CONTENT_TOP + 4 + headline.height + 40;
  const reserved = 34 + labelProbe.height + 50 + findingProbe.height + 48;
  const valueRoom = Math.max(110, sourceTop - valueTop - reserved);
  const valueFontSize = Math.min(210, Math.max(110, Math.floor(valueRoom / 0.86)));
  const valueWidth = textWidth(stripUnsupported(slide.metric_value), {
    family: ctx.theme.typography.display_font, size: valueFontSize, weight: 700,
  });
  const valueSize = valueWidth > CW ? Math.floor(valueFontSize * (CW / valueWidth)) : valueFontSize;
  const valueY = valueTop + Math.floor(valueSize * 0.86);
  nodes.push(text(M, valueY, stripUnsupported(slide.metric_value), {
    family: ctx.theme.typography.display_font,
    size: valueSize, weight: 700, fill: p.accent, letterSpacing: -2,
  }));

  const label = paragraph(labelText, {
    x: M, y: valueY + 34, maxWidth: CW * 0.9, font: labelFont, color: p.text, maxLines: 2,
  });
  nodes.push(...label.nodes);

  const findingTop = valueY + 34 + label.height + 50;
  const finding = paragraph(stripUnsupported(slide.finding), {
    x: M + 34, y: findingTop + 4, maxWidth: CW - 34,
    font: { ...bodyFont(ctx, 38, 400), lineHeight: 1.38 }, color: p.textSecondary, maxLines: 5,
  });
  nodes.push(...finding.nodes);
  // The rail tracks the copy it belongs to rather than a guessed height.
  nodes.push(rect(M, findingTop, 3, Math.max(48, finding.height + 8), withAlpha(p.accent, 0.5)));

  // Attribution only earns a line when it says something the source line does not.
  const attribution = slide.attribution ? stripUnsupported(slide.attribution) : '';
  const sourceLower = slide.source.toLowerCase();
  if (attribution && !sourceLower.includes(attribution.toLowerCase())) {
    const font = { family: ctx.theme.typography.body_font, size: 28, weight: 600 };
    nodes.push(text(M, sourceTop - 44, `— ${attribution}`, {
      family: font.family, size: font.size, weight: font.weight, fill: p.textMuted,
    }));
  }
  nodes.push(sourceLine(ctx, M, sourceTop, slide.source));
  return nodes;
}
