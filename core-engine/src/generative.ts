/**
 * The generative layer.
 *
 * Every other module in this engine interprets copy. This one draws. Eight
 * plotter-style compositions — topography, orbital, halftone, isometric,
 * flowfield, constellation, moire, ribbon — are generated from a seed and the
 * theme palette, in pure vector geometry, with no randomness that survives a
 * reload: the same seed always produces the same drawing, on every machine.
 *
 * That is the anti-slop contract in visual form. A deck rendered here does not
 * look like every other agent's gradient-and-stock-photo carousel, and it does
 * not look like itself twice.
 */
import { hashString, seededRandom, withAlpha } from './colors.js';
import { circle, group, path, rect, type Node } from './svg.js';
import type { ResolvedPalette } from './themes.js';

export const ART_STYLES = [
  'topography',
  'orbital',
  'halftone',
  'isometric',
  'flowfield',
  'constellation',
  'moire',
  'ribbon',
] as const;

export type ArtStyle = (typeof ART_STYLES)[number];

export const ART_LABELS: Record<ArtStyle, string> = {
  topography: 'Topography',
  orbital: 'Orbital',
  halftone: 'Halftone',
  isometric: 'Isometric',
  flowfield: 'Flow Field',
  constellation: 'Constellation',
  moire: 'Moire',
  ribbon: 'Ribbon',
};

export const ART_NOTES: Record<ArtStyle, string> = {
  topography: 'Nested contour rings — data as terrain.',
  orbital: 'Compass arcs and satellites — systems and cycles.',
  halftone: 'Dot-density field — print texture, zero photos.',
  isometric: 'Wireframe volumes — architecture without a stock render.',
  flowfield: 'Streamlines through a vector field — momentum made visible.',
  constellation: 'Nearest-neighbour graph — networks and evidence density.',
  moire: 'Rotated line families — interference, contrast, tension.',
  ribbon: 'Stacked waves — sequence and rhythm.',
};

export interface ArtZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArtOptions {
  style?: ArtStyle;
  seed?: string;
  /** 0..1 — how much ink the composition spends. Default 0.5. */
  density?: number;
  /** 0..1 — global alpha multiplier. Default 1. */
  opacity?: number;
  /** Plot a faint field behind a non-generative layout. */
  backdrop?: boolean;
}

export const FULL_CANVAS: ArtZone = { x: 0, y: 0, w: 1080, h: 1350 };

/** Deterministic style choice, so decks vary but every render is reproducible. */
export function pickArtStyle(seedKey: string): ArtStyle {
  return ART_STYLES[hashString(seedKey) % ART_STYLES.length];
}

