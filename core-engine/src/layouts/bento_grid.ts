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
/** Even distribution: `rows` rows that differ by at most one tile, every row flush. */
function balancedRows(count: number): number[] {
  const rows = Math.max(1, Math.ceil(count / 3));
  const base = Math.floor(count / rows);
  const remainder = count % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < remainder ? 1 : 0));
}

function flushSpans(count: number): number[] {
  const spans = Array.from({ length: count }, () => Math.max(1, Math.floor(COLS / count)));
  let leftover = COLS - spans.reduce((sum, span) => sum + span, 0);
  let index = 0;
  while (leftover > 0) {
    spans[index % spans.length] += 1;
    leftover -= 1;
    index += 1;
  }
  return spans;
}

/**
 * Deterministic 6-column packing. Explicit `span` hints are honoured while they
 * keep the grid balanced; if greedy packing would strand a tile alone on the last
 * row (nine tiles used to do exactly that), the grid reflows into even rows.
 */
function packTiles(tiles: BentoGridSlideT['tiles']): { placements: Placement[]; rows: number } {
  const spanFor = (tile: BentoGridSlideT['tiles'][number]) =>
    tile.span === 2 ? 3 : tile.span === 1 ? 2 : tiles.length <= 4 ? 3 : 2;

  type Tile = BentoGridSlideT['tiles'][number];
  const greedy: Tile[][] = [];
  let current: Tile[] = [];
  let used = 0;
  for (const tile of tiles) {
    const span = spanFor(tile);
    if (used + span > COLS && current.length > 0) {
      greedy.push(current);
      current = [];
      used = 0;
    }
    current.push(tile);
    used += span;
  }
  if (current.length > 0) greedy.push(current);

  const stranded = greedy.length > 1 && greedy[greedy.length - 1].length === 1 && tiles.length >= 4;
  const rows: Tile[][] = stranded
    ? balancedRows(tiles.length).reduce<Tile[][]>((acc, count) => {
      const start = acc.reduce((sum, row) => sum + row.length, 0);
      acc.push(tiles.slice(start, start + count));
      return acc;
    }, [])
    : greedy;

  const placements: Placement[] = [];
  rows.forEach((rowTiles, row) => {
    const spans: number[] = stranded
      ? flushSpans(rowTiles.length)
      : (() => {
        const base: number[] = rowTiles.map((tile) => spanFor(tile));
        let leftover = COLS - base.reduce((sum, span) => sum + span, 0);
        let index = 0;
        while (leftover > 0) {
          base[index % base.length] += 1;
          leftover -= 1;
          index += 1;
        }
        return base;
      })();
    let col = 0;
    rowTiles.forEach((tile, i) => {
      placements.push({ tile, col, span: spans[i], row });
      col += spans[i];
    });
  });
  return { placements, rows: rows.length };
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
