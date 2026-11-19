/**
 * Engine-drawn icon set.
 *
 * These are original geometric glyphs (24x24 design box, stroke based) named
 * after the Lucide conventions most agents already know, so a plan can say
 * `"icon": "trending-up"` and get a real vector glyph with zero runtime
 * dependency, zero CDN fetch and zero license ambiguity.
 */
import { circle, group, path, round, type Node } from './svg.js';

interface IconStyle {
  color: string;
  strokeWidth?: number;
}

type Drawer = (s: IconStyle) => string[]; // returns path `d` strings drawn with stroke

const D: Record<string, Drawer> = {
  'sparkles': () => [
    'M12 3l1.7 4.6L18.3 9.3 13.7 11 12 15.6 10.3 11 5.7 9.3 10.3 7.6z',
    'M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  ],
  'trending-up': () => ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  'trending-down': () => ['M3 7l6 6 4-4 8 8', 'M15 17h6v-6'],
  'arrow-right': () => ['M4 12h16', 'M14 6l6 6-6 6'],
  'arrow-up-right': () => ['M7 17L17 7', 'M8 7h9v9'],
  'arrow-down': () => ['M12 4v16', 'M6 14l6 6 6-6'],
  'check': () => ['M4 12.5l5 5L20 6.5'],
  'x': () => ['M6 6l12 12', 'M18 6L6 18'],
  'alert-triangle': () => ['M12 3l9 16H3z', 'M12 9v5', 'M12 17h.01'],
  'target': () => ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 8a4 4 0 100 8 4 4 0 000-8z', 'M12 11.5a.5.5 0 100 1 .5.5 0 000-1z'],
  'zap': () => ['M13 2L4 14h7l-1 8 9-12h-7z'],
  'clock': () => ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 7v5l4 2'],
  'users': () => ['M8 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6', 'M16 4.5a3.5 3.5 0 010 7', 'M17.5 14c2.6.6 4.5 2.9 4.5 6'],
  'dollar-sign': () => ['M12 2v20', 'M17 6.5c0-2-2.2-3-5-3s-5 .9-5 3 2.2 3 5 3.5 5 1 5 3.5-2.2 3-5 3-5-1-5-3'],
  'bar-chart': () => ['M5 20V10', 'M11 20V4', 'M17 20v-7'],
  'layers': () => ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
  'lightbulb': () => ['M9.5 18h5', 'M10 21h4', 'M12 3a6 6 0 00-3.5 10.9c.6.4 1 1 1 1.7V16h5v-.4c0-.7.4-1.3 1-1.7A6 6 0 0012 3z'],
  'bookmark': () => ['M6 3h12v18l-6-4.5L6 21z'],
  'message-circle': () => ['M21 12a8.5 8.5 0 01-12.6 7.5L4 21l1.5-4.4A8.5 8.5 0 1121 12z'],
  'share': () => ['M8 12h8', 'M14 6l4 6-4 6', 'M4 6v12'],
  'heart': () => ['M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z'],
  'search': () => ['M11 4a7 7 0 100 14 7 7 0 000-14z', 'M16.5 16.5L21 21'],
  'compass': () => ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  'shield-check': () => ['M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z', 'M8.5 12l2.5 2.5L16 9.5'],
  'rocket': () => ['M14 3c3 1 6 4 7 7-2.5 4.5-6.5 7-11 8l-3-3c1-4.5 3.5-8.5 8-11z', 'M9 15l-3 6 6-3'],
  'brain': () => ['M9 4a3 3 0 00-3 3 3 3 0 00-1 5.8V16a3 3 0 003 3h1V4z', 'M15 4a3 3 0 013 3 3 3 0 011 5.8V16a3 3 0 01-3 3h-1V4z'],
  'bot': () => ['M5 8h14v10H5z', 'M12 4v4', 'M9 13h.01', 'M15 13h.01', 'M9 18v2', 'M15 18v2'],
  'database': () => ['M4 7c0-2 3.6-3.5 8-3.5S20 5 20 7s-3.6 3.5-8 3.5S4 9 4 7z', 'M4 7v10c0 2 3.6 3.5 8 3.5S20 19 20 17V7', 'M4 12c0 2 3.6 3.5 8 3.5S20 14 20 12'],
  'file-text': () => ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  'image': () => ['M4 5h16v14H4z', 'M8 10a1.5 1.5 0 100 .01', 'M4 17l5-4 4 3 3-2 4 3'],
  'play': () => ['M8 5l11 7-11 7z'],
  'lock': () => ['M6 11h12v9H6z', 'M9 11V8a3 3 0 016 0v3'],
  'flame': () => ['M12 3c4 4 6 6.5 6 10a6 6 0 11-12 0c0-2 1-3.5 2.5-5C9 10 10 11 11 11c0-3 0-5 1-8z'],
  'thumbs-up': () => ['M7 21V10l4-7c1.5 0 2.5 1 2.5 2.5V10H19l-1.5 11z'],
  'grid': () => ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  'repeat': () => ['M4 9V7a3 3 0 013-3h10l-2-2', 'M20 15v2a3 3 0 01-3 3H7l2 2'],
  'eye': () => ['M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12z', 'M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z'],
  'book': () => ['M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2z', 'M8 3v18'],
  'cpu': () => ['M8 8h8v8H8z', 'M4 9h4', 'M4 15h4', 'M16 9h4', 'M16 15h4', 'M9 4v4', 'M15 4v4', 'M9 16v4', 'M15 16v4'],
  'git-branch': () => ['M6 4v12', 'M6 20a2 2 0 100-4 2 2 0 000 4z', 'M18 8a2 2 0 100-4 2 2 0 000 4z', 'M18 8v2a4 4 0 01-4 4H9'],
  'pen': () => ['M4 20l4-1 11-11-3-3L5 16z', 'M13 5l3 3'],
  'magnet': () => ['M6 4v8a6 6 0 0012 0V4h-4v8a2 2 0 01-4 0V4z'],
};

export const ICON_NAMES = Object.keys(D).sort();

export function hasIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(D, name.trim().toLowerCase());
}

/**
 * Draws an icon fitted into a box of `size` px with its top-left at (x, y).
 * Falls back to a neutral sparkle so an unknown name never breaks a render.
 */
export function drawIcon(x: number, y: number, size: number, name: string, style: IconStyle): Node[] {
  const key = name.trim().toLowerCase().replace(/\s+/g, '-');
  const drawer = D[key] ?? D['sparkles'];
  const scale = size / 24;
  // Stroke width is expressed in the 24px design box, so it scales with the glyph.
  const strokeWidth = style.strokeWidth ?? 2;
  const nodes: Node[] = [];
  for (const d of drawer({ color: style.color })) {
    nodes.push(
      path(d, {
        fill: 'none',
        stroke: style.color,
        strokeWidth,
        linecap: 'round',
        linejoin: 'round',
      }),
    );
  }
  if (key === 'target') {
    nodes.push(circle(12, 12, 1.6, style.color));
  }
  if (!nodes.length) return [];
  // One transform instead of rewriting path data: keeps every command intact.
  const scaleText = String(Math.round(scale * 10000) / 10000);
  return [group(nodes, { transform: `translate(${round(x)} ${round(y)}) scale(${scaleText})` })];
}

/** A filled five-point star used for ratings/social proof accents. */
export function starPath(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)} ${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}
