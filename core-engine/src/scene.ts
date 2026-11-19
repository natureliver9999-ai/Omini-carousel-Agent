/**
 * The visual system: canvas geometry, shared chrome, and the primitives every
 * layout composes from. Keeping this in one place is what makes 11 layouts feel
 * like one designer made them instead of 11 agents.
 */
import { hashString, mix, seededRandom, withAlpha } from './colors.js';
import { drawIcon } from './icons.js';
import { circle, group, path, rect, text, type Node } from './svg.js';
import { oneLine, paragraph, stripUnsupported, textWidth, truncateToWidth, type FontSpec } from './text.js';
import type { ResolvedPalette, Theme } from './themes.js';
import type { CarouselSpec, Slide } from './schema.js';

export const W = 1080;
export const H = 1350;
export const M = 72;
export const CW = W - M * 2;

export const HEADER_RULE_Y = 150;
export const CONTENT_TOP = 196;
export const CONTENT_BOTTOM = 1158;
export const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;
export const FOOTER_RULE_Y = 1204;
export const FOOTER_BASELINE = 1252;
export const PROGRESS_Y = 1304;

export interface SlideContext {
  spec: CarouselSpec;
  slide: Slide;
  index: number;
  total: number;
  palette: ResolvedPalette;
  theme: Theme;
  panorama?: { spanLength: number; indexInSpan: number };
  /** Draw canvas width: 1080 normally, 1080*K inside a panorama pass. */
  canvasWidth: number;
  /** Left offset of this slide's local origin on the canvas. */
  originX: number;
}

export function slideId(ctx: { slide: Slide; index: number }): string {
  return ctx.slide.id ?? `${ctx.slide.layout}-${String(ctx.index + 1).padStart(2, '0')}`;
}

export function displayFont(ctx: SlideContext, weight = 700): FontSpec {
  return { family: ctx.theme.typography.display_font, size: ctx.theme.typography.headline_px, weight, lineHeight: 1.02 };
}

export function bodyFont(ctx: SlideContext, size?: number, weight = 400): FontSpec {
  return { family: ctx.theme.typography.body_font, size: size ?? ctx.theme.typography.body_px, weight, lineHeight: 1.32 };
}

export function monoFont(ctx: SlideContext, size = 26, weight = 500): FontSpec {
  return { family: ctx.theme.typography.mono_font, size, weight, lineHeight: 1.2 };
}

export function isScrapbook(ctx: SlideContext): boolean {
  return ctx.theme.style === 'scrapbook';
}

export function isBrutal(ctx: SlideContext): boolean {
  return ctx.theme.style === 'brutal';
}

export function brandLabel(ctx: SlideContext): string {
  const brand = ctx.spec.brand;
  if (!brand) return '';
  return brand.handle ? `@${brand.handle.replace(/^@/, '')}` : brand.name;
}

/* ------------------------------------------------------------------ *
 * Backgrounds
 * ------------------------------------------------------------------ */

export function backgroundNodes(ctx: SlideContext): Node[] {
  const p = ctx.palette;
  const nodes: Node[] = [];
  const width = ctx.canvasWidth;
  const style = ctx.theme.style;

  if (style === 'brutal') {
    // Architectural grid
    for (let x = 0; x <= width; x += 90) nodes.push(rect(x, 0, 1, H, withAlpha(p.text, ctx.theme.decoration.grid_opacity)));
    for (let y = 0; y <= H; y += 90) nodes.push(rect(0, y, width, 1, withAlpha(p.text, ctx.theme.decoration.grid_opacity)));
    // Solid accent corner block, repeated per slide so seams still read as intentional
    nodes.push(rect(0, 0, width, 10, p.accent));
    nodes.push(rect(0, H - 10, width, 10, p.accent));
  } else if (style === 'scrapbook') {
    // Paper grain: deterministic dots, stable for a given canvas size
    const rand = seededRandom(hashString(`grain-${width}`));
    for (let i = 0; i < 380; i++) {
      const x = rand() * width;
      const y = rand() * H;
      nodes.push(circle(x, y, 0.8 + rand() * 1.7, withAlpha(p.text, 0.05 + rand() * 0.05)));
    }
    // Halftone corner
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const x = 18 + col * 13;
        const y = H - 140 + row * 13;
        nodes.push(circle(x, y, 2.4, withAlpha(p.accent, 0.22)));
      }
    }
  } else {
    // Editorial: fine paper tone + soft light bloom
    nodes.push(rect(0, 0, width, H, withAlpha(p.text, 0.012)));
    nodes.push(circle(width - 120, -60, 420, withAlpha(p.accent, 0.05)));
    for (let x = 90; x < width; x += 120) nodes.push(rect(x, 0, 1, H, withAlpha(p.text, ctx.theme.decoration.grid_opacity * 0.5)));
  }
  return nodes;
}