/** Short, human-quotable seed fingerprint shown as `SEED 3F9C` on the slide. */
export function artSignature(seed: string): string {
  return (hashString(seed) & 0xffff).toString(16).padStart(4, '0').toUpperCase();
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function frameNodes(zone: ArtZone, color: string, tick: number): Node[] {
  const { x, y, w, h } = zone;
  return [
    rect(x, y, w, h, 'none', { stroke: withAlpha(color, 0.22), strokeWidth: 1 }),
    ...([
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ] as const).map(([cx, cy, sx, sy]) =>
      path(
        `M${cx + sx * tick} ${cy} L${cx} ${cy} L${cx} ${cy + sy * tick}`,
        { fill: 'none', stroke: withAlpha(color, 0.55), strokeWidth: 2.5, linecap: 'round' },
      ),
    ),
  ];
}

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */

function topography(rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number): Node[] {
  const nodes: Node[] = [];
  const hills = 1 + Math.round(density * 2);
  const rings = 6 + Math.round(density * 5);
  for (let hill = 0; hill < hills; hill++) {
    const cx = zone.x + zone.w * (0.24 + rand() * 0.52);
    const cy = zone.y + zone.h * (0.24 + rand() * 0.52);
    const spread = Math.min(zone.w, zone.h) * (0.16 + rand() * 0.1);
    const phase = rand() * Math.PI * 2;
    const lobes = 2 + Math.floor(rand() * 3);
    for (let ring = 0; ring < rings; ring++) {
      const t = ring / (rings - 1);
      const base = spread * (0.35 + t * 2.5);
      const steps = 72;
      const points: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const wobble = 1 + 0.16 * Math.sin(angle * lobes + phase + t * 1.6) + 0.07 * Math.sin(angle * (lobes + 3) - t * 2.2);
        const px = cx + Math.cos(angle) * base * wobble;
        const py = cy + Math.sin(angle) * base * wobble * 0.94;
        points.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      points.push('Z');
      const highlight = ring === rings - 2;
      nodes.push(
        path(points.join(''), {
          fill: 'none',
          stroke: highlight ? withAlpha(p.accent, 0.95) : withAlpha(p.text, 0.2 + (1 - t) * 0.22),
          strokeWidth: highlight ? 3.2 : 1.6,
          linejoin: 'round',
        }),
      );
      if (highlight) {
        nodes.push(circle(cx, cy, 4, p.accent));
        nodes.push(circle(cx, cy, 13, 'none', { stroke: withAlpha(p.accent, 0.45), strokeWidth: 1.6 }));
      }
    }
  }
  return nodes;
}

function orbital(rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number): Node[] {
  const nodes: Node[] = [];
  // A wide frame gets an elliptical dial, not a small circle floating in it.
  const cx = zone.x + zone.w * (0.5 + (rand() - 0.5) * 0.1);
  const cy = zone.y + zone.h * (0.5 + (rand() - 0.5) * 0.08);
  const rx = zone.w * 0.42;
  const ry = zone.h * 0.44;
  const rings = 7 + Math.round(density * 7);

  // Twelve spokes first: the instrument reads as a dial, not a doodle.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.12;
    const k0 = 0.18;
    const k1 = i % 3 === 0 ? 1.02 : 0.9;
    nodes.push(
      path(
        `M${(cx + Math.cos(a) * rx * k0).toFixed(1)} ${(cy + Math.sin(a) * ry * k0).toFixed(1)} L${(cx + Math.cos(a) * rx * k1).toFixed(1)} ${(cy + Math.sin(a) * ry * k1).toFixed(1)}`,
        { fill: 'none', stroke: withAlpha(p.text, i % 3 === 0 ? 0.2 : 0.1), strokeWidth: 1 },
      ),
    );
  }

  // One filled sector anchors the composition.
  const wedgeStart = rand() * Math.PI * 2;
  const wedgeSweep = 0.5 + rand() * 0.5;
  const wk = 0.62;
  const wrx = rx * wk;
  const wry = ry * wk;
  const wx0 = cx + Math.cos(wedgeStart) * wrx;
  const wy0 = cy + Math.sin(wedgeStart) * wry;
  const wx1 = cx + Math.cos(wedgeStart + wedgeSweep) * wrx;
  const wy1 = cy + Math.sin(wedgeStart + wedgeSweep) * wry;
  const large = wedgeSweep > Math.PI ? 1 : 0;
  nodes.push(
    path(
      `M${cx.toFixed(1)} ${cy.toFixed(1)} L${wx0.toFixed(1)} ${wy0.toFixed(1)} A${wrx.toFixed(1)} ${wry.toFixed(1)} 0 ${large} 1 ${wx1.toFixed(1)} ${wy1.toFixed(1)} Z`,
      { fill: withAlpha(p.accent, 0.16), stroke: withAlpha(p.accent, 0.5), strokeWidth: 1.4 },
    ),
  );

  for (let i = 1; i <= rings; i++) {
    const k = i / rings;
    const erx = rx * k;
    const ery = ry * k;
    const start = rand() * Math.PI * 2;
    const sweep = Math.PI * (0.7 + rand() * 1.5);
    const x0 = cx + Math.cos(start) * erx;
    const y0 = cy + Math.sin(start) * ery;
    const x1 = cx + Math.cos(start + sweep) * erx;
    const y1 = cy + Math.sin(start + sweep) * ery;
    const big = sweep > Math.PI ? 1 : 0;
    const isAccent = i % 4 === 0;
    nodes.push(
      path(`M${x0.toFixed(1)} ${y0.toFixed(1)} A${erx.toFixed(1)} ${ery.toFixed(1)} 0 ${big} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`, {
        fill: 'none',
        stroke: isAccent ? withAlpha(p.accent, 0.9) : withAlpha(p.text, 0.3),
        strokeWidth: isAccent ? 3.4 : 1.7,
        linecap: 'round',
        dash: !isAccent && i % 3 === 0 ? '3 10' : undefined,
      }),
    );
    nodes.push(circle(x1, y1, isAccent ? 7 : 4, isAccent ? p.accent : withAlpha(p.text, 0.55)));
  }

  // Graduated ticks on the outer ring.
  const ticks = 48;
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    const long = i % 4 === 0;
    const k0 = 1.02;
    const k1 = 1.02 + (long ? 20 : 9) / Math.max(rx, ry);
    nodes.push(
      path(
        `M${(cx + Math.cos(a) * rx * k0).toFixed(1)} ${(cy + Math.sin(a) * ry * k0).toFixed(1)} L${(cx + Math.cos(a) * rx * k1).toFixed(1)} ${(cy + Math.sin(a) * ry * k1).toFixed(1)}`,
        { fill: 'none', stroke: withAlpha(p.text, long ? 0.45 : 0.2), strokeWidth: long ? 2 : 1.1 },
      ),
    );
  }
  nodes.push(circle(cx, cy, Math.min(rx, ry) * 0.09, withAlpha(p.accent, 0.2)));
  nodes.push(circle(cx, cy, 4, p.accent));
  return nodes;
}

