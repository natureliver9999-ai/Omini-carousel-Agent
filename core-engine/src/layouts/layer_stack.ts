import { withAlpha } from '../colors.js';
import { rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M,
  bodyFont, displayFont, panel, type SlideContext,
} from '../scene.js';
import type { LayerStackSlideT } from '../schema.js';
import { drawIcon } from '../icons.js';

/** How many consecutive `layer_stack` slides precede (and include) this one. */
export function layerSequencePosition(ctx: SlideContext): number {
  let position = 0;
  for (let i = ctx.index - 1; i >= 0; i--) {
    if (ctx.spec.slides[i]?.layout === 'layer_stack') position += 1;
    else break;
  }
  return position;
}

/**
 * Progressive disclosure: identical geometry every swipe, one more lit layer.
 * Geometry is frozen by design so the *only* thing that changes is understanding.
 */
export function layerStackLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as LayerStackSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP, maxWidth: CW * 0.92, font: displayFont(ctx, 700), color: p.text,
    maxLines: 2, fit: { min: ctx.theme.typography.headline_px * 0.52 },
  });
  nodes.push(...headline.nodes);

  const totalLayers = slide.total_layers ?? slide.layers.length;
  const active = Math.min(totalLayers, slide.active_layers ?? layerSequencePosition(ctx) + 1);

  // Counter pill: tells the reader there is a finite, small amount left.
  const counter = `LAYER ${active} OF ${totalLayers}`;
  const counterFont = { family: ctx.theme.typography.mono_font, size: 24, weight: 700, letterSpacing: 2.2 };
  nodes.push(text(M, CONTENT_TOP + headline.height + 24, counter, {
    family: counterFont.family, size: counterFont.size, weight: counterFont.weight, letterSpacing: counterFont.letterSpacing,
    fill: p.accent,
  }));

  const listTop = CONTENT_TOP + headline.height + 54;
  const available = CONTENT_BOTTOM - 20 - listTop;
  const gap = 16;
  const rowH = Math.min(190, (available - gap * (totalLayers - 1)) / totalLayers);

  slide.layers.slice(0, totalLayers).forEach((layer, i) => {
    const y = listTop + i * (rowH + gap);
    const isActive = i < active;
    const isNew = i === active - 1;
    if (isActive) {
      nodes.push(...panel(ctx, {
        x: M, y, w: CW, h: rowH,
        fill: isNew ? withAlpha(p.accent, 0.12) : p.surface,
        stroke: isNew ? p.accent : withAlpha(p.text, 0.12),
        strokeWidth: isNew ? 2.5 : 1.5,
        rx: 18, shadow: false,
      }));
      nodes.push(rect(M, y + 18, 6, rowH - 36, p.accent, { rx: 3 }));
    } else {
      nodes.push(rect(M, y, CW, rowH, 'none', {
        rx: 18, stroke: withAlpha(p.text, 0.22), strokeWidth: 1.5, dash: '8 10',
      }));
    }

    const badge = 54;
    const bx = M + 34;
    const by = y + (rowH - badge) / 2;
    nodes.push(rect(bx, by, badge, badge, isActive ? p.accent : withAlpha(p.text, 0.08), { rx: 14 }));
    if (isActive) {
      nodes.push(text(bx + badge / 2, by + badge / 2 + 11, String(i + 1), {
        family: ctx.theme.typography.display_font, size: 30, weight: 700, fill: p.accentText, anchor: 'middle',
      }));
    } else {
      nodes.push(...drawIcon(bx + 15, by + 15, 24, 'lock', { color: withAlpha(p.text, 0.45), strokeWidth: 2 }));
    }

    const textX = bx + badge + 26;
    const textW = CW - (textX - M) - 40;
    const label = paragraph(stripUnsupported(layer.label), {
      x: textX, y: y + (layer.detail ? 26 : rowH / 2 - 26), maxWidth: textW,
      font: bodyFont(ctx, 34, 600), color: isActive ? p.text : withAlpha(p.text, 0.4), maxLines: 2,
    });
    nodes.push(...label.nodes);
    if (layer.detail) {
      const detail = paragraph(stripUnsupported(layer.detail), {
        x: textX, y: y + 26 + label.height + 8, maxWidth: textW,
        font: bodyFont(ctx, 26), color: isActive ? p.textMuted : withAlpha(p.text, 0.28), maxLines: 2,
      });
      nodes.push(...detail.nodes);
    }
  });
  return nodes;
}
