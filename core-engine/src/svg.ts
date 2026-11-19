/**
 * A tiny vector scene model.
 *
 * Every layout emits `Node[]`, which the engine serializes either to SVG (resvg
 * raster path, and the browser HTML deck) or to CSS/HTML for the Playwright path.
 * One scene, two backends: what you preview is what you ship.
 */

export interface BaseNode {
  opacity?: number;
  rotate?: number;
  /** Rotation origin; defaults to the node's visual centre. */
  rotateOrigin?: [number, number];
  id?: string;
}

export interface RectNode extends BaseNode {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  dash?: string;
}

export interface CircleNode extends BaseNode {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
}

export interface PathNode extends BaseNode {
  type: 'path';
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  linecap?: 'butt' | 'round' | 'square';
  linejoin?: 'miter' | 'round' | 'bevel';
  dash?: string;
}

export interface TextNode extends BaseNode {
  type: 'text';
  x: number;
  y: number;
  text: string;
  family: string;
  size: number;
  weight?: number;
  style?: 'normal' | 'italic';
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
  /** Optional stroke used as faux-bold when a face is unavailable. */
  strokeWidth?: number;
  stroke?: string;
}

export interface ImageNode extends BaseNode {
  type: 'image';
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
}

export interface GroupNode extends BaseNode {
  type: 'group';
  transform?: string;
  children: Node[];
}

export type Node = RectNode | CircleNode | PathNode | TextNode | ImageNode | GroupNode;

export const rect = (x: number, y: number, w: number, h: number, fill: string, extra: Omit<RectNode, 'type' | 'x' | 'y' | 'w' | 'h' | 'fill'> = {}): RectNode => ({
  type: 'rect', x, y, w, h, fill, ...extra,
});

export const circle = (cx: number, cy: number, r: number, fill: string, extra: Omit<CircleNode, 'type' | 'cx' | 'cy' | 'r' | 'fill'> = {}): CircleNode => ({
  type: 'circle', cx, cy, r, fill, ...extra,
});

export const path = (d: string, extra: Omit<PathNode, 'type' | 'd'> = {}): PathNode => ({ type: 'path', d, ...extra });

export const text = (x: number, y: number, value: string, opts: {
  family: string; size: number; weight?: number; style?: 'normal' | 'italic'; fill: string;
  anchor?: 'start' | 'middle' | 'end'; letterSpacing?: number; opacity?: number; stroke?: string; strokeWidth?: number;
}): TextNode => ({
  type: 'text', x, y, text: value,
  family: opts.family, size: opts.size, weight: opts.weight ?? 400, style: opts.style ?? 'normal',
  fill: opts.fill, anchor: opts.anchor, letterSpacing: opts.letterSpacing,
  opacity: opts.opacity, stroke: opts.stroke, strokeWidth: opts.strokeWidth,
});

export const group = (children: Node[], extra: Omit<GroupNode, 'type' | 'children'> = {}): GroupNode => ({
  type: 'group', children, ...extra,
});

export const image = (href: string, x: number, y: number, w: number, h: number, extra: Omit<ImageNode, 'type' | 'href' | 'x' | 'y' | 'w' | 'h'> = {}): ImageNode => ({
  type: 'image', href, x, y, w, h, ...extra,
});

const escapeCache = new Map<string, string>();

export function escapeXml(value: string): string {
  const cached = escapeCache.get(value);
  if (cached !== undefined) return cached;
  const out = value
    // strip control characters that XML 1.0 forbids outright
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  if (escapeCache.size < 4096) escapeCache.set(value, out);
  return out;
}

function attrs(map: Record<string, string | number | undefined>): string {
  let out = '';
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined || value === '') continue;
    out += ` ${key}="${typeof value === 'number' ? round(value) : escapeXml(String(value))}"`;
  }
  return out;
}

export function round(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 100);
}

function rotationAttributes(node: BaseNode, fallbackCx: number, fallbackCy: number): Record<string, string> {
  if (!node.rotate) return {};
  const [cx, cy] = node.rotateOrigin ?? [fallbackCx, fallbackCy];
  return { transform: `rotate(${round(node.rotate)} ${round(cx)} ${round(cy)})` };
}