function halftone(rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number): Node[] {
  const nodes: Node[] = [];
  const cols = 14 + Math.round(density * 14);
  const step = zone.w / cols;
  const rows = Math.max(6, Math.round(zone.h / step));
  const focusX = zone.x + zone.w * (0.3 + rand() * 0.4);
  const focusY = zone.y + zone.h * (0.3 + rand() * 0.4);
  const maxR = step * 0.48;
  const reach = Math.hypot(zone.w, zone.h) * 0.62;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = zone.x + step * (col + 0.5);
      const cy = zone.y + step * (row + 0.5);
      const d = Math.hypot(cx - focusX, cy - focusY) / reach;
      const wave = 0.5 + 0.5 * Math.sin(col * 0.55 + row * 0.31 + d * 5);
      const mass = clamp01((1 - d) * 0.85 + wave * 0.35);
      const r = maxR * (0.12 + mass * 0.9);
      if (r < 0.7) continue;
      const accent = mass > 0.72;
      nodes.push(circle(cx, cy, r, withAlpha(accent ? p.accent : p.text, accent ? 0.85 : 0.16 + mass * 0.24)));
    }
  }
  nodes.push(circle(focusX, focusY, maxR * 0.35, withAlpha(p.accent, 0.9)));
  return nodes;
}

function isometric(rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number): Node[] {
  const nodes: Node[] = [];
  const cols = 6 + Math.round(density * 5);
  const rows = Math.max(4, Math.round((zone.h / zone.w) * cols * 1.15));
  const tile = Math.min(zone.w / (cols + 1.2), zone.h / (rows + 1.2)) * 1.32;
  const halfW = tile / 2;
  const halfH = tile / 4;
  const baseY = zone.y + zone.h * 0.76;
  const tallest = zone.h * 0.46;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = zone.x + zone.w / 2 + (col - row) * halfW;
      const cy = baseY - (col + row) * halfH;
      if (cx < zone.x - halfW || cx > zone.x + zone.w + halfW) continue;
      const h = tallest * (0.14 + rand() * 0.86) * (0.55 + density * 0.65);
      const accent = rand() > 0.78;
      const top = `M${cx} ${cy - h} L${cx + halfW} ${cy - h + halfH} L${cx} ${cy - h + halfH * 2} L${cx - halfW} ${cy - h + halfH} Z`;
      const leftFace = `M${cx - halfW} ${cy - h + halfH} L${cx} ${cy - h + halfH * 2} L${cx} ${cy + halfH * 2} L${cx - halfW} ${cy + halfH} Z`;
      const rightFace = `M${cx + halfW} ${cy - h + halfH} L${cx} ${cy - h + halfH * 2} L${cx} ${cy + halfH * 2} L${cx + halfW} ${cy + halfH} Z`;
      nodes.push(path(top, { fill: withAlpha(accent ? p.accent : p.text, accent ? 0.55 : 0.16), stroke: withAlpha(p.text, 0.32), strokeWidth: 1.3, linejoin: 'round' }));
      nodes.push(path(leftFace, { fill: withAlpha(accent ? p.accent : p.text, accent ? 0.24 : 0.07), stroke: withAlpha(p.text, 0.26), strokeWidth: 1.3, linejoin: 'round' }));
      nodes.push(path(rightFace, { fill: withAlpha(accent ? p.accent : p.text, accent ? 0.38 : 0.11), stroke: withAlpha(p.text, 0.26), strokeWidth: 1.3, linejoin: 'round' }));
    }
  }
  nodes.push(rect(zone.x, baseY + halfH * 2, zone.w, 1, withAlpha(p.text, 0.32)));
  // Depth cue: faint horizon lines behind the blocks.
  for (let i = -rows; i <= cols; i++) {
    const y = baseY + halfH * 2 + i * halfH * 0.5;
    if (y < zone.y || y > zone.y + zone.h) continue;
    nodes.push(rect(zone.x, y, zone.w, 1, withAlpha(p.text, 0.05)));
  }
  return nodes;
}

