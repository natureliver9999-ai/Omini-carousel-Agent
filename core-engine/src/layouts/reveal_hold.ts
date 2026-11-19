import { withAlpha } from '../colors.js';
import { rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, truncateToWidth } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M, W,
  bodyFont, displayFont, panel,
  type SlideContext,
} from '../scene.js';
import type { RevealHoldSlideT } from '../schema.js';
import { drawIcon } from '../icons.js';

/**
 * Open loop. A teaser card bleeds past the right edge of the canvas so the frame
 * reads as cropped — the visual equivalent of a sentence that trails off.
 * The linter guarantees the next slide resolves the tension.
 *
 * Geometry rules learned from QA: the card never sits on top of the body column
 * (the body is capped at the card's left edge), the "hold that thought" hint is
 * anchored under the body rather than at a fixed y, and the card's own label is
 * truncated to the part that is actually on-canvas.
 */
export function revealHoldLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as RevealHoldSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  const bleed = W * (slide.bleed_ratio ?? 0.12);
  // Teaser card: right edge sits `bleed` px beyond the canvas.
  const cardW = 470;
  const cardH = 260;
  const cardX = W - cardW + bleed;

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP + 60, maxWidth: CW * 0.86,
    font: displayFont(ctx, 700), color: p.text, maxLines: 3,
    fit: { min: ctx.theme.typography.headline_px * 0.6 },
  });
  nodes.push(...headline.nodes);

  const bodyY = CONTENT_TOP + 60 + headline.height + 46;
  const bodyMaxW = Math.max(CW * 0.5, cardX - M - 56);
  const body = paragraph(stripUnsupported(slide.body), {
    x: M, y: bodyY,
    maxWidth: bodyMaxW, font: bodyFont(ctx, 40), color: p.textSecondary, maxLines: 5,
    fit: { min: 30 },
  });
  nodes.push(...body.nodes);
  const bodyBottom = bodyY + body.height;

  const hintFont = { family: ctx.theme.typography.mono_font, size: 22, weight: 500, letterSpacing: 2 };
  const hintBaseline = bodyBottom + 46;
  nodes.push(text(M, hintBaseline, 'HOLD THAT THOUGHT', {
    family: hintFont.family, size: hintFont.size, weight: hintFont.weight, letterSpacing: hintFont.letterSpacing,
    fill: p.textMuted,
  }));

  // Dashed "unresolved" connector from the copy toward the bleeding card.
  const lineY = hintBaseline + 16;
  nodes.push(rect(M, lineY, Math.max(60, cardX - M - 40), 2, withAlpha(p.text, 0.22), { dash: '10 12' }));

  const cardY = Math.min(
    Math.max(lineY + 56, CONTENT_TOP + 360),
    CONTENT_BOTTOM - cardH - 24,
  );

  nodes.push(...panel(ctx, {
    x: cardX, y: cardY, w: cardW, h: cardH,
    fill: p.accent, stroke: withAlpha(p.accentText, 0.2), rx: 28,
  }));
  nodes.push(rect(cardX + 22, cardY + 26, 8, 52, withAlpha(p.accentText, 0.85), { rx: 4 }));

  // Only the on-canvas part of the card can carry text; measure against that.
  const labelFont = { family: ctx.theme.typography.body_font, size: 24, weight: 700, letterSpacing: 2 };
  const visibleLabelW = Math.max(80, W - (cardX + 46) - 24);
  // Truncation is the fallback: two lines of a long teaser still read on-canvas.
  const label = truncateToWidth(slide.teaser_label.toUpperCase(), visibleLabelW * 2, labelFont);
  nodes.push(...paragraph(label, {
    x: cardX + 46, y: cardY + 40, maxWidth: visibleLabelW,
    font: { ...labelFont, size: 24, lineHeight: 1.3 },
    color: withAlpha(p.accentText, 0.92), maxLines: 2,
  }).nodes);

  nodes.push(text(cardX + 26, cardY + cardH - 34, 'NEXT', {
    family: ctx.theme.typography.display_font, size: 92, weight: 700, fill: p.accentText,
  }));
  nodes.push(...drawIcon(Math.min(cardX + cardW - 130, W - 116), cardY + cardH - 96, 70, 'arrow-right', {
    color: withAlpha(p.accentText, 0.9), strokeWidth: 2.2,
  }));

  // `footer_hook` is rendered once, by the scene footer. Drawing it here as well
  // produced the duplicated, colliding footer seen in 0.1.0.
  return nodes;
}
