import { withAlpha } from '../colors.js';
import { text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, textWidth } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M,
  bodyFont, displayFont, panel, type SlideContext,
} from '../scene.js';
import type { BentoGridSlideT } from '../schema.js';
import { drawIcon } from '../icons.js';

const COLS = 6;
const GAP = 16;

interface Placement { tile: BentoGridSlideT['tiles'][number]; col: number; span: number; row: number }

/** Deterministic 6-column packing: no ragged orphan cells, no randomness. */
function packTiles(tiles: BentoGridSlideT['tiles']): { placements: Placement[]; rows: number } {
  const defaultSpan = tiles.length <= 4 ? 3 : 2;
  const placements: Placement[] = [];
  let row = 0;
  let col = 0;
  for (const tile of tiles) {
    const span = tile.span === 2 ? 3 : tile.span === 1 ? 2 : defaultSpan;
    if (col + span > COLS) { row += 1; col = 0; }
    placements.push({ tile, col, span, row });
    col += span;
    if (col >= COLS) { row += 1; col = 0; }
  }
  const rows = placements.reduce((max, p) => Math.max(max, p.row), 0) + 1;
  return { placements, rows };
}

export function bentoGridLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as BentoGridSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];

  const headline = paragraph(stripUnsupported(slide.headline), {
    x: M, y: CONTENT_TOP, maxWidth: CW * 0.92, font: displayFont(ctx, 700), color: p.text,
    maxLines: 2, fit: { min: ctx.theme.typography.headline_px * 0.5 },
  });
  nodes.push(...headline.nodes);

  const gridTop = CONTENT_TOP + headline.height + 44;
  const gridH = CONTENT_BOTTOM - gridTop;
  const { placements, rows } = packTiles(slide.tiles);
  const colW = (CW - GAP * (COLS - 1)) / COLS;
  const rowH = (gridH - GAP * (rows - 1)) / rows;

  for (const { tile, col, span, row } of placements) {
    const x = M + col * (colW + GAP);
    const y = gridTop + row * (rowH + GAP);
    const w = colW * span + GAP * (span - 1);
    const accentTile = tile.accent === true;
    nodes.push(...panel(ctx, {
      x, y, w, h: rowH,
      fill: accentTile ? p.accent : p.surface,
      stroke: accentTile ? p.accent : withAlpha(p.text, 0.12),
      rx: ctx.theme.radii.tile,
      shadow: false,
    }));

    const color = accentTile ? p.accentText : p.text;
    const muted = accentTile ? withAlpha(p.accentText, 0.78) : p.textMuted;
    const labelFont = { family: ctx.theme.typography.body_font, size: 21, weight: 700, letterSpacing: 1.6 };
    const label = stripUnsupported(tile.label).toUpperCase();
    nodes.push(text(x + 22, y + 40, label.length > 22 ? `${label.slice(0, 21)}…` : label, {
      family: labelFont.family, size: labelFont.size, weight: labelFont.weight, letterSpacing: labelFont.letterSpacing,
      fill: muted,
    }));

    if (tile.icon) {
      nodes.push(...drawIcon(x + w - 52, y + 22, 30, tile.icon, { color: accentTile ? p.accentText : p.accent, strokeWidth: 2 }));
    }

    // Bottom-up composition: the number sits on a baseline near the tile's lower
    // third so tall tiles read as designed rather than half-empty.
    const maxValueW = w - 44;
    let valueSize = Math.min(Math.max(56, rowH * 0.32), 104);
    if (tile.value) {
      // Big numbers/words are the tile's hero — but a hero that overflows its panel
      // reads as a bug. Measure and shrink before drawing.
      const measured = textWidth(stripUnsupported(tile.value), { ...displayFont(ctx, 700), size: valueSize });
      if (measured > maxValueW) valueSize = Math.max(38, Math.floor((valueSize * maxValueW) / measured));
    }
    const bodySize = Math.min(28, Math.max(20, rowH * 0.085));
    const bodyBlock = tile.text
      ? paragraph(stripUnsupported(tile.text), {
        x: x + 22, y: 0, maxWidth: w - 44,
        font: bodyFont(ctx, bodySize, 500), color: muted, maxLines: 2,
      })
      : null;
    const bodyH = bodyBlock ? bodyBlock.height : 0;
    const bottom = y + rowH - 24;
    const bodyTop = bottom - bodyH;
    const valueBaseline = tile.value ? bodyTop - 20 : bottom;
    if (tile.value) {
      nodes.push(text(x + 22, valueBaseline, stripUnsupported(tile.value), {
        family: ctx.theme.typography.display_font, size: valueSize, weight: 700, fill: color,
      }));
    } else if (tile.text) {
      // No number: the text itself becomes the hero, anchored to the bottom.
      const hero = paragraph(stripUnsupported(tile.text), {
        x: x + 22, y: bottom - 40 - Math.min(rowH * 0.5, 120), maxWidth: w - 44,
        font: { ...displayFont(ctx, 700), size: 40, lineHeight: 1.14 }, color, maxLines: 3,
        fit: { min: 24 },
      });
      nodes.push(...hero.nodes);
    }
    if (bodyBlock && tile.text) {
      nodes.push(...paragraph(stripUnsupported(tile.text), {
        x: x + 22, y: bodyTop, maxWidth: w - 44,
        font: bodyFont(ctx, bodySize, 500), color: muted, maxLines: 2,
      }).nodes);
    }
  }
  return nodes;
}