function flowfield(rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number): Node[] {
  const nodes: Node[] = [];
  const lines = 26 + Math.round(density * 34);
  const steps = 52;
  const field = (nx: number, ny: number) =>
    Math.PI * 2 * (Math.sin(nx * 2.1 + 0.6) * 0.5 + Math.cos(ny * 1.7 - 0.4) * 0.5) + Math.sin((nx + ny) * 3.1) * 0.7;
  for (let i = 0; i < lines; i++) {
    let nx = rand();
    let ny = rand();
    const points: string[] = [];
    const bright = i % 7 === 0;
    for (let s = 0; s <= steps; s++) {
      points.push(`${s === 0 ? 'M' : 'L'}${(zone.x + nx * zone.w).toFixed(1)} ${(zone.y + ny * zone.h).toFixed(1)}`);
      const theta = field(nx, ny);
      nx += Math.cos(theta) * 0.014;
      ny += Math.sin(theta) * 0.014;
      if (nx < -0.05 || nx > 1.05 || ny < -0.05 || ny > 1.05) break;
    }
    if (points.length < 3) continue;
    nodes.push(
      path(points.join(''), {
        fill: 'none',
        stroke: bright ? withAlpha(p.accent, 0.85) : withAlpha(p.text, 0.12 + rand() * 0.16),
        strokeWidth: bright ? 2.4 : 1.3,
        linecap: 'round',
        linejoin: 'round',
      }),
    );
  }
  // A few arrowheads read as direction rather than decoration.
  for (let i = 0; i < 4; i++) {
    const ax = zone.x + zone.w * (0.15 + rand() * 0.7);
    const ay = zone.y + zone.h * (0.15 + rand() * 0.7);
    const theta = field((ax - zone.x) / zone.w, (ay - zone.y) / zone.h);
    const dx = Math.cos(theta) * 22;
    const dy = Math.sin(theta) * 22;
    nodes.push(
      path(
        `M${(ax - dx).toFixed(1)} ${(ay - dy).toFixed(1)} L${ax.toFixed(1)} ${ay.toFixed(1)}`,
        { fill: 'none', stroke: withAlpha(p.accent, 0.9), strokeWidth: 2.4, linecap: 'round' },
      ),
      path(
        `M${(ax - dx * 0.34 - dy * 0.34).toFixed(1)} ${(ay - dy * 0.34 + dx * 0.34).toFixed(1)} L${ax.toFixed(1)} ${ay.toFixed(1)} L${(ax - dx * 0.34 + dy * 0.34).toFixed(1)} ${(ay - dy * 0.34 - dx * 0.34).toFixed(1)}`,
        { fill: 'none', stroke: withAlpha(p.accent, 0.9), strokeWidth: 2.4, linecap: 'round', linejoin: 'round' },
      ),
    );
  }
  return nodes;
}

function constellation(rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number): Node[] {
  const nodes: Node[] = [];
  const count = 14 + Math.round(density * 26);
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i < count; i++) {
    pts.push([zone.x + (0.06 + rand() * 0.88) * zone.w, zone.y + (0.06 + rand() * 0.88) * zone.h, rand()]);
  }
  for (let i = 0; i < pts.length; i++) {
    const neighbours = pts
      .map((other, j) => ({ j, d: Math.hypot(other[0] - pts[i][0], other[1] - pts[i][1]) }))
      .filter((entry) => entry.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { j, d } of neighbours) {
      if (j < i) continue;
      nodes.push(
        path(`M${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} L${pts[j][0].toFixed(1)} ${pts[j][1].toFixed(1)}`, {
          fill: 'none',
          stroke: withAlpha(p.text, Math.max(0.08, 0.34 - d / (zone.w * 1.2))),
          strokeWidth: 1.2,
        }),
      );
    }
  }
  pts.forEach(([x, y, r], i) => {
    const accent = i % 9 === 3;
    nodes.push(circle(x, y, accent ? 8 : 2.6 + r * 3.4, accent ? p.accent : withAlpha(p.text, 0.55)));
    if (accent) nodes.push(circle(x, y, 20, 'none', { stroke: withAlpha(p.accent, 0.4), strokeWidth: 1.4, dash: '1 6' }));
  });
  return nodes;
}

