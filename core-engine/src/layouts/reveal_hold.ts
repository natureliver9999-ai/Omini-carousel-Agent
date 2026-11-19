import { withAlpha } from '../colors.js';
import { rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, textWidth } from '../text.js';
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
 */
export function revealHoldLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as RevealHoldSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  const bleed = W * (slide.bleed_ratio ?? 0.12);
  // Teaser card: right edge sits `bleed` px beyond the canvas.
  const cardW = 470;
  const cardH = 300;
  const cardX = W - cardW + bleed;
  const cardY = CONTENT_TOP + 470;

  nodes.push(...panel(ctx, {
    x: cardX, y: cardY, w: cardW, h: cardH,
    fill: p.accent, stroke: withAlpha(p.accentText, 0.2), rx: 28,
  }));
  nodes.push(rect(cardX + 22, cardY + 26, 8, 52, withAlpha(p.accentText, 0.85), { rx: 4 }));
  nodes.push(text(cardX + 46, cardY + 62, slide.teaser_label.toUpperCase().slice(0, 22), {
    family: ctx.theme.typography.body_font, size: 24, weight: 700, letterSpacing: 2,
    fill: withAlpha(p.accentText, 0.92),
  }));
  nodes.push(text(cardX + 24, cardY + cardH - 34, 'NEXT', {
    family: ctx.theme.typography.display_font, size: 92, weight: 700, fill: p.accentText,
  }));
  nodes.push(...drawIcon(cardX + cardW - 130, cardY + cardH - 96, 70, 'arrow-right', {
    color: withAlpha(p.accentText, 0.9), strokeWidth: 2.2,
  }));

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP + 60, maxWidth: CW * 0.86,
    font: displayFont(ctx, 700), color: p.text, maxLines: 3,
    fit: { min: ctx.theme.typography.headline_px * 0.6 },
  });
  nodes.push(...headline.nodes);

  const body = paragraph(stripUnsupported(slide.body), {
    x: M, y: CONTENT_TOP + 60 + headline.height + 46,
    maxWidth: CW * 0.74, font: bodyFont(ctx, 40), color: p.textSecondary, maxLines: 5,
  });
  nodes.push(...body.nodes);

  // Dashed "unresolved" connector from the copy toward the bleeding card.
  const connectorY = cardY - 46;
  nodes.push(rect(M, connectorY, Math.max(60, cardX - M - 30), 2, withAlpha(p.text, 0.22), {
    dash: '10 12',
  }));
  const hintFont = { family: ctx.theme.typography.mono_font, size: 22, weight: 500, letterSpacing: 2 };
  nodes.push(text(M, connectorY - 16, 'HOLD THAT THOUGHT', {
    family: hintFont.family, size: hintFont.size, weight: hintFont.weight, letterSpacing: hintFont.letterSpacing,
    fill: p.textMuted,
  }));

  if (slide.footer_hook) {
    const label = stripUnsupported(slide.footer_hook).toUpperCase();
    const font = { family: ctx.theme.typography.body_font, size: 26, weight: 700, letterSpacing: 2 };
    const w = Math.min(CW, textWidth(label, font) + 76);
    nodes.push(rect(M, CONTENT_BOTTOM - 84, w, 64, withAlpha(p.accent, 0.12), { rx: 999 }));
    nodes.push(...drawIcon(M + 24, CONTENT_BOTTOM - 68, 32, 'arrow-right', { color: p.accent, strokeWidth: 2.2 }));
    nodes.push(text(M + 68, CONTENT_BOTTOM - 42, label, {
      family: font.family, size: font.size, weight: font.weight, letterSpacing: font.letterSpacing, fill: p.accent,
    }));
  }
  return nodes;
}