/**
 * Continuous panorama canvas: ribbons + nodes are evaluated in the SAME
 * coordinate space as the final slice, so anti-aliasing happens before the cut
 * and seams are mathematically invisible.
 */
export function panoramaBackground(ctx: SlideContext, seedKey: string): Node[] {
  const p = ctx.palette;
  const width = ctx.canvasWidth;
  const rand = seededRandom(hashString(seedKey));
  const nodes: Node[] = [rect(0, 0, width, H, p.isDark ? mix(p.bg, '#ffffff', 0.02) : mix(p.bg, p.accent, 0.03))];

  const ribbon = (baseY: number, amplitude: number, thickness: number, color: string, phase: number) => {
    const points: string[] = [];
    const steps = Math.max(24, Math.ceil(width / 22));
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const y = baseY + Math.sin((x / width) * Math.PI * 2.4 + phase) * amplitude + Math.sin((x / width) * Math.PI * 6.1 + phase * 1.7) * amplitude * 0.18;
      points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return path(points.join(''), { fill: 'none', stroke: color, strokeWidth: thickness, linecap: 'round' });
  };

  // Ribbons live in the calm corridors: a very low-contrast band behind the copy,
  // and a crisp bright line just above the footer rule where no text can land.
  nodes.push(ribbon(H * 0.52, 110, 200, withAlpha(p.accent, 0.055), 0.4));
  nodes.push(ribbon(H * 0.30, 70, 160, withAlpha(p.accent, 0.04), 2.7));
  nodes.push(ribbon(H * 0.862, 14, 4, withAlpha(p.accent, 0.6), 1.2));
  nodes.push(ribbon(H * 0.905, 8, 2, withAlpha(p.text, 0.2), 2.1));

  // Cross-seam nodes centred exactly on every seam so all sizes of the motif
  // land on both slides (>= 50% / 50% split, well above the 25% rule).
  const span = ctx.panorama?.spanLength ?? 1;
  for (let j = 1; j < span; j++) {
    const cx = j * W;
    const cy = H * 0.862;
    nodes.push(circle(cx, cy, 46, withAlpha(p.accent, 0.18)));
    nodes.push(circle(cx, cy, 46, 'none', { stroke: p.accent, strokeWidth: 2.5 }));
    nodes.push(circle(cx, cy, 9, p.accent));
  }
  // Free-floating accents, constrained to the empty band above the footer.
  for (let i = 0; i < 6; i++) {
    const cx = (i + 0.5) * (width / 6);
    nodes.push(circle(cx + (rand() - 0.5) * 90, H * 0.78 + rand() * 40, 4 + rand() * 8, withAlpha(p.accent, 0.26)));
  }
  return nodes;
}

/* ------------------------------------------------------------------ *
 * Chrome
 * ------------------------------------------------------------------ */