function moire(rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number): Node[] {
  const nodes: Node[] = [];
  const families = 4;
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const span = Math.hypot(zone.w, zone.h);
  const spacing = 9 + (1 - density) * 16;
  for (let f = 0; f < families; f++) {
    // Wide, opposing angles are what make interference legible; a few degrees
    // apart just reads as a hatch.
    const angle = (f - 1.5) * (0.22 + rand() * 0.14);
    const lines: Node[] = [];
    const count = Math.floor(span / spacing);
    for (let i = -count; i <= count; i++) {
      const offset = i * spacing;
      lines.push(
        path(`M${(-span / 2).toFixed(1)} ${offset.toFixed(1)} L${(span / 2).toFixed(1)} ${offset.toFixed(1)}`, {
          fill: 'none',
          stroke: withAlpha(p.text, 0.09 + f * 0.035),
          strokeWidth: 1,
        }),
      );
    }
    nodes.push(group(lines, { rotate: (angle * 180) / Math.PI, rotateOrigin: [cx, cy] }));
  }
  nodes.push(circle(cx, cy, Math.min(zone.w, zone.h) * 0.3, 'none', { stroke: withAlpha(p.accent, 0.55), strokeWidth: 2, dash: '34 16' }));
  nodes.push(circle(cx, cy, 3, p.accent));
  return nodes;
}

function ribbon(rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number): Node[] {
  const nodes: Node[] = [];
  const bands = 5 + Math.round(density * 6);
  const steps = 64;
  for (let b = 0; b < bands; b++) {
    const t = b / bands;
    const baseY = zone.y + zone.h * (0.18 + t * 0.72);
    const amp = zone.h * (0.03 + rand() * 0.06);
    const thickness = zone.h * (0.03 + rand() * 0.05);
    const phase = rand() * Math.PI * 2;
    const freq = 1.2 + rand() * 2.4;
    const top: string[] = [];
    const bottom: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const nx = i / steps;
      const wave = Math.sin(nx * Math.PI * 2 * freq + phase) * amp + Math.sin(nx * Math.PI * 6.3 + phase * 1.7) * amp * 0.28;
      const x = zone.x + nx * zone.w;
      top.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${(baseY + wave).toFixed(1)}`);
      bottom.unshift(`L${x.toFixed(1)} ${(baseY + wave + thickness).toFixed(1)}`);
    }
    const d = `${top.join('')} ${bottom.join('')} Z`;
    const accent = b === Math.floor(bands * 0.7);
    nodes.push(path(d, { fill: withAlpha(accent ? p.accent : p.text, accent ? 0.4 : 0.06 + t * 0.05) }));
    if (accent) {
      nodes.push(path(top.join(''), { fill: 'none', stroke: withAlpha(p.accent, 0.95), strokeWidth: 2.6, linecap: 'round' }));
    }
  }
  return nodes;
}

const RENDERERS: Record<ArtStyle, (rand: () => number, zone: ArtZone, p: ResolvedPalette, density: number) => Node[]> = {
  topography,
  orbital,
  halftone,
  isometric,
  flowfield,
  constellation,
  moire,
  ribbon,
};

/**
 * Draw one composition. Deterministic in `(style, seed, zone, palette)` — the
 * zone is part of the seed so a full-bleed field and a framed plot of the same
 * seed are composed for their own aspect rather than stretched.
 */
export function renderArt(
  palette: ResolvedPalette,
  options: ArtOptions & { zone: ArtZone },
): Node[] {
  const density = clamp01(options.density ?? 0.5);
  const style = options.style ?? pickArtStyle(options.seed ?? 'omni');
  const seed = `${options.seed ?? 'omni'}|${style}|${Math.round(options.zone.w)}x${Math.round(options.zone.h)}`;
  const rand = seededRandom(hashString(seed));
  const nodes = RENDERERS[style](rand, options.zone, palette, density);
  const opacity = clamp01(options.opacity ?? 1);
  return opacity >= 1 ? nodes : nodes.map((node) => ({ ...node, opacity: (node.opacity ?? 1) * opacity }));
}

/**
 * Same drawing, clipped to its zone and framed with corner ticks — the layout's
 * signature. Composition functions deliberately overshoot their zone (that is
 * what makes the field read as a crop of something larger), so the clip is what
 * keeps a still-visible headline under a plot that bleeds where it should.
 */
export function framedArt(
  palette: ResolvedPalette,
  options: ArtOptions & { zone: ArtZone; frame?: boolean },
): Node[] {
  const { zone } = options;
  const nodes = renderArt(palette, options);
  const clipped = group(nodes, { clip: { x: zone.x, y: zone.y, w: zone.w, h: zone.h } });
  if (options.frame === false) return [clipped];
  return [...frameNodes(zone, palette.text, 22), clipped];
}
