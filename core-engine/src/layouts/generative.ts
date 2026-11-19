import { withAlpha } from '../colors.js';
import { rect, text, type Node } from '../svg.js';
import { paragraph, stripUnsupported, textWidth } from '../text.js';
import {
  CONTENT_BOTTOM, CONTENT_TOP, CW, M, W,
  bodyFont, displayFont, eyebrowText, monoFont, slideId, type SlideContext,
} from '../scene.js';
import { ART_LABELS, artSignature, framedArt, pickArtStyle, type ArtStyle } from '../generative.js';
import type { GenerativeSlideT } from '../schema.js';

/**
 * Generative Plot.
 *
 * The engine's answer to "make it look like something": a seeded vector
 * composition plotted inside a framed field, with the slide's one line
 * underneath and the seed printed on the frame like a lab result. Nothing is
 * fetched, nothing is stock, and the same spec always yields the same drawing.
 */
export function generativeLayout(ctx: SlideContext): Node[] {
  const slide = ctx.slide as GenerativeSlideT;
  const p = ctx.palette;
  const nodes: Node[] = [];
  const mono = monoFont(ctx, 19, 500);

  const deckArt = (ctx.spec as { art?: { seed?: string; density?: number } }).art;
  const seed = slide.art?.seed ?? `${deckArt?.seed ?? ctx.spec.id ?? ctx.spec.title ?? 'omni'}-${slideId(ctx)}`;
  const style: ArtStyle = slide.art?.style ?? pickArtStyle(seed);
  const density = slide.art?.density ?? deckArt?.density ?? 0.55;
  const opacity = slide.art?.opacity ?? 1;

  /* ---- caption row: figure name left, instrument read-outs right ---- */
  const captionBaseline = CONTENT_TOP + 16;
  const figure = stripUnsupported(slide.figure_label ?? `FIG. ${String(ctx.index + 1).padStart(2, '0')} — ${ART_LABELS[style]}`).toUpperCase();
  nodes.push(eyebrowText(ctx, M, captionBaseline, figure, { color: withAlpha(p.text, 0.78) }));
  const fullReadout = `SEED ${artSignature(seed)} · ${ART_LABELS[style].toUpperCase()} · ${(density * 100).toFixed(0)}%`;
  const shortReadout = `SEED ${artSignature(seed)} · ${(density * 100).toFixed(0)}%`;
  const readoutFont = { family: mono.family, size: 19, weight: 500, letterSpacing: 1.3 };
  const figureWidth = textWidth(figure, { ...readoutFont, size: ctx.theme.typography.eyebrow_px });
  const readout = figureWidth + textWidth(fullReadout, readoutFont) > CW - 28 ? shortReadout : fullReadout;
  nodes.push(text(W - M, captionBaseline, readout, {
    family: mono.family, size: 19, weight: 500, fill: withAlpha(p.text, 0.5), anchor: 'end', letterSpacing: 1.3,
  }));
  nodes.push(rect(M, CONTENT_TOP + 34, CW, 1, p.hairline));

  /* ---- measure the copy first, then give the plot what is left ---- */
  const headlineText = stripUnsupported(slide.headline);
  const annotations = slide.annotations ?? [];
  const maxHeadlineLines = annotations.length > 0 ? 2 : 3;
  const measureHeadline = (size: number) =>
    paragraph(headlineText, {
      x: M, y: 0,
      maxWidth: CW * (maxHeadlineLines === 2 ? 0.96 : 1),
      font: { ...displayFont(ctx, 700), size, lineHeight: 1.06 },
      color: p.text,
      maxLines: maxHeadlineLines,
    });
  let size = 74;
  let measured = measureHeadline(size);
  while (measured.height > (maxHeadlineLines === 2 ? 160 : 250) && size > 52) {
    size -= 4;
    measured = measureHeadline(size);
  }
  const subMeasure = slide.sub
    ? paragraph(stripUnsupported(slide.sub), {
        x: M, y: 0, maxWidth: CW * 0.92,
        font: { ...bodyFont(ctx, 33, 400), lineHeight: 1.32 }, color: p.textSecondary, maxLines: 2,
      })
    : undefined;
  const legendRows = Math.min(annotations.length, 3);
  const copyHeight =
    measured.height +
    (subMeasure ? subMeasure.height + 26 : 0) +
    (legendRows > 0 ? legendRows * 44 + 10 : 0);

  const plotTop = CONTENT_TOP + 58;
  const plotH = Math.round(Math.min(700, Math.max(330, CONTENT_BOTTOM - 20 - copyHeight - 52 - plotTop)));
  const zone = { x: M, y: plotTop, w: CW, h: plotH };
  nodes.push(rect(zone.x, zone.y, zone.w, zone.h, withAlpha(p.text, p.isDark ? 0.05 : 0.028)));

  // Graph-paper register: four columns, three rows, at hairline weight.
  const gridColor = withAlpha(p.text, 0.07);
  for (let i = 1; i < 4; i++) nodes.push(rect(zone.x + (zone.w / 4) * i, zone.y, 1, zone.h, gridColor));
  for (let i = 1; i < 3; i++) nodes.push(rect(zone.x, zone.y + (zone.h / 3) * i, zone.w, 1, gridColor));

  nodes.push(...framedArt(p, { zone, style, seed, density, opacity }));

  /* ---- headline + support ---- */
  const headlineTop = plotTop + plotH + 46;
  const headline = paragraph(headlineText, {
    x: M, y: headlineTop,
    maxWidth: CW * (maxHeadlineLines === 2 ? 0.96 : 1),
    font: { ...displayFont(ctx, 700), size, lineHeight: 1.06 },
    color: p.text,
    maxLines: maxHeadlineLines,
  });
  nodes.push(...headline.nodes);

  let cursor = headlineTop + headline.height + 24;
  if (slide.sub && subMeasure) {
    const sub = paragraph(stripUnsupported(slide.sub), {
      x: M, y: cursor, maxWidth: CW * 0.92,
      font: { ...bodyFont(ctx, 33, 400), lineHeight: 1.32 }, color: p.textSecondary, maxLines: 2,
    });
    nodes.push(...sub.nodes);
    cursor += sub.height + 26;
  }

  /* ---- plotter legend: rows that fit, never a squeezed fourth ---- */
  if (annotations.length > 0) {
    const rowH = 44;
    const room = CONTENT_BOTTOM - 14 - cursor;
    const fit = Math.max(0, Math.min(annotations.length, Math.floor(room / rowH)));
    annotations.slice(0, fit).forEach((row, i) => {
      const y = cursor + i * rowH;
      const rowFont = monoFont(ctx, 23, 500);
      nodes.push(text(M, y + 22, String(i + 1).padStart(2, '0'), {
        family: rowFont.family, size: 18, weight: 500, fill: p.accent, letterSpacing: 1,
      }));
      const label = stripUnsupported(row);
      nodes.push(text(M + 44, y + 22, label, {
        family: rowFont.family, size: rowFont.size, weight: 500, fill: p.textMuted,
      }));
      // Hairline leader: reads as a plot legend, not a bullet list.
      const leaderStart = M + 44 + textWidth(label, rowFont) + 16;
      if (M + CW - leaderStart > 30) nodes.push(rect(leaderStart, y + 17, M + CW - leaderStart, 1, withAlpha(p.text, 0.16)));
      if (i < fit - 1) nodes.push(rect(M, y + rowH - 12, CW, 1, withAlpha(p.text, 0.07)));
    });
  }

  return nodes;
}
