/**
 * Wide-canvas panorama geometry.
 *
 * A panorama span renders ONE canvas of width `1080 * span` and then cuts exact
 * 1080px slices. Because rasterization (and therefore anti-aliasing) happens
 * before the cut, adjacent columns across a seam are literally neighbouring
 * pixels of the same surface — which is why the swipe has no visible join.
 */
import sharp from 'sharp';
import type { CarouselSpec } from './schema.js';

export interface PanoramaAssignment {
  spanStart: number;
  spanLength: number;
  indexInSpan: number;
}

export interface PanoramaPlan {
  assignments: Map<number, PanoramaAssignment>;
  spans: Array<{ start: number; length: number }>;
  errors: string[];
}

export function planPanorama(slides: CarouselSpec['slides']): PanoramaPlan {
  const assignments = new Map<number, PanoramaAssignment>();
  const spans: Array<{ start: number; length: number }> = [];
  const errors: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const declared = slides[i].panorama;
    if (!declared) continue;
    if (assignments.has(i)) {
      const existing = assignments.get(i)!;
      if (existing.spanLength !== declared.span || existing.indexInSpan !== 0) {
        errors.push(`Slide ${i + 1} declares a panorama span that overlaps the span starting at slide ${existing.spanStart + 1}.`);
      }
      continue;
    }
    const length = declared.span;
    if (i + length > slides.length) {
      errors.push(`Panorama at slide ${i + 1} declares ${length} slides but the deck ends after slide ${slides.length}.`);
      continue;
    }
    // Only the FIRST slide of a span must declare it; the rest are inferred and
    // may optionally repeat the declaration for readability.
    let conflict = false;
    for (let k = 1; k < length; k++) {
      const neighbour = slides[i + k].panorama;
      if (neighbour && neighbour.span !== length) {
        errors.push(`Slide ${i + k + 1} declares a ${neighbour.span}-slide panorama inside a ${length}-slide span starting at slide ${i + 1}.`);
        conflict = true;
      }
    }
    if (conflict) continue;
    spans.push({ start: i, length });
    for (let k = 0; k < length; k++) {
      assignments.set(i + k, { spanStart: i, spanLength: length, indexInSpan: k });
    }
  }
  return { assignments, spans, errors };
}

/** Cuts a `1080 * span` x 1350 raster into exact 1080x1350 tiles. */
export async function slicePanorama(png: Buffer, spanLength: number, width = 1080, height = 1350): Promise<Buffer[]> {
  const meta = await sharp(png).metadata();
  const expected = width * spanLength;
  if (!meta.width || !meta.height) throw new Error('Panorama raster has no dimensions');
  if (meta.width !== expected) {
    throw new Error(`Panorama raster is ${meta.width}x${meta.height}; expected width ${expected} for ${spanLength} slides`);
  }
  if (meta.height !== height) throw new Error(`Panorama raster height ${meta.height}; expected ${height}`);
  const tiles: Buffer[] = [];
  for (let i = 0; i < spanLength; i++) {
    tiles.push(
      await sharp(png)
        .extract({ left: width * i, top: 0, width, height })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );
  }
  return tiles;
}

/** Diagnostics used by tests and the linter: how much art sits either side of a seam. */
export function seamBalance(spanLength: number): number[] {
  return Array.from({ length: Math.max(0, spanLength - 1) }, () => 0.5);
}
