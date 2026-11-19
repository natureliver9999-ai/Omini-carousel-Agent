import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintSpec } from '../src/lint.js';
import { parseSpec } from '../src/schema.js';
import { codes, makeSpec } from './fixtures.js';

const examplesDir = path.resolve(__dirname, '..', '..', 'examples', 'specs');

describe('linter — retention rules', () => {
  it('passes a clean deck', () => {
    const report = lintSpec(makeSpec());
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('errors when slide 1 is not cover_hook', () => {
    const spec = makeSpec();
    spec.slides[0] = { ...(spec.slides[1] as typeof spec.slides[1]), id: 'first' };
    expect(codes(lintSpec(spec))).toContain('FIRST_SLIDE_NOT_COVER');
  });

  it('errors when the last slide is not the CTA', () => {
    const spec = makeSpec();
    spec.slides = [spec.slides[0], spec.slides[1], spec.slides[3], spec.slides[2]];
    expect(codes(lintSpec(spec))).toContain('LAST_SLIDE_NOT_CTA');
  });

  it('errors on two CTAs', () => {
    const spec = makeSpec();
    spec.slides = [spec.slides[0], spec.slides[3], spec.slides[2], { ...spec.slides[3], id: 'ask-2' }] as typeof spec.slides;
    expect(codes(lintSpec(spec))).toContain('MULTIPLE_CTA');
  });

  it('errors when a cover headline runs long', () => {
    const spec = makeSpec();
    (spec.slides[0] as { headline: string }).headline =
      'This is a headline that keeps going and going well past the point a thumb can parse it';
    expect(codes(lintSpec(spec))).toContain('HOOK_TOO_LONG');
  });

  it('flags AI-slop phrasing', () => {
    const spec = makeSpec();
    (spec.slides[1] as { finding: string }).finding =
      'In the ever-evolving landscape of social media, carousels unlock the power of storytelling.';
    expect(codes(lintSpec(spec))).toContain('CLICHE_LANGUAGE');
  });

  it('flags an unreferenced statistic', () => {
    const spec = makeSpec();
    (spec.slides[1] as { source: string }).source = '78';
    expect(codes(lintSpec(spec))).toContain('SOURCE_NOT_NAMED');
  });

  it('rejects a panorama that overruns the deck', () => {
    const spec = makeSpec();
    (spec.slides[0] as { panorama?: unknown }).panorama = { span: 6 };
    expect(codes(lintSpec(spec))).toContain('PANORAMA_CONFLICT');
  });

  it('accepts a panorama span that fits', () => {
    const spec = makeSpec();
    (spec.slides[1] as { panorama?: unknown }).panorama = { span: 2 };
    const report = lintSpec(spec);
    expect(report.errors.filter((issue) => issue.code === 'PANORAMA_CONFLICT')).toEqual([]);
  });

  it('errors when a reveal_hold slide is left unresolved at the end', () => {
    const spec = makeSpec();
    spec.slides = [
      spec.slides[0],
      spec.slides[1],
      {
        layout: 'reveal_hold',
        headline: 'Open loop',
        body: 'The second frame has to earn the third swipe.',
        teaser_label: 'Swipe',
      } as unknown as typeof spec.slides[1],
    ];
    const report = codes(lintSpec(spec));
    expect(report).toContain('REVEAL_UNRESOLVED');
    expect(report).toContain('LAST_SLIDE_NOT_CTA');
  });

  it('requires a keyword on a comment CTA', () => {
    const spec = makeSpec();
    (spec.slides[3] as { action: string; keyword?: string }).action = 'comment';
    expect(codes(lintSpec(spec))).toContain('CTA_KEYWORD_MISSING');
  });

  it('measures contrast pairs for the theme', () => {
    const report = lintSpec(makeSpec());
    expect(report.metrics.contrastPairs.length).toBeGreaterThan(0);
    expect(report.metrics.contrastPairs.every((pair) => typeof pair.ratio === 'number')).toBe(true);
  });
});

describe('linter — shipped examples', () => {
  const files = readdirSync(examplesDir).filter((file) => file.endsWith('.json'));

  it('ships at least seven decks', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  for (const file of files) {
    it(`${file} passes lint`, () => {
      const spec = parseSpec(JSON.parse(readFileSync(path.join(examplesDir, file), 'utf8')));
      const report = lintSpec(spec);
      expect(report.errors.map((issue) => `${issue.code} ${issue.message}`)).toEqual([]);
      expect(report.ok).toBe(true);
    });
  }
});
