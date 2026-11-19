import { hashString } from '../colors.js';
import { withAlpha } from '../colors.js';
import { group, rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, textWidth } from '../text.js';
import {
  CONTENT_TOP, CONTENT_BOTTOM, CW, M,
  bodyFont, displayFont, panel, slideId, tapeStrip, type SlideContext,
} from '../scene.js';
import type { ScrapbookSlideT } from '../schema.js';

/**
 * The anti-template slide: craft paper, tape, handwriting, and a *deterministic*
 * micro-rotation (±2.5") derived from a hash of the slide id. Same spec in, same
 * pixels out — but it never looks machine-extruded.
 */
export function scrapbookLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as ScrapbookSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];
  const seed = hashString(slideId(ctx));
  // Map the hash onto [-2.5, 2.5] degrees, never Math.random().
  const rotation = ((seed % 1000) / 1000) * 5 - 2.5;

  const cardX = M + 8;
  const cardY = CONTENT_TOP + 20;
  const cardW = CW - 40;
  const cardH = 720;

  const cardChildren: Node[] = [];
  cardChildren.push(...panel(ctx, {
    x: cardX, y: cardY, w: cardW, h: cardH,
    fill: withAlpha(p.surface, 0.98), stroke: withAlpha(p.text, 0.14), rx: ctx.theme.radii.card,
  }));

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: cardX + 44, y: cardY + 56, maxWidth: cardW - 88,
    font: { ...displayFont(ctx, 700), size: Math.min(78, ctx.theme.typography.headline_px * 0.78) },
    color: p.text, maxLines: 3, fit: { min: 40 },
  });
  cardChildren.push(...headline.nodes);

  // Marker underline under the line that contains the target word.
  if (slide.underline_word) {
    const target = slide.underline_word.toLowerCase();
    const lineIndex = headline.lines.findIndex((line) => line.toLowerCase().includes(target));
    if (lineIndex >= 0) {
      const lineText = headline.lines[lineIndex];
      const prefix = lineText.slice(0, lineText.toLowerCase().indexOf(target));
      const font = { family: ctx.theme.typography.display_font, size: headline.fontSize, weight: 700 };
      const offset = textWidth(prefix, font);
      const wordW = textWidth(slide.underline_word, font);
      const y = cardY + 56 + headline.fontSize * (0.9 + lineIndex * 1.02);
      const pts: string[] = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const px = cardX + 44 + offset + (wordW / steps) * i;
        const py = y + Math.sin(i * 2.1) * 3;
        pts.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      cardChildren.push(rect(cardX + 44 + offset - 4, y - 6, wordW + 8, 14, withAlpha(p.accentSoft, 0.85), { rx: 6 }));
      cardChildren.push({
        type: 'path', d: pts.join(''), fill: 'none', stroke: withAlpha(p.accent, 0.8), strokeWidth: 5, linecap: 'round',
      });
    }
  }

  let cursor = cardY + 56 + headline.height + 40;
  const note = paragraph(stripUnsupported(slide.note), {
    x: cardX + 44, y: cursor, maxWidth: cardW - 88, font: bodyFont(ctx, 34), color: p.textSecondary, maxLines: 6,
  });
  cardChildren.push(...note.nodes);
  cursor += note.height + 30;

  if (slide.callout) {
    const callout = paragraph(stripUnsupported(slide.callout), {
      x: cardX + 44, y: cursor, maxWidth: cardW - 88,
      font: { family: ctx.theme.typography.mono_font, size: 56, weight: 700, lineHeight: 1.2 },
      color: p.accent, maxLines: 2,
    });
    cardChildren.push(...callout.nodes);
  }

  nodes.push(group(cardChildren, { rotate: rotation, rotateOrigin: [cardX + cardW / 2, cardY + 240] }));
  nodes.push(...tapeStrip(ctx, cardX + 30, cardY - 22, 190, -6));
  nodes.push(...tapeStrip(ctx, cardX + cardW - 220, cardY + cardH - 16, 190, 4));

  if (slide.sticker) {
    const label = stripUnsupported(slide.sticker).toUpperCase();
    const font = { family: ctx.theme.typography.body_font, size: 26, weight: 700, letterSpacing: 1.4 };
    const w = textWidth(label, font) + 46;
    const sx = cardX + cardW - w - 20;
    const sy = cardY - 34;
    nodes.push(group([
      rect(sx, sy, w, 58, p.accent, { rx: 10 }),
      text(sx + w / 2, sy + 39, label, {
        family: font.family, size: font.size, weight: font.weight, letterSpacing: font.letterSpacing,
        fill: p.accentText, anchor: 'middle',
      }),
    ], { rotate: 6, rotateOrigin: [sx + w / 2, sy + 29] }));
  }

  // A second, smaller note card overlaps the bottom of the page for depth.
  const noteY = CONTENT_BOTTOM - 150;
  nodes.push(...panel(ctx, {
    x: M + 44, y: noteY, w: CW - 220, h: 130,
    fill: withAlpha(p.accentSoft, 0.55), stroke: withAlpha(p.text, 0.12), rx: 6, shadow: false,
  }));
  const aside = paragraph(stripUnsupported(slide.footer_hook ?? 'Save this for the next time it comes up.'), {
    x: M + 72, y: noteY + 26, maxWidth: CW - 280,
    font: { family: ctx.theme.typography.mono_font, size: 34, weight: 600, lineHeight: 1.3 },
    color: p.text, maxLines: 2,
  });
  nodes.push(...aside.nodes);
  return nodes;
}