export function nodeToSvg(node: Node): string {
  const common: Record<string, string | number | undefined> = {
    opacity: node.opacity !== undefined && node.opacity !== 1 ? node.opacity : undefined,
  };
  switch (node.type) {
    case 'rect': {
      const rot = rotationAttributes(node, node.x + node.w / 2, node.y + node.h / 2);
      return `<rect${attrs({ ...common, ...rot, x: node.x, y: node.y, width: node.w, height: node.h, rx: node.rx, fill: node.fill, stroke: node.stroke, 'stroke-width': node.strokeWidth, 'stroke-dasharray': node.dash })}/>`;
    }
    case 'circle': {
      const rot = rotationAttributes(node, node.cx, node.cy);
      return `<circle${attrs({ ...common, ...rot, cx: node.cx, cy: node.cy, r: node.r, fill: node.fill, stroke: node.stroke, 'stroke-width': node.strokeWidth, 'stroke-dasharray': node.dash })}/>`;
    }
    case 'path': {
      const rot = rotationAttributes(node, 0, 0);
      return `<path${attrs({ ...common, ...rot, d: node.d, fill: node.fill ?? 'none', stroke: node.stroke, 'stroke-width': node.strokeWidth, 'stroke-linecap': node.linecap, 'stroke-linejoin': node.linejoin, 'stroke-dasharray': node.dash })}/>`;
    }
    case 'text': {
      // text-anchor + explicit y keeps baselines identical across backends
      return `<text${attrs({
        ...common,
        x: node.x,
        y: node.y,
        'font-family': node.family,
        'font-size': node.size,
        'font-weight': node.weight,
        'font-style': node.style === 'italic' ? 'italic' : undefined,
        fill: node.fill,
        'text-anchor': node.anchor,
        'letter-spacing': node.letterSpacing,
        stroke: node.stroke,
        'stroke-width': node.strokeWidth,
      })}>${escapeXml(node.text)}</text>`;
    }
    case 'image': {
      return `<image${attrs({ ...common, href: node.href, x: node.x, y: node.y, width: node.w, height: node.h, preserveAspectRatio: 'xMidYMid slice', clip_path: node.rx ? `inset(0 round ${node.rx}px)` : undefined })}/>`;
    }
    case 'group': {
      const rot = rotationAttributes(node, 0, 0);
      const transform = [node.transform, rot.transform].filter(Boolean).join(' ');
      return `<g${attrs({ ...common, transform })}>${node.children.map(nodeToSvg).join('')}</g>`;
    }
  }
}

export interface Scene {
  width: number;
  height: number;
  nodes: Node[];
  background: string;
}

/**
 * Serializes a scene to a standalone SVG document (no external CSS or fonts).
 * `portion` lets a wide panorama scene be previewed as a single 1080-wide frame
 * without duplicating any drawing code.
 */
export function sceneToSvg(scene: Scene, portion?: { x: number; width: number; height?: number }): string {
  const vb = portion
    ? `viewBox="${portion.x} 0 ${portion.width} ${portion.height ?? scene.height}"`
    : `viewBox="0 0 ${scene.width} ${scene.height}"`;
  const width = portion ? portion.width : scene.width;
  const height = portion ? (portion.height ?? scene.height) : scene.height;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" ${vb}>`,
    `<rect x="0" y="0" width="${scene.width}" height="${scene.height}" fill="${scene.background}"/>`,
    scene.nodes.map(nodeToSvg).join(''),
    '</svg>',
  ].join('');
}

/** Translates every node by (dx, dy) — used to place slide-local art on a panorama canvas. */
export function translateScene(nodes: Node[], dx: number, dy: number): Node[] {
  return nodes.map((node) => {
    switch (node.type) {
      case 'rect': return { ...node, x: node.x + dx, y: node.y + dy };
      case 'circle': return { ...node, cx: node.cx + dx, cy: node.cy + dy };
      case 'text': return { ...node, x: node.x + dx, y: node.y + dy };
      case 'image': return { ...node, x: node.x + dx, y: node.y + dy };
      case 'group': return { ...node, transform: `translate(${round(dx)} ${round(dy)}) ${node.transform ?? ''}`.trim(), children: node.children };
      case 'path': return { ...node, d: translatePath(node.d, dx, dy) };
    }
  });
}

/** Naive but safe path translation for absolute-coordinate path data. */
function translatePath(d: string, dx: number, dy: number): string {
  if (dx === 0 && dy === 0) return d;
  return d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_m, x: string, y: string) => `${round(Number(x) + dx)} ${round(Number(y) + dy)}`);
}
