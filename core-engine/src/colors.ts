/** sRGB color utilities, WCAG 2.1 contrast math, and deterministic mixing. */

export interface Rgba { r: number; g: number; b: number; a: number }

export function parseColor(input: string): Rgba {
  const value = input.trim();
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 4) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => p.trim());
    return {
      r: Number(parts[0]) || 0,
      g: Number(parts[1]) || 0,
      b: Number(parts[2]) || 0,
      a: parts[3] === undefined ? 1 : Number(parts[3]),
    };
  }
  const named: Record<string, string> = {
    black: '#000000', white: '#ffffff', transparent: '#00000000', red: '#ff0000', green: '#008000', blue: '#0000ff',
  };
  if (named[value.toLowerCase()]) return parseColor(named[value.toLowerCase()]);
  return { r: 0, g: 0, b: 0, a: 1 };
}

export function toHex(c: Rgba): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function withAlpha(input: string, alpha: number): string {
  const c = parseColor(input);
  const clamped = Math.max(0, Math.min(1, alpha));
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${h(clamped * 255)}`;
}

export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  const w = Math.max(0, Math.min(1, t));
  return toHex({
    r: ca.r + (cb.r - ca.r) * w,
    g: ca.g + (cb.g - ca.g) * w,
    b: ca.b + (cb.b - ca.b) * w,
    a: ca.a + (cb.a - ca.a) * w,
  });
}

function channelLuminance(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance (alpha is composited over white when < 1). */
export function relativeLuminance(input: string, backdrop = '#ffffff'): number {
  const c = parseColor(input);
  let { r, g, b } = c;
  if (c.a < 1) {
    const back = parseColor(backdrop);
    r = r * c.a + back.r * (1 - c.a);
    g = g * c.a + back.g * (1 - c.a);
    b = b * c.a + back.b * (1 - c.a);
  }
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.1 contrast ratio, rounded to 2dp. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground, background);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/** Picks whichever of the two candidate colors reads better on `background`. */
export function bestOn(background: string, candidates: string[] = ['#ffffff', '#0b0b0b']): string {
  let best = candidates[0];
  let bestRatio = -1;
  for (const c of candidates) {
    const ratio = contrastRatio(c, background);
    if (ratio > bestRatio) { best = c; bestRatio = ratio; }
  }
  return best;
}

/** Nudges `foreground` toward black or white until it clears `target` contrast. */
export function ensureContrast(foreground: string, background: string, target = 4.5): string {
  if (contrastRatio(foreground, background) >= target) return foreground;
  const towardWhite = relativeLuminance(background) < 0.5;
  let current = foreground;
  for (let step = 1; step <= 10; step++) {
    current = mix(foreground, towardWhite ? '#ffffff' : '#000000', step / 10);
    if (contrastRatio(current, background) >= target) return current;
  }
  return towardWhite ? '#ffffff' : '#000000';
}

/** Deterministic 32-bit hash used for stable "organic" jitter. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 seeded PRNG — never Math.random(), so goldens stay stable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
