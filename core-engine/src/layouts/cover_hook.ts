import { withAlpha } from '../colors.js';
import { circle, rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, textWidth } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_H, CONTENT_TOP, CW, M, W,
  bodyFont, displayFont, panel, pill, pillWidth, softBlob,
  type SlideContext,
} from '../scene.js';
import type { CoverHookSlideT } from '../schema.js';
import { drawIcon } from '../icons.js';

/**
 * Slide 1. Two jobs: stop the scroll, and survive Instagram's second-chance
 * resurfacing (which may show slide 2 first, hence the hook must be self-evident).
 */
export function coverHookLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as CoverHookSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  // Ambient depth behind the type: concentric rings read as "engineered" instead
  // of the muddy blob a filled circle produces on dark themes.
  nodes.push(circle(W - 40, 330, 330, 'none', { stroke: withAlpha(p.accent, 0.16), strokeWidth: 2 }));
  nodes.push(circle(W - 40, 330, 240, 'none', { stroke: withAlpha(p.accent, 0.1), strokeWidth: 1.5 }));
  nodes.push(circle(W - 130, 250, 10, p.accent, { opacity: 0.9 }));

  const font = displayFont(ctx, 700);
  const maxHeadline = ctx.theme.typography.headline_px * 1.3;
  const minHeadline = ctx.theme.typography.headline_px * 0.58;

  // Measurement pass, so the block can be optically centred in the safe area.
  const probe = paragraph(stripUnsupported(slide.headline), {
    x: M, y: 0, maxWidth: CW, font, color: p.text, maxLines: 3, fit: { min: minHeadline, max: maxHeadline },
  });
  const kickerH = slide.kicker ? 56 : 0;
  const subLines = slide.sub ? 3 : 0;
  const subH = slide.sub ? subLines * bodyFont(ctx, 44).size * 1.34 + 34 : 0;
  const underlineH = 34;
  const railReserve = 150;
  const blockH = kickerH + probe.height + underlineH + subH;
  const top = Math.max(CONTENT_TOP + 24, CONTENT_TOP + (CONTENT_H - blockH - railReserve) / 2);

  let cursor = top;
  if (slide.kicker) {
    const size = 30;
    nodes.push(text(M, cursor + size, stripUnsupported(slide.kicker), {
      family: ctx.theme.typography.body_font, size, weight: 600, fill: p.textMuted, letterSpacing: 0.4,
    }));
    cursor += kickerH;
  }

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: cursor, maxWidth: CW, font, color: p.text, maxLines: 3, fit: { min: minHeadline, max: maxHeadline },
  });
  nodes.push(...headline.nodes);
  cursor += headline.height;

  // Emphasis rule: width tracks the last line so it reads as intentional.
  const lastLine = headline.lines[headline.lines.length - 1] ?? '';
  const ruleW = Math.max(96, Math.min(CW, textWidth(lastLine, { ...font, size: headline.fontSize }) * 0.86));
  nodes.push(rect(M, cursor + 16, ruleW, 12, p.accent, { rx: 6 }));
  cursor += underlineH;

  if (slide.sub) {
    const sub = paragraph(stripUnsupported(slide.sub), {
      x: M, y: cursor + 16, maxWidth: CW * 0.9, font: bodyFont(ctx, 44, 400), color: p.textSecondary, maxLines: 3,
    });
    nodes.push(...sub.nodes);
    cursor += sub.height + 34;
  }

  // Bottom rail: sits just under the copy so the page never reads bottom-heavy.
  const railY = Math.min(CONTENT_BOTTOM - 90, cursor + 86);
  if (slide.icon) {
    nodes.push(rect(M, railY, 96, 96, p.accent, { rx: 26 }));
    nodes.push(...drawIcon(M + 24, railY + 24, 48, slide.icon, { color: p.accentText, strokeWidth: 2 }));
  }
  const swipeLabel = 'SWIPE';
  const swipeW = pillWidth(swipeLabel, ctx, 24, 'arrow-right');
  const swipeX = W - M - swipeW;
  nodes.push(...pill(ctx, swipeX, railY + 22, swipeLabel, {
    fill: withAlpha(p.text, 0.06), color: p.textSecondary, size: 24, icon: 'arrow-right',
  }));
  void panel;
  return nodes;
}