export function chromeNodes(ctx: SlideContext, opts: { hideHeader?: boolean; hideFooter?: boolean; hideProgress?: boolean } = {}): Node[] {
  const p = ctx.palette;
  const brand = brandLabel(ctx);
  const nodes: Node[] = [];
  const mono = ctx.theme.typography.mono_font;

  if (!opts.hideHeader) {
    const eyebrowSize = ctx.theme.typography.eyebrow_px;
    if (ctx.slide.eyebrow) {
      const label = stripUnsupported(ctx.slide.eyebrow).toUpperCase();
      const font: FontSpec = { family: ctx.theme.typography.body_font, size: eyebrowSize, weight: 600, letterSpacing: eyebrowSize * 0.14 };
      const badgeW = textWidth(label, font) + 34;
      const badgeH = eyebrowSize + 26;
      nodes.push(rect(M, HEADER_RULE_Y - badgeH - 26, badgeW, badgeH, isBrutal(ctx) ? p.accent : withAlpha(p.text, 0.07), { rx: isBrutal(ctx) ? 0 : 4 }));
      const badgeText = text(M + 17, HEADER_RULE_Y - 26 - badgeH / 2 + eyebrowSize * 0.36, label, {
        family: ctx.theme.typography.body_font,
        size: eyebrowSize,
        weight: 600,
        letterSpacing: eyebrowSize * 0.14,
        fill: isBrutal(ctx) ? p.accentText : p.text,
      });
      nodes.push(...(Array.isArray(badgeText) ? badgeText : [badgeText]));
    } else if (brand) {
      nodes.push(oneLine(brand.toUpperCase(), {
        x: M, y: HEADER_RULE_Y - 34, maxWidth: CW * 0.5,
        font: { family: ctx.theme.typography.body_font, size: 22, weight: 600, letterSpacing: 3 },
        color: p.textMuted,
      }));
    }

    if (ctx.slide.layout === 'cover_hook' && (ctx.slide as { badge?: string }).badge) {
      const badge = (ctx.slide as { badge?: string }).badge as string;
      const font: FontSpec = { family: ctx.theme.typography.body_font, size: 22, weight: 700, letterSpacing: 2 };
      const label = badge.toUpperCase();
      const w = textWidth(label, font) + 30;
      nodes.push(rect(W - M - w, HEADER_RULE_Y - 62, w, 42, p.accent, { rx: 999 }));
      nodes.push(text(W - M - w / 2, HEADER_RULE_Y - 62 + 28, label, {
        family: ctx.theme.typography.body_font, size: 22, weight: 700, letterSpacing: 2, fill: p.accentText, anchor: 'middle',
      }));
    }
    nodes.push(rect(M, HEADER_RULE_Y, CW, isBrutal(ctx) ? 2 : 1, p.hairline));
  }

  if (!opts.hideFooter) {
    nodes.push(rect(M, FOOTER_RULE_Y, CW, 1, p.hairline));
    const footerSize = ctx.theme.typography.footer_px;
    let left = brand;
    if (!left && ctx.spec.brand?.mark) left = ctx.spec.brand.mark;
    if (!left && ctx.spec.title) left = ctx.spec.title;
    if (left) {
      nodes.push(oneLine(left, {
        x: M, y: FOOTER_BASELINE, maxWidth: CW * 0.32,
        font: { family: mono, size: footerSize, weight: 500, letterSpacing: 0.5 },
        color: p.textMuted,
      }));
    }
    if (ctx.slide.footer_hook) {
      const hookFont: FontSpec = { family: ctx.theme.typography.body_font, size: footerSize + 2, weight: 600 };
      const label = truncateToWidth(stripUnsupported(ctx.slide.footer_hook), CW * 0.42, hookFont);
      // 150px of clearance: the counter is end-anchored at W - M and needs its own column.
      nodes.push(text(W - M - 150, FOOTER_BASELINE, label, {
        family: ctx.theme.typography.body_font, size: footerSize + 2, weight: 600, fill: p.accent, anchor: 'end',
      }));
    }
    nodes.push(text(W - M, FOOTER_BASELINE, `${String(ctx.index + 1).padStart(2, '0')} / ${String(ctx.total).padStart(2, '0')}`, {
      family: mono, size: footerSize, weight: 500, fill: p.textMuted, anchor: 'end', letterSpacing: 1,
    }));
  }

  if (!opts.hideProgress) {
    const trackH = isBrutal(ctx) ? 6 : 4;
    nodes.push(rect(M, PROGRESS_Y, CW, trackH, withAlpha(p.text, 0.12), { rx: trackH / 2 }));
    const fraction = ctx.total > 1 ? (ctx.index + 1) / ctx.total : 1;
    nodes.push(rect(M, PROGRESS_Y, Math.max(trackH, CW * fraction), trackH, p.accent, { rx: trackH / 2 }));
  }
  return nodes;
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export function panel(ctx: SlideContext, opts: {
  x: number; y: number; w: number; h: number;
  fill?: string; stroke?: string; strokeWidth?: number; rx?: number; rotate?: number; dash?: string; shadow?: boolean;
}): Node[] {
  const p = ctx.palette;
  const rx = opts.rx ?? ctx.theme.radii.card;
  const nodes: Node[] = [];
  const shadowKind = ctx.theme.decoration.shadow;
  if (opts.shadow !== false && shadowKind !== 'none') {
    if (shadowKind === 'hard') {
      nodes.push(rect(opts.x + 12, opts.y + 12, opts.w, opts.h, withAlpha(p.accent, 0.9), { rx }));
    } else if (shadowKind === 'offset') {
      nodes.push(rect(opts.x + 7, opts.y + 9, opts.w, opts.h, withAlpha(p.text, 0.16), { rx }));
    } else {
      nodes.push(rect(opts.x + 2, opts.y + 6, opts.w, opts.h, withAlpha(p.text, 0.06), { rx }));
    }
  }
  nodes.push(rect(opts.x, opts.y, opts.w, opts.h, opts.fill ?? p.surface, {
    rx, stroke: opts.stroke ?? (isBrutal(ctx) ? p.border : withAlpha(p.text, 0.1)),
    strokeWidth: opts.strokeWidth ?? (isBrutal(ctx) ? 2 : 1.5),
    dash: opts.dash,
    rotate: opts.rotate,
    rotateOrigin: [opts.x + opts.w / 2, opts.y + opts.h / 2],
  }));
  return nodes;
}

export function pill(ctx: SlideContext, x: number, y: number, label: string, opts: {
  fill?: string; color?: string; size?: number; weight?: number; height?: number; icon?: string; padX?: number;
} = {}): Node[] {
  const p = ctx.palette;
  const size = opts.size ?? 26;
  const font: FontSpec = { family: ctx.theme.typography.body_font, size, weight: opts.weight ?? 600, letterSpacing: size * 0.05 };
  const clean = truncateToWidth(stripUnsupported(label).toUpperCase(), CW * 0.7, font);
  const padX = opts.padX ?? 20;
  const height = opts.height ?? size + 26;
  const iconW = opts.icon ? size + 12 : 0;
  const w = textWidth(clean, font) + padX * 2 + iconW;
  const nodes: Node[] = [];
  nodes.push(rect(x, y, w, height, opts.fill ?? withAlpha(p.text, 0.07), { rx: height / 2 }));
  if (opts.icon) {
    nodes.push(...drawIcon(x + padX, y + (height - size) / 2, size, opts.icon, { color: opts.color ?? p.text }));
  }
  nodes.push(text(x + padX + iconW, y + height / 2 + size * 0.36, clean, {
    family: ctx.theme.typography.body_font, size, weight: opts.weight ?? 600, letterSpacing: size * 0.05,
    fill: opts.color ?? p.text,
  }));
  return nodes;
}

export function pillWidth(label: string, ctx: SlideContext, size = 26, icon?: string): number {
  const font: FontSpec = { family: ctx.theme.typography.body_font, size, weight: 600, letterSpacing: size * 0.05 };
  return textWidth(stripUnsupported(label).toUpperCase(), font) + 40 + (icon ? size + 12 : 0);
}

export function iconBadge(ctx: SlideContext, x: number, y: number, size: number, icon: string, opts: {
  fill?: string; color?: string; rx?: number; stroke?: string;
} = {}): Node[] {
  const p = ctx.palette;
  const nodes: Node[] = [rect(x, y, size, size, opts.fill ?? withAlpha(p.accent, 0.14), {
    rx: opts.rx ?? ctx.theme.radii.tile, stroke: opts.stroke, strokeWidth: opts.stroke ? 1.5 : undefined,
  })];
  const pad = size * 0.24;
  nodes.push(...drawIcon(x + pad, y + pad, size - pad * 2, icon, { color: opts.color ?? p.accent, strokeWidth: 1.9 }));
  return nodes;
}

export function divider(ctx: SlideContext, x: number, y: number, w: number, opacity = 0.14): Node {
  return rect(x, y, w, 1, withAlpha(ctx.palette.text, opacity));
}

/** Hand-drawn marker underline (scrapbook) / clean accent rule (everything else). */
export function underline(ctx: SlideContext, x: number, y: number, w: number, seedKey: string): Node[] {
  const p = ctx.palette;
  if (isScrapbook(ctx)) {
    const rand = seededRandom(hashString(seedKey));
    const pts: string[] = [`M${x.toFixed(1)} ${y.toFixed(1)}`];
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const px = x + (w / steps) * i;
      const py = y + (rand() - 0.5) * 7 + Math.sin(i) * 2;
      pts.push(`L${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    return [
      path(pts.join(''), { fill: 'none', stroke: withAlpha(p.accent, 0.85), strokeWidth: 6, linecap: 'round' }),
      path(pts.join(''), { fill: 'none', stroke: withAlpha(p.accent, 0.35), strokeWidth: 11, linecap: 'round' }),
    ];
  }
  return [rect(x, y, w, isBrutal(ctx) ? 8 : 6, p.accent, { rx: 3 })];
}

/** Kraft masking-tape strip; only drawn for scrapbook themes. */
export function tapeStrip(ctx: SlideContext, x: number, y: number, w: number, angle = -3): Node[] {
  if (!isScrapbook(ctx)) return [];
  const p = ctx.palette;
  const h = 44;
  return [
    group(
      [
        rect(x, y, w, h, withAlpha(p.elevated, 0.92), { rx: 2, stroke: withAlpha(p.text, 0.08), strokeWidth: 1 }),
        ...Array.from({ length: Math.floor(w / 9) }, (_, i) =>
          rect(x + 4 + i * 9, y + 4, 1, h - 8, withAlpha(p.text, 0.07)),
        ),
      ],
      { rotate: angle, rotateOrigin: [x + w / 2, y + h / 2] },
    ),
  ];
}

/** Oversized ghosted slide number used as an editorial background motif. */
export function ghostIndex(ctx: SlideContext, value: string, opts: { x?: number; y?: number; size?: number; opacity?: number } = {}): Node {
  return text(opts.x ?? W - M, opts.y ?? CONTENT_TOP + (opts.size ?? 300) * 0.78, value, {
    family: ctx.theme.typography.display_font,
    size: opts.size ?? 300,
    weight: 400,
    fill: withAlpha(ctx.palette.text, opts.opacity ?? 0.055),
    anchor: 'end',
  });
}

/** Corner registration brackets — small detail that reads as "designed". */
export function cornerBrackets(ctx: SlideContext, inset = 34, len = 26): Node[] {
  const p = ctx.palette;
  const color = withAlpha(p.text, 0.28);
  const strokes = 3;
  const corners: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [W - inset, inset, -1, 1],
    [inset, H - inset, 1, -1],
    [W - inset, H - inset, -1, -1],
  ];
  return corners.flatMap(([cx, cy, sx, sy]) => [
    rect(cx, cy, len * sx, strokes, color),
    rect(cx, cy, strokes, len * sy, color),
  ].map((n) => (n.type === 'rect' ? { ...n, w: Math.abs(n.w), h: Math.abs(n.h), x: n.w < 0 ? cx - len : n.x, y: n.h < 0 ? cy - len : n.y } : n)));
}

/** Big, soft accent blob used behind sparse layouts. */
export function softBlob(ctx: SlideContext, cx: number, cy: number, r: number, color?: string): Node {
  return circle(cx, cy, r, withAlpha(color ?? ctx.palette.accent, 0.1));
}

/* ------------------------------------------------------------------ *
 * Text blocks
 * ------------------------------------------------------------------ */

export function eyebrowText(ctx: SlideContext, x: number, y: number, value: string, opts: { color?: string; size?: number } = {}): Node {
  const size = opts.size ?? ctx.theme.typography.eyebrow_px;
  return oneLine(stripUnsupported(value).toUpperCase(), {
    x, y, maxWidth: CW,
    font: { family: ctx.theme.typography.body_font, size, weight: 700, letterSpacing: size * 0.12 },
    color: opts.color ?? ctx.palette.accent,
  });
}

export function headlineBlock(ctx: SlideContext, value: string, opts: {
  x?: number; y?: number; w?: number; maxLines?: number; color?: string; font?: FontSpec; minSize?: number; align?: 'left' | 'center' | 'right';
} = {}): { nodes: Node[]; height: number; fontSize: number } {
  const font = opts.font ?? displayFont(ctx);
  const result = paragraph(value, {
    x: opts.x ?? M,
    y: opts.y ?? CONTENT_TOP,
    maxWidth: opts.w ?? CW,
    font,
    color: opts.color ?? ctx.palette.text,
    maxLines: opts.maxLines ?? 4,
    align: opts.align,
    fit: { min: opts.minSize ?? font.size * 0.55 },
  });
  return { nodes: result.nodes, height: result.height, fontSize: result.fontSize };
}

export function bodyBlock(ctx: SlideContext, value: string, opts: {
  x?: number; y?: number; w?: number; maxLines?: number; color?: string; size?: number; weight?: number; align?: 'left' | 'center' | 'right';
} = {}): { nodes: Node[]; height: number } {
  const font = bodyFont(ctx, opts.size, opts.weight);
  const result = paragraph(value, {
    x: opts.x ?? M,
    y: opts.y ?? CONTENT_TOP,
    maxWidth: opts.w ?? CW,
    font,
    color: opts.color ?? ctx.palette.textSecondary,
    maxLines: opts.maxLines ?? 8,
    align: opts.align,
  });
  return { nodes: result.nodes, height: result.height };
}

export function labelText(ctx: SlideContext, x: number, y: number, value: string, opts: { color?: string; size?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; maxWidth?: number } = {}): Node {
  return oneLine(stripUnsupported(value).toUpperCase(), {
    x, y, maxWidth: opts.maxWidth ?? CW,
    font: { family: ctx.theme.typography.body_font, size: opts.size ?? 24, weight: opts.weight ?? 700, letterSpacing: (opts.size ?? 24) * 0.12 },
    color: opts.color ?? ctx.palette.textMuted,
    align: opts.anchor === 'middle' ? 'center' : opts.anchor === 'end' ? 'right' : 'left',
  });
}

/** Footer hook rendered above the footer rule for layouts that need the teaser inline. */
export function inlineTeaser(ctx: SlideContext, x: number, y: number, w: number, label: string): Node[] {
  return pill(ctx, x, y, label, { fill: withAlpha(ctx.palette.accent, 0.12), color: ctx.palette.accent, size: 24, icon: 'arrow-right' });
}

export function arrowHint(ctx: SlideContext, x: number, y: number, color?: string): Node[] {
  return drawIcon(x, y, 30, 'arrow-right', { color: color ?? ctx.palette.accent, strokeWidth: 2.2 });
}

/** A short, honest source line — the visual promise that numbers are checkable. */
export function sourceLine(ctx: SlideContext, x: number, y: number, source: string, maxWidth = CW): Node {
  return oneLine(`SOURCE · ${stripUnsupported(source).toUpperCase()}`, {
    x, y, maxWidth,
    font: { family: ctx.theme.typography.mono_font, size: 22, weight: 500, letterSpacing: 1.2 },
    color: ctx.palette.textMuted,
  });
}
