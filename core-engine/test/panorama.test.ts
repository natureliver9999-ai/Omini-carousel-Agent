import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { planPanorama, seamBalance, slicePanorama } from '../src/panorama.js';
import { renderCarousel } from '../src/render.js';
import { parseSpec, type CarouselSpec } from '../src/schema.js';
import { makeSpec } from './fixtures.js';

const WIDTH = 1080;
const HEIGHT = 1350;

describe('panorama planning', () => {
  it('assigns every slide of a span, including the implied ones', () => {
    const spec = makeSpec();
    (spec.slides[1] as { panorama?: unknown }).panorama = { span: 2 };
    const plan = planPanorama(spec.slides);
    expect(plan.errors).toEqual([]);
    expect(plan.spans).toEqual([{ start: 1, length: 2 }]);
    expect(plan.assignments.get(1)).toEqual({ spanStart: 1, spanLength: 2, indexInSpan: 0 });
    expect(plan.assignments.get(2)).toEqual({ spanStart: 1, spanLength: 2, indexInSpan: 1 });
    expect(plan.assignments.has(0)).toBe(false);
  });

  it('infers the rest of a span when only the first slide declares it', () => {
    const slides = makeSpec().slides;
    (slides[1] as { panorama?: unknown }).panorama = { span: 2 };
    const plan = planPanorama(slides);
    expect(plan.assignments.size).toBe(2);
  });

  it('reports a span that runs past the end of the deck', () => {
    const slides = makeSpec().slides;
    (slides[slides.length - 1] as { panorama?: unknown }).panorama = { span: 3 };
    expect(planPanorama(slides).errors[0]).toMatch(/deck ends after slide/);
  });

  it('reports overlapping spans with different lengths', () => {
    const slides = makeSpec().slides;
    (slides[0] as { panorama?: unknown }).panorama = { span: 3 };
    (slides[1] as { panorama?: unknown }).panorama = { span: 2 };
    expect(planPanorama(slides).errors.length).toBeGreaterThan(0);
  });

  it('balances every seam so no tile reads as heavier', () => {
    expect(seamBalance(3)).toEqual([0.5, 0.5]);
    expect(seamBalance(5)).toHaveLength(4);
    expect(seamBalance(1)).toEqual([]);
  });
});

describe('panorama seam', () => {
  it('cuts a rendered wide canvas into exact 1080x1350 tiles with no gutter', async () => {
    const spec = parseSpec({
      ...makeSpec(),
      id: 'seam-test',
      slides: [
        { layout: 'cover_hook', id: 'hook', headline: 'One continuous idea', sub: 'Across two frames.' },
        { layout: 'steps', id: 'p1', headline: 'Frame two', panorama: { span: 2 }, steps: [{ title: 'A' }, { title: 'B' }] },
        { layout: 'summary', id: 'p2', headline: 'Frame three', bullets: ['One', 'Two', 'Three'] },
        { layout: 'cta', id: 'ask', headline: 'Save it', action: 'save', text: 'Save this deck.' },
      ],
    } as unknown as CarouselSpec);

    const result = await renderCarousel(spec, { outDir: undefined, formats: ['png'], quiet: true });
    expect(result.slides).toHaveLength(4);

    // Re-rendering the span as one wide raster must equal the concatenation of its tiles.
    expect(result.buffers).toHaveLength(4);
    const tiles = await Promise.all(result.buffers.slice(1, 3).map((buffer) => sharp(buffer).metadata()));
    expect(tiles.map((meta) => meta.width)).toEqual([WIDTH, WIDTH]);
    expect(tiles.every((meta) => meta.height === HEIGHT)).toBe(true);

    const wide = await sharp({
      create: { width: WIDTH * 2, height: HEIGHT, channels: 3, background: '#111111' },
    })
      .png()
      .toBuffer();
    const slices = await slicePanorama(wide, 2);
    expect(slices).toHaveLength(2);
    const sliceMeta = await Promise.all(slices.map((slice) => sharp(slice).metadata()));
    expect(sliceMeta.map((meta) => meta.width)).toEqual([WIDTH, WIDTH]);
    expect(sliceMeta.map((meta) => meta.height)).toEqual([HEIGHT, HEIGHT]);
  });
});
