import { withAlpha } from '../colors.js';
import { circle, rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, textWidth } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M, W,
  bodyFont, displayFont, panel,
  type SlideContext,
} from '../scene.js';
import type { CtaSlideT } from '../schema.js';
import { drawIcon } from '../icons.js';

const ACTION_COPY: Record<CtaSlideT['action'], { icon: string; label: string; fallback: string }> = {
  save: { icon: 'bookmark', label: 'SAVE THIS', fallback: 'Save this carousel so it is there when you need it.' },
  comment: { icon: 'message-circle', label: 'COMMENT TO GET IT', fallback: 'Drop the keyword in the comments and I will send the full version.' },
  follow: { icon: 'users', label: 'FOLLOW FOR MORE', fallback: 'Follow for one breakdown like this every week.' },
  link_in_caption: { icon: 'arrow-up-right', label: 'LINK IN CAPTION', fallback: 'The full template is linked in the caption.' },
  share: { icon: 'share', label: 'SHARE IT', fallback: 'Send this to the one person who needs it today.' },
};

/**
 * Final slide. Exactly one action, stated in the imperative, with a visual
 * target big enough to act on without reading.
 */
export function ctaLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as CtaSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];
  const meta = ACTION_COPY[slide.action];

  nodes.push(circle(W - 40, 220, 260, withAlpha(p.accent, 0.14)));
  nodes.push(circle(W - 40, 220, 260, 'none', { stroke: withAlpha(p.accent, 0.3), strokeWidth: 2 }));

  // Action chip
  const chipW = textWidth(meta.label, { family: ctx.theme.typography.body_font, size: 26, weight: 700, letterSpacing: 2.6 }) + 96;
  nodes.push(rect(M, CONTENT_TOP + 20, chipW, 62, p.accent, { rx: 999 }));
  nodes.push(...drawIcon(M + 22, CONTENT_TOP + 38, 26, meta.icon, { color: p.accentText, strokeWidth: 2.1 }));
  nodes.push(text(M + 62, CONTENT_TOP + 61, meta.label, {
    family: ctx.theme.typography.body_font, size: 26, weight: 700, letterSpacing: 2.6, fill: p.accentText,
  }));

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP + 140, maxWidth: CW, font: displayFont(ctx, 700),
    color: p.text, maxLines: 3, fit: { min: ctx.theme.typography.headline_px * 0.58 },
  });
  nodes.push(...headline.nodes);
  let cursor = CONTENT_TOP + 140 + headline.height + 40;

  const body = paragraph(stripUnsupported(slide.text || meta.fallback), {
    x: M, y: cursor, maxWidth: CW * 0.9, font: bodyFont(ctx, 40), color: p.textSecondary, maxLines: 4,
  });
  nodes.push(...body.nodes);
  cursor += body.height + 52;

  // Keyword box: the single most-tapped element on the slide.
  if (slide.action === 'comment') {
    const keyword = (slide.keyword ?? 'TEMPLATE').toUpperCase();
    const kwFont = { family: ctx.theme.typography.mono_font, size: 54, weight: 700, letterSpacing: 8 };
    const w = Math.min(CW, textWidth(keyword, kwFont) + 84);
    nodes.push(...panel(ctx, {
      x: M, y: cursor, w, h: 130, fill: withAlpha(p.accent, 0.12),
      stroke: p.accent, strokeWidth: 3, rx: 16, shadow: false,
    }));
    nodes.push(text(M + w / 2, cursor + 84, keyword, {
      family: ctx.theme.typography.mono_font, size: 54, weight: 700, letterSpacing: 8, fill: p.accent, anchor: 'middle',
    }));
    cursor += 130 + 30;
  }

  if (slide.handle) {
    const handle = `@${slide.handle.replace(/^@/, '')}`;
    nodes.push(...panel(ctx, {
      x: M, y: CONTENT_BOTTOM - 150, w: CW, h: 150, fill: withAlpha(p.text, 0.06), rx: 24, shadow: false,
    }));
    nodes.push(text(M + 40, CONTENT_BOTTOM - 62, handle, {
      family: ctx.theme.typography.display_font, size: 56, weight: 700, fill: p.text,
    }));
    nodes.push(...drawIcon(W - M - 100, CONTENT_BOTTOM - 118, 64, meta.icon, { color: p.accent, strokeWidth: 2.4 }));
  } else {
    // No handle: a solid footer band keeps the page from feeling half-empty.
    nodes.push(rect(M, CONTENT_BOTTOM - 110, CW, 110, withAlpha(p.accent, 0.12), { rx: 20 }));
    nodes.push(...drawIcon(M + 30, CONTENT_BOTTOM - 84, 58, meta.icon, { color: p.accent, strokeWidth: 2.4 }));
    nodes.push(text(M + 108, CONTENT_BOTTOM - 40, meta.label, {
      family: ctx.theme.typography.body_font, size: 34, weight: 700, letterSpacing: 1.6, fill: p.text,
    }));
  }
  return nodes;
}
