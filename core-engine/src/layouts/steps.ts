import { withAlpha } from '../colors.js';
import { circle, rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M,
  bodyFont, displayFont, type SlideContext,
} from '../scene.js';
import type { StepsSlideT } from '../schema.js';
import { drawIcon } from '../icons.js';

/**
 * A process compressed into one frame. Numbered rows stay legible at 40% zoom in
 * the feed, which is where most of the audience first meets the slide.
 */
export function stepsLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as StepsSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];
  const checklist = slide.emphasis === 'checklist';

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP, maxWidth: CW * 0.94, font: displayFont(ctx, 700), color: p.text,
    maxLines: 2, fit: { min: ctx.theme.typography.headline_px * 0.56 },
  });
  nodes.push(...headline.nodes);

  const blockTop = CONTENT_TOP + headline.height + 64;
  const available = CONTENT_BOTTOM - 40 - blockTop;
  const rowH = Math.min(280, available / slide.steps.length);
  // Centre the group inside the remaining canvas so short lists do not float at the top.
  const startY = blockTop + Math.max(0, (available - rowH * slide.steps.length) / 2);
  const gutterX = M + 38;

  // Spine
  if (slide.steps.length > 1) {
    nodes.push(rect(gutterX - 1, startY + 34, 2, rowH * (slide.steps.length - 1), withAlpha(p.text, 0.14), { dash: '6 10' }));
  }

  slide.steps.forEach((step, i) => {
    const rowY = startY + i * rowH;
    const marker = 76;
    if (checklist) {
      nodes.push(circle(gutterX, rowY + 34, marker / 2, withAlpha(p.accent, 0.14)));
      nodes.push(...drawIcon(gutterX - 18, rowY + 16, 36, 'check', { color: p.accent, strokeWidth: 2.6 }));
    } else {
      nodes.push(circle(gutterX, rowY + 34, marker / 2, p.accent));
      nodes.push(text(gutterX, rowY + 34 + 16, String(i + 1), {
        family: ctx.theme.typography.display_font, size: 40, weight: 700, fill: p.accentText, anchor: 'middle',
      }));
    }
    const textX = gutterX + marker / 2 + 34;
    const titleFont = bodyFont(ctx, 40, 600);
    const title = paragraph(stripUnsupported(step.title), {
      x: textX, y: rowY + 2, maxWidth: CW - (textX - M), font: titleFont, color: p.text, maxLines: 2,
    });
    nodes.push(...title.nodes);
    if (step.detail) {
      const detail = paragraph(stripUnsupported(step.detail), {
        x: textX, y: rowY + title.height + 12, maxWidth: CW - (textX - M) - 12,
        font: bodyFont(ctx, 30), color: p.textMuted, maxLines: 2,
      });
      nodes.push(...detail.nodes);
    }
  });

  if (slide.footer_hook) {
    nodes.push(text(M, CONTENT_BOTTOM - 10, stripUnsupported(slide.footer_hook), {
      family: ctx.theme.typography.body_font, size: 28, weight: 600, fill: p.accent,
    }));
  }
  return nodes;
}
