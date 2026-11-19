/**
 * Deterministic text measurement, wrapping and auto-fitting.
 *
 * The engine never relies on an SVG/CSS layout engine to decide where a line
 * breaks: it measures with real font advance widths and emits one <text> per
 * line. That is what makes resvg, Playwright and the browser deck agree pixel
 * for pixel.
 */
import { faceMetrics, measureText, selectFace } from './fontmetrics.js';
import { text, type TextNode } from './svg.js';

export interface FontSpec {
  family: string;
  size: number;
  weight?: number;
  style?: 'normal' | 'italic';
  letterSpacing?: number;
  /** Multiplier of font-size; defaults per use (1.15 for body, 0.98 for display). */
  lineHeight?: number;
}

const VARIATION_SELECTOR = /[\uFE0E\uFE0F]/g;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;

/** Emoji and variation selectors have no glyph in the bundled text fonts. */
export function stripUnsupported(value: string): string {
  return value.replace(VARIATION_SELECTOR, '').replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
}

export function countEmoji(value: string): number {
  return (value.match(EMOJI) ?? []).length;
}

export function measureLine(value: string, font: FontSpec): number {
  return measureText(value, {
    family: font.family,
    size: font.size,
    weight: font.weight ?? 400,
    style: font.style ?? 'normal',
    letterSpacing: font.letterSpacing,
  });
}

/**
 * Greedy word wrap with hard-splitting for over-long tokens.
 * Returns at most `maxLines` lines; overflow is signalled by `truncated`.
 */
