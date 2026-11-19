import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLIDE_LAYOUTS, SPEC_VERSION, parseSpec, validateSpec } from '../src/schema.js';
import { makeSpec } from './fixtures.js';

const root = path.resolve(__dirname, '..');

describe('carousel schema', () => {
  it('declares eleven layouts', () => {
    expect(SLIDE_LAYOUTS).toHaveLength(11);
    expect(new Set(SLIDE_LAYOUTS).size).toBe(11);
  });

  it('parses a well-formed spec', () => {
    const result = validateSpec(makeSpec());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('fills defaults without inventing content', () => {
    const spec = parseSpec(makeSpec());
    expect(spec.version).toBe(SPEC_VERSION);
    expect(spec.cta_link).toBeUndefined();
  });

  it('rejects an unknown layout', () => {
    const spec = makeSpec();
    (spec.slides[1] as unknown as { layout: string }).layout = 'marquee';
    const result = validateSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects a one-slide deck', () => {
    const spec = makeSpec();
    spec.slides = [spec.slides[0]];
    expect(validateSpec(spec).ok).toBe(false);
  });

  it('rejects a 21-slide deck', () => {
    const spec = makeSpec();
    const filler = Array.from({ length: 18 }, (_, index) => ({ ...spec.slides[2], id: `recap-${index}` }));
    spec.slides = [spec.slides[0], ...filler, spec.slides[2], spec.slides[3]] as typeof spec.slides;
    expect(validateSpec(spec).ok).toBe(false);
  });

  it('rejects unknown fields rather than silently dropping them', () => {
    const spec = makeSpec() as unknown as Record<string, unknown>;
    spec.slides = [{ layout: 'cover_hook', headline: 'Hi there', headline_size: 92 }, { layout: 'cta', action: 'save', text: 'Go' }];
    expect(validateSpec(spec).ok).toBe(false);
  });

  it('rejects malformed hex colours', () => {
    const spec = makeSpec();
    spec.brand = { name: 'X', accent_override: 'rebeccapurple' } as typeof spec.brand;
    expect(validateSpec(spec).ok).toBe(false);
  });

  it('keeps the exported JSON Schema in sync with the Zod source', () => {
    const exported = JSON.parse(readFileSync(path.join(root, 'schema.json'), 'utf8'));
    const variants = exported.definitions.CarouselSpec.properties.slides.items.anyOf as Array<{
      properties: { layout: { const: string } };
    }>;
    const layouts = variants.map((variant) => variant.properties.layout.const);
    expect(layouts.sort()).toEqual([...SLIDE_LAYOUTS].sort());
  });

  it('ships a schema copy in spec/ identical to the engine build', () => {
    const engine = readFileSync(path.join(root, 'schema.json'), 'utf8');
    const published = readFileSync(path.resolve(root, '..', 'spec', 'carousel.schema.json'), 'utf8');
    expect(JSON.parse(published)).toEqual(JSON.parse(engine));
  });
});
