import { withAlpha } from '../colors.js';
import { rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M,
  bodyFont, displayFont, type SlideContext,
} from '../scene.js';
import type { SummarySlideT } from '../schema.js';
import { drawIcon } from '../icons.js';

/**
 * The screenshot slide. Everything the reader needs to keep, in one frame, in
 * the fewest possible words.
 */
export function summaryLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as SummarySlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP, maxWidth: CW * 0.9, font: displayFont(ctx, 700), color: p.text,
    maxLines: 2, fit: { min: ctx.theme.typography.headline_px * 0.55 },
  });
  nodes.push(...headline.nodes);

  const startY = CONTENT_TOP + headline.height + 58;
  const reserve = slide.save_prompt ? 150 : 40;
  const available = CONTENT_BOTTOM - reserve - startY;
  const rowH = Math.min(150, available / slide.bullets.length);

  slide.bullets.forEach((bullet, i) => {
    const rowY = startY + i * rowH;
    nodes.push(rect(M, rowY, CW, rowH - 14, withAlpha(p.text, 0.04), { rx: 16 }));
    nodes.push(...drawIcon(M + 26, rowY + 26, 32, 'check', { color: p.accent, strokeWidth: 2.6 }));
    const line = paragraph(stripUnsupported(bullet), {
      x: M + 78, y: rowY + 18, maxWidth: CW - 120,
      font: bodyFont(ctx, 38, 500), color: p.text, maxLines: 2,
    });
    nodes.push(...line.nodes);
  });

  if (slide.save_prompt) {
    const promptFont = { family: ctx.theme.typography.body_font, size: 28, weight: 700, letterSpacing: 1.2 };
    nodes.push(rect(M, CONTENT_BOTTOM - 104, CW, 104, p.accent, { rx: 20 }));
    nodes.push(...drawIcon(M + 34, CONTENT_BOTTOM - 72, 42, 'bookmark', { color: p.accentText, strokeWidth: 2.4 }));
    nodes.push(text(M + 94, CONTENT_BOTTOM - 38, stripUnsupported(slide.save_prompt).toUpperCase(), {
      family: promptFont.family, size: promptFont.size, weight: promptFont.weight, letterSpacing: promptFont.letterSpacing,
      fill: p.accentText,
    }));
  }
  return nodes;
}