export function wrapText(
  value: string,
  maxWidth: number,
  font: FontSpec,
  maxLines = 40,
): { lines: string[]; truncated: boolean } {
  const clean = value.replace(/\r/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return { lines: [], truncated: false };

  const paragraphs = value.split(/\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const lines: string[] = [];

  const pushWords = (input: string) => {
    const words = input.split(' ').filter(Boolean);
    let current = '';
    const flush = () => {
      if (current) { lines.push(current); current = ''; }
    };
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureLine(candidate, font) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        flush();
        if (measureLine(word, font) <= maxWidth) { current = word; continue; }
      }
      // Single token wider than the column: split on characters.
      let chunk = '';
      for (const ch of word) {
        if (measureLine(chunk + ch, font) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      current = chunk;
    }
    flush();
  };

  for (const paragraph of (paragraphs.length ? paragraphs : [clean])) {
    pushWords(paragraph);
    if (paragraphs.length > 1) lines.push('');
  }

  const truncated = lines.length > maxLines;
  return { lines: truncated ? lines.slice(0, maxLines) : lines, truncated };
}

/** Shrinks the font until the copy fits the box; deterministic binary search. */
export function fitFontSize(
  value: string,
  opts: {
    maxWidth: number;
    maxLines: number;
    max: number;
    min: number;
    font: Omit<FontSpec, 'size'>;
  },
): { size: number; lines: string[]; truncated: boolean } {
  let lo = opts.min;
  let hi = opts.max;
  let best = { size: opts.min, lines: wrapText(value, opts.maxWidth, { ...opts.font, size: opts.min }, opts.maxLines).lines, truncated: true };
  for (let i = 0; i < 14 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    const wrapped = wrapText(value, opts.maxWidth, { ...opts.font, size: mid }, opts.maxLines);
    if (!wrapped.truncated) {
      best = { size: mid, lines: wrapped.lines, truncated: false };
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (!best.truncated) best.size = Math.floor(best.size * 2) / 2;
  return best;
}

export interface ParagraphResult {
  nodes: TextNode[];
  lines: string[];
  height: number;
  width: number;
  fontSize: number;
  truncated: boolean;
}

/**
 * Lays out a wrapped paragraph. `y` is the TOP of the text block (not a baseline),
 * which keeps layout math predictable for designers and agents.
 */
export function paragraph(
  value: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    font: FontSpec;
    color: string;
    maxLines?: number;
    align?: 'left' | 'center' | 'right';
    /** Optional auto-shrink range; omit to keep the requested size. */
    fit?: { min: number; max?: number };
    opacity?: number;
    uppercase?: boolean;
  },
): ParagraphResult {
  const uppercase = opts.uppercase ?? false;
  const source = uppercase ? value.toUpperCase() : value;
  const baseFont: FontSpec = { ...opts.font, size: opts.font.size };
  let size = baseFont.size;
  let wrapped: { lines: string[]; truncated: boolean };

  if (uppercase) baseFont.letterSpacing = baseFont.letterSpacing ?? size * 0.06;

  wrapped = wrapText(source, opts.maxWidth, baseFont, opts.maxLines ?? 40);
  if (opts.fit) {
    const fitted = fitFontSize(source, {
      maxWidth: opts.maxWidth,
      maxLines: opts.maxLines ?? 40,
      max: Math.min(opts.fit.max ?? baseFont.size, baseFont.size),
      min: opts.fit.min,
      font: baseFont,
    });
    size = fitted.size;
    wrapped = { lines: fitted.lines, truncated: fitted.truncated };
  }

  const lineHeight = opts.font.lineHeight ?? 1.16;
  const { ascentRatio } = faceMetrics(opts.font.family, opts.font.weight ?? 400, opts.font.style ?? 'normal');
  const lineBox = size * lineHeight;
  const baselineOffset = lineBox - (lineBox - size * 1.0) / 2 - size * 0.34;
  void ascentRatio;

  const anchor = opts.align === 'center' ? 'middle' : opts.align === 'right' ? 'end' : 'start';
  const x = opts.align === 'center' ? opts.x + opts.maxWidth / 2 : opts.align === 'right' ? opts.x + opts.maxWidth : opts.x;

  const nodes: TextNode[] = wrapped.lines.map((line, i) =>
    text(x, opts.y + baselineOffset + i * lineBox, line, {
      family: opts.font.family,
      size,
      weight: opts.font.weight,
      style: opts.font.style,
      fill: opts.color,
      anchor,
      letterSpacing: baseFont.letterSpacing,
      opacity: opts.opacity,
    }),
  );

  const widest = wrapped.lines.reduce((max, line) => Math.max(max, measureLine(line, { ...baseFont, size })), 0);
  return {
    nodes,
    lines: wrapped.lines,
    height: wrapped.lines.length * lineBox,
    width: widest,
    fontSize: size,
    truncated: wrapped.truncated,
  };
}

/** Single-line text that shrinks to fit a fixed width (never wraps). */
export function oneLine(
  value: string,
  opts: { x: number; y: number; maxWidth: number; font: FontSpec; color: string; align?: 'left' | 'center' | 'right'; opacity?: number },
): TextNode {
  const source = stripUnsupported(value);
  let size = opts.font.size;
  if (measureLine(source, opts.font) > opts.maxWidth) {
    const fitted = fitFontSize(source, {
      maxWidth: opts.maxWidth,
      maxLines: 1,
      max: opts.font.size,
      min: Math.max(14, opts.font.size * 0.55),
      font: opts.font,
    });
    size = fitted.size;
  }
  const anchor = opts.align === 'center' ? 'middle' : opts.align === 'right' ? 'end' : 'start';
  const x = opts.align === 'center' ? opts.x + opts.maxWidth / 2 : opts.align === 'right' ? opts.x + opts.maxWidth : opts.x;
  return text(x, opts.y, source, {
    family: opts.font.family,
    size,
    weight: opts.font.weight,
    style: opts.font.style,
    fill: opts.color,
    anchor,
    letterSpacing: opts.font.letterSpacing,
    opacity: opts.opacity,
  });
}

/** Approximate rendered width of a string, safe to use for pill/card sizing. */
export function textWidth(value: string, font: FontSpec): number {
  return measureLine(stripUnsupported(value), font);
}

export function truncateToWidth(value: string, maxWidth: number, font: FontSpec): string {
  if (measureLine(value, font) <= maxWidth) return value;
  const ellipsis = '…';
  let out = '';
  for (const ch of value) {
    if (measureLine(out + ch + ellipsis, font) > maxWidth) break;
    out += ch;
  }
  return `${out.trimEnd()}${ellipsis}`;
}

/** True when every glyph in the string exists in the font (used by tests). */
export function glyphsAvailable(value: string, family: string, weight = 400): boolean {
  const face = selectFace(family, weight);
  for (const ch of value) {
    if (/\s/.test(ch)) continue;
    if (!face.hasGlyph(ch.codePointAt(0) ?? 0)) return false;
  }
  return true;
}
