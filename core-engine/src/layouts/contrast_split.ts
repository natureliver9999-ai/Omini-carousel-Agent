import { withAlpha } from '../colors.js';
import { text, type Node } from '../svg.js';
import { paragraph, stripUnsupported } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M,
  bodyFont, displayFont, panel, pill, type SlideContext,
} from '../scene.js';
import type { ContrastSplitSlideT } from '../schema.js';
import { drawIcon } from '../icons.js';

const GAP = 30;

/**
 * One variable, flipped. `split` shows both halves in one frame; `before`/`after`
 * pairs two consecutive slides with identical geometry so the swipe itself does
 * the comparison (the strongest form of this pattern).
 */
export function contrastSplitLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as ContrastSplitSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP, maxWidth: CW, font: displayFont(ctx, 700), color: p.text,
    maxLines: 2, fit: { min: ctx.theme.typography.headline_px * 0.56 },
  });
  nodes.push(...headline.nodes);
  const top = CONTENT_TOP + headline.height + 54;

  const paired = slide.mode !== 'split';
  const panelW = paired ? CW : (CW - GAP) / 2;
  // A verdict sits directly under the card and owns 132px of it, so the panel has to
  // stop short. (0.1.0 drew the label at a fixed y and it collided with the border.)
  const verdictBlock = slide.verdict ? 132 : 0;
  const panelLimit = CONTENT_BOTTOM - 24 - verdictBlock - top;
  const panelH = Math.max(300, Math.min(paired ? 560 : 600, panelLimit));

  const drawSide = (x: number, side: ContrastSplitSlideT['left'], tone: 'before' | 'after') => {
    const isAfter = tone === 'after';
    const accent = isAfter ? p.accent : p.textMuted;
    const fill = isAfter ? withAlpha(p.accent, 0.1) : withAlpha(p.text, 0.045);
    const icon = side.icon ?? (isAfter ? 'check' : 'x');
    nodes.push(...panel(ctx, { x, y: top, w: panelW, h: panelH, fill, stroke: withAlpha(accent, 0.35), rx: 22, shadow: false }));
    // Tone header: never rely on hue alone — icon + word carry the meaning.
    nodes.push(...pill(ctx, x + 32, top + 32, side.label, {
      fill: isAfter ? p.accent : withAlpha(p.text, 0.1),
      color: isAfter ? p.accentText : p.textSecondary,
      size: 24,
    }));
    nodes.push(...drawIcon(x + panelW - 32 - 46, top + 34, 46, icon, {
      color: accent, strokeWidth: 2.4,
    }));
    let cursor = top + 118;
    if (side.text) {
      const body = paragraph(stripUnsupported(side.text), {
        x: x + 32, y: cursor, maxWidth: panelW - 64,
        font: bodyFont(ctx, paired ? 44 : 36, isAfter ? 600 : 400),
        color: isAfter ? p.text : p.textSecondary, maxLines: paired ? 3 : 4,
      });
      nodes.push(...body.nodes);
      cursor += body.height + 26;
    }
    (side.items ?? []).forEach((item, i) => {
      const rowY = cursor + i * (paired ? 62 : 54);
      nodes.push(...drawIcon(x + 34, rowY - 22, 26, isAfter ? 'check' : 'x', { color: accent, strokeWidth: 2.4 }));
      nodes.push(...paragraph(stripUnsupported(item), {
        x: x + 74, y: rowY - 8, maxWidth: panelW - 108,
        font: bodyFont(ctx, paired ? 32 : 28), color: p.textSecondary, maxLines: 2,
      }).nodes);
    });
  };

  if (paired) {
    const side = slide.mode === 'before' ? slide.left : slide.right;
    drawSide(M, side, slide.mode === 'before' ? 'before' : 'after');
  } else {
    drawSide(M, slide.left, 'before');
    drawSide(M + panelW + GAP, slide.right, 'after');
  }

  if (slide.verdict) {
    const labelY = top + panelH + 40;
    nodes.push(text(M, labelY, 'VERDICT', {
      family: ctx.theme.typography.mono_font, size: 22, weight: 600, letterSpacing: 2.4, fill: p.textMuted,
    }));
    nodes.push(...paragraph(stripUnsupported(slide.verdict), {
      x: M, y: labelY + 18, maxWidth: CW,
      font: { ...bodyFont(ctx, 32, 600), style: 'italic' }, color: p.accent, maxLines: 2,
    }).nodes);
  }
  return nodes;
}
