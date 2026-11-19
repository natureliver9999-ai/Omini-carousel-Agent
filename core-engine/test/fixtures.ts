import { type CarouselSpec } from '../src/schema.js';

/** Minimal spec that satisfies every hard rule: cover_hook → proof → summary → cta. */
export function makeSpec(patch: Partial<CarouselSpec> = {}): CarouselSpec {
  const base = {
    version: '1.0',
    id: 'test-deck',
    title: 'Test deck',
    platform: 'instagram',
    goal: 'saves',
    theme: 'editorial',
    brand: { name: 'Test Brand', handle: 'testbrand' },
    caption: {
      text: 'A caption long enough to pass the thin-caption check.\n\nIt has a line break so mobile readers can scan it, and it ends with a save prompt.',
      hashtags: ['carousels', 'design'],
    },
    slides: [
      {
        id: 'hook',
        layout: 'cover_hook',
        eyebrow: 'TEST',
        headline: 'Every deck starts with one promise',
        sub: 'And ends with exactly one ask.',
      },
      {
        id: 'evidence',
        layout: 'proof',
        headline: 'Carousels earn the highest engagement',
        metric_value: '0.55%',
        metric_label: 'engagement rate by followers',
        finding: 'Carousel posts out-engage single images and Reels on Instagram.',
        source: 'Socialinsider Instagram benchmarks 2026',
      },
      {
        id: 'recap',
        layout: 'summary',
        headline: 'What to take away',
        bullets: ['Hook first', 'Evidence second', 'One CTA last'],
      },
      {
        id: 'ask',
        layout: 'cta',
        headline: 'Save this for your next deck',
        action: 'save',
        text: 'Save it, then run the same four-slide spine on the next thing you publish.',
      },
    ],
  } as unknown as CarouselSpec;

  return { ...base, ...patch } as CarouselSpec;
}

export function codes(report: { errors: Array<{ code: string }>; warnings: Array<{ code: string }>; infos?: Array<{ code: string }> }): string[] {
  return [...report.errors, ...report.warnings].map((issue) => issue.code);
}
