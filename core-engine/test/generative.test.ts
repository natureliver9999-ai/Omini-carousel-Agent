import { describe, expect, it } from 'vitest';
import {
  ART_LABELS, ART_STYLES, artSignature, framedArt, pickArtStyle, renderArt,
} from '../src/generative.js';
import { loadTheme, resolvePalette } from '../src/themes.js';
import { sceneToSvg } from '../src/svg.js';

const palette = resolvePalette(loadTheme('brutal-bento'));
const zone = { x: 72, y: 250, w: 936, h: 460 };

describe('generative art', () => {
  it('ships eight styles, each with a label', () => {
    expect(ART_STYLES).toHaveLength(8);
    for (const style of ART_STYLES) expect(ART_LABELS[style]).toBeTruthy();
    expect(new Set(ART_STYLES).size).toBe(ART_STYLES.length);
  });

  it('draws every style without throwing or emitting empty scenes', () => {
    for (const style of ART_STYLES) {
      const nodes = renderArt(palette, { zone, style, seed: `test-${style}`, density: 0.6 });
      // Groups carry many leaves (moire is four line families in six nodes), so count them.
      const leaves = (list: typeof nodes): number =>
        list.reduce((sum, node) => sum + (node.type === 'group' ? leaves(node.children) : 1), 0);
      expect(leaves(nodes)).toBeGreaterThan(8);
      const svg = sceneToSvg({ width: 1080, height: 1350, nodes, background: palette.bg });
      expect(svg).toContain('<svg');
      expect(svg.length).toBeGreaterThan(500);
    }
  });

  it('is deterministic: same seed, same SVG', () => {
    const once = renderArt(palette, { zone, style: 'topography', seed: 'stable', density: 0.5 });
    const twice = renderArt(palette, { zone, style: 'topography', seed: 'stable', density: 0.5 });
    const scene = (nodes: typeof once) => sceneToSvg({ width: 1080, height: 1350, nodes, background: palette.bg });
    expect(scene(once)).toBe(scene(twice));
  });

  it('is seed-sensitive: a different seed draws something else', () => {
    const a = sceneToSvg({ width: 1080, height: 1350, nodes: renderArt(palette, { zone, style: 'orbital', seed: 'a' }), background: palette.bg });
    const b = sceneToSvg({ width: 1080, height: 1350, nodes: renderArt(palette, { zone, style: 'orbital', seed: 'b' }), background: palette.bg });
    expect(a).not.toBe(b);
  });

  it('re-inks in the theme palette rather than carrying its own colours', () => {
    const dark = sceneToSvg({
      width: 1080, height: 1350, background: palette.bg,
      nodes: renderArt(resolvePalette(loadTheme('brutal-bento')), { zone, style: 'halftone', seed: 'ink' }),
    });
    const light = sceneToSvg({
      width: 1080, height: 1350, background: '#FAF7F2',
      nodes: renderArt(resolvePalette(loadTheme('editorial')), { zone, style: 'halftone', seed: 'ink' }),
    });
    // Accents pass through withAlpha, which emits 8-digit hex (#rrggbbaa).
    expect(dark.toLowerCase()).toContain('#c8ff32');
    expect(light.toLowerCase()).toContain('#b8331a');
  });

  it('chooses a style deterministically from a seed key', () => {
    expect(pickArtStyle('deck-slide-1')).toBe(pickArtStyle('deck-slide-1'));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickArtStyle(`seed-${i}`)));
    expect(seen.size).toBeGreaterThan(3);
  });

  it('signs a seed in four uppercase hex characters', () => {
    expect(artSignature('deck-slide-1')).toMatch(/^[0-9A-F]{4}$/);
    expect(artSignature('deck-slide-1')).toBe(artSignature('deck-slide-1'));
    expect(artSignature('deck-slide-1')).not.toBe(artSignature('deck-slide-2'));
  });

  it('clips art to its zone so a still-visible headline never gets ink on it', () => {
    const nodes = framedArt(palette, { zone, style: 'flowfield', seed: 'clip', density: 0.8 });
    const svg = sceneToSvg({ width: 1080, height: 1350, nodes, background: palette.bg });
    expect(svg).toContain('<clipPath');
    expect(svg).toContain(`url(#clip`);
    const clip = svg.match(/<clipPath id="[^"]+"><rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/);
    expect(clip).toBeTruthy();
    expect(Number(clip![1])).toBe(zone.x);
    expect(Number(clip![2])).toBe(zone.y);
  });

  it('honours the opacity multiplier', () => {
    const loud = renderArt(palette, { zone, style: 'ribbon', seed: 'alpha', opacity: 1 });
    const quiet = renderArt(palette, { zone, style: 'ribbon', seed: 'alpha', opacity: 0.2 });
    expect(quiet.length).toBe(loud.length);
    const quietAlpha = quiet.reduce((sum, node) => sum + (node.opacity ?? 1), 0);
    expect(quietAlpha).toBeLessThan(loud.length);
  });

  it('never emits a network reference', () => {
    for (const style of ART_STYLES) {
      const svg = sceneToSvg({
        width: 1080, height: 1350, background: palette.bg,
        nodes: framedArt(palette, { zone, style, seed: `net-${style}` }),
      });
      expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
      expect(svg).not.toContain('<image');
    }
  });
});
