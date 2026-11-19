import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSpec, type CarouselSpec } from '../src/schema.js';
import { renderCarousel } from '../src/render.js';

/**
 * Determinism guard. If these hashes change, either the rendering changed on
 * purpose (re-run with `UPDATE_GOLDEN=1 npm test`) or a dependency silently
 * moved a pixel. Both deserve a human look before merge.
 */
const goldenPath = path.resolve(__dirname, 'golden', 'slides.json');
const update = process.env.UPDATE_GOLDEN === '1';

const spec = parseSpec({
  version: '1.0',
  id: 'golden-deck',
  platform: 'instagram',
  goal: 'saves',
  theme: 'editorial',
  brand: { name: 'Golden', handle: 'golden' },
  caption: { text: 'Deterministic output is a feature, not an accident. Save this deck for the next regression hunt.' },
  slides: [
    {
      layout: 'cover_hook',
      id: 'hook',
      eyebrow: 'GOLDEN',
      headline: 'Same input, same pixels',
      sub: 'Every time, on every machine.',
      icon: 'spark',
      badge: 'CI',
    },
    {
      layout: 'data_chart',
      id: 'chart',
      headline: 'Engagement by format',
      chart: { kind: 'bar', labels: ['Carousel', 'Reel', 'Image'], values: [0.55, 0.48, 0.41], unit: '%' },
      source: 'Socialinsider Instagram benchmarks 2026',
      takeaway: 'Carousels lead on engagement rate.',
    },
    {
      layout: 'steps',
      id: 'steps',
      headline: 'Three steps to a stable build',
      steps: [{ title: 'Freeze fonts', detail: 'Bundle the TTFs.' }, { title: 'Pin the renderer' }, { title: 'Hash the output' }],
    },
    {
      // Regression guard for the 0.1.0 collision: a verdict label must not touch the card.
      layout: 'contrast_split',
      id: 'contrast',
      headline: 'Two ways to see it',
      mode: 'after',
      left: { label: 'Before', text: 'Bathtub curve guesses.', items: ['No source', 'No budget'] },
      right: { label: 'After', text: 'Measured, cited, budgeted.', items: ['Named source', 'Copy budget'] },
      verdict: 'The lexicon matters more than the length.',
    },
    {
      // Regression guard for hero values overflowing their tile.
      layout: 'bento_grid',
      id: 'bento',
      headline: 'Six boxes, one system',
      tiles: [
        { label: 'Engine', value: 'Pixels' },
        { label: 'Storage', value: 'Files' },
        { label: 'Proof', value: 'Source' },
        { label: 'Host', value: 'Model' },
      ],
    },
    {
      // Regression guard: teaser label must truncate to the on-canvas part, the hint
      // must sit under the body, and footer_hook must not collide with the counter.
      layout: 'reveal_hold',
      id: 'reveal',
      headline: 'Frame two introduces, it should raise a stake',
      body: 'A frame that only sets context asks the reader to invest before giving them a reason. The next slide has to pay that back instantly.',
      teaser_label: 'The fix is one rule',
      footer_hook: 'Next frame: the rule',
    },
    {
      layout: 'cta',
      id: 'ask',
      headline: 'Save the hash',
      action: 'save',
      text: 'Save this deck, then run the golden test before you ship a theme change.',
    },
  ],
} as unknown as CarouselSpec);

const sha = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

describe('golden images', () => {
  it('renders byte-identical slides across runs and matches the committed hashes', async () => {
    const first = await renderCarousel(spec, { formats: ['png'], quiet: true });
    const second = await renderCarousel(spec, { formats: ['png'], quiet: true });

    expect(first.renderer).toBe('resvg');
    expect(first.slides).toHaveLength(7);

    const hashes = first.buffers.map((buffer) => sha(buffer));
    const repeat = second.buffers.map((buffer) => sha(buffer));
    expect(repeat).toEqual(hashes);

    if (update || !existsSync(goldenPath)) {
      mkdirSync(path.dirname(goldenPath), { recursive: true });
      writeFileSync(goldenPath, `${JSON.stringify({ spec: 'golden-deck', hashes }, null, 2)}\n`);
    }

    const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as { hashes: string[] };
    expect(hashes).toEqual(golden.hashes);
  });

  it('produces 1080x1350 PNGs and a multi-page PDF', async () => {
    const result = await renderCarousel(spec, { formats: ['png', 'pdf'], quiet: true });
    expect(result.files.pdf).toBeTruthy();
    const png = result.buffers[0];
    // PNG IHDR: width and height are big-endian uint32 at offsets 16 and 20.
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1350);
    const pdf = readFileSync(result.files.pdf as string);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
