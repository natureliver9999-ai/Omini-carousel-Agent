import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGalleryHtml, collectDecks, writeGallery } from '../src/gallery.js';

const renderedRoot = path.resolve(__dirname, '..', '..', 'examples', 'rendered');

describe('gallery', () => {
  it('collects every committed deck with its artefacts', () => {
    const decks = collectDecks(renderedRoot);
    expect(decks.length).toBeGreaterThanOrEqual(8);
    for (const deck of decks) {
      expect(deck.slides.length).toBeGreaterThanOrEqual(2);
      expect(deck.files.spec).toBeTruthy();
      expect(deck.files.pdf).toBeTruthy();
      expect(deck.patterns.length).toBeGreaterThan(0);
    }
  });

  it('covers all eleven layouts across the shipped examples', () => {
    const layouts = new Set(collectDecks(renderedRoot).flatMap((deck) => deck.slides.map((slide) => slide.layout)));
    expect(layouts.size).toBe(11);
  });

  it('renders a self-contained page with no external requests', () => {
    const html = buildGalleryHtml(collectDecks(renderedRoot));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(html).not.toContain('<script src');
    expect(html).not.toContain('<link rel="stylesheet"');
    expect(html).toContain('id="lb-ig-contrast-myths"');
  });

  it('escapes content it did not author', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'omni-gallery-'));
    const deckDir = path.join(dir, 'evil-deck');
    mkdirSync(path.join(deckDir, 'slides'), { recursive: true });
    writeFileSync(path.join(deckDir, 'manifest.json'), JSON.stringify({ renderer: 'resvg', slides: [{ index: 1, layout: 'cover_hook', file: 'slides/slide-01.png' }] }));
    writeFileSync(path.join(deckDir, 'spec.json'), JSON.stringify({ title: '<script>alert(1)</script>', platform: 'instagram', theme: 'editorial' }));
    writeFileSync(path.join(deckDir, 'slides', 'slide-01.png'), 'png');

    const { outFile, decks } = writeGallery({ renderedRoot: dir, outFile: path.join(dir, 'index.html') });
    expect(decks).toHaveLength(1);
    expect(existsSync(outFile)).toBe(true);
    const html = buildGalleryHtml(decks);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('returns an empty gallery rather than throwing on a missing root', () => {
    const decks = collectDecks(path.join(tmpdir(), 'omni-does-not-exist'));
    expect(decks).toEqual([]);
    expect(buildGalleryHtml(decks)).toContain('<main></main>');
  });
});
