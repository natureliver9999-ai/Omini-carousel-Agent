/**
 * Offline diagram renderer (the engine half of `make_diagram`).
 *
 * Mermaid's CDN is not available inside a locked-down MCP host, and a headless
 * browser just to draw four boxes is a bad trade. This module supports the subset
 * that actually appears in carousels — linear flows, small branches, and labelled
 * edges — and falls back to a clearly labelled list when it meets anything else.
 */
import { withAlpha } from '../colors.js';
import { loadTheme, resolvePalette } from '../themes.js';
import { escapeXml } from '../svg.js';

export interface DiagramOptions {
  theme?: string;
  width?: number;
  direction?: 'TD' | 'LR';
  title?: string;
}

interface DiagramNode { id: string; label: string }
interface DiagramEdge { from: string; to: string; label?: string }

const NODE_RE = /([A-Za-z0-9_]+)\s*(?:\[\s*"?([^"\]]*)"?\s*\]|\(\s*"?([^")]*)"?\s*\)|\{\s*"?([^"}]*)"?\s*\})?/g;
const EDGE_RE = /-{1,3}>|-->\s*\|([^|]*)\|/;

export function parseMermaid(source: string): { nodes: DiagramNode[]; edges: DiagramEdge[]; title?: string } {
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];
  let title: string | undefined;
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);

  for (const raw of lines) {
    const line = raw.replace(/;+$/, '');
    if (/^(graph|flowchart)\b/i.test(line)) continue;
    if (/^(%%|#)/.test(line)) continue;
    if (/^title\s+/i.test(line)) { title = line.replace(/^title\s+/i, ''); continue; }
    if (/^(subgraph|end|classDef|class|style|click|linkStyle)\b/i.test(line)) continue;

    const [left, right] = splitEdge(line);
    const register = (segment: string): string | undefined => {
      NODE_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      let last: string | undefined;
      while ((match = NODE_RE.exec(segment))) {
        const id = match[1];
        const label = (match[2] ?? match[3] ?? match[4] ?? id).trim();
        if (!nodes.has(id)) nodes.set(id, { id, label: label || id });
        last = id;
        if (NODE_RE.lastIndex === match.index) NODE_RE.lastIndex += 1;
      }
      return last;
    };

    if (!right) { register(left); continue; }
    const from = register(left);
    const to = register(right.target);
    if (from && to) edges.push({ from, to, label: right.label });
  }
  return { nodes: [...nodes.values()], edges, title };
}

function splitEdge(line: string): [string, { target: string; label?: string } | null] {
  const labelled = line.match(/^(.+?)\s*--\s*\|([^|]*)\|\s*(.+)$/);
  if (labelled) return [labelled[1].trim(), { target: labelled[3].trim(), label: labelled[2].trim() }];
  const plain = line.match(/^(.+?)\s*(?:-{1,3}>|==>|-\.->)\s*(.+)$/);
  if (plain) return [plain[1].trim(), { target: plain[2].trim() }];
  return [line, null];
}

/** Renders the parsed diagram as a self-contained, theme-aware SVG. */
export function renderDiagramSvg(source: string, options: DiagramOptions = {}): string {
  const theme = loadTheme(options.theme ?? 'editorial');
  const palette = resolvePalette(theme);
  const { nodes, edges, title } = parseMermaid(source);
  if (nodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><rect width="600" height="120" fill="${palette.bg}"/><text x="24" y="64" font-family="Inter" font-size="18" fill="${palette.textMuted}">No nodes found in diagram source</text></svg>`;
  }

  // Layered layout: longest-path depth from roots, columns by depth.
  const incoming = new Map<string, number>();
  nodes.forEach((n) => incoming.set(n.id, 0));
  edges.forEach((e) => incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1));
  const depth = new Map<string, number>();
  const visit = (id: string, d: number) => {
    if ((depth.get(id) ?? -1) >= d) return;
    depth.set(id, d);
    edges.filter((e) => e.from === id).forEach((e) => visit(e.to, d + 1));
  };
  nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).forEach((n) => visit(n.id, 0));
  nodes.forEach((n) => { if (!depth.has(n.id)) depth.set(n.id, 0); });

  const maxDepth = Math.max(...[...depth.values()]);
  const byDepth = new Map<number, DiagramNode[]>();
  nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  });

  const horizontal = (options.direction ?? 'LR') === 'LR';
  const padding = 32;
  const nodeW = horizontal ? 220 : 320;
  const nodeH = 78;
  const gapX = 70;
  const gapY = 44;
  const maxPerRow = Math.max(...[...byDepth.values()].map((list) => list.length));
  const width = options.width ?? (horizontal ? padding * 2 + (maxDepth + 1) * nodeW + maxDepth * gapX : padding * 2 + nodeW);
  const height = horizontal
    ? padding * 2 + Math.max(1, maxPerRow) * nodeH + (Math.max(1, maxPerRow) - 1) * gapY + (title ? 34 : 0)
    : padding * 2 + (maxDepth + 1) * nodeH + maxDepth * gapY + (title ? 34 : 0);

  const positions = new Map<string, { x: number; y: number }>();
  byDepth.forEach((list, d) => {
    list.forEach((node, i) => {
      const offset = (maxPerRow - list.length) / 2;
      const x = horizontal
        ? padding + d * (nodeW + gapX)
        : padding + nodeW / 2;
      const y = horizontal
        ? padding + (title ? 34 : 0) + (i + offset) * (nodeH + gapY)
        : padding + (title ? 34 : 0) + d * (nodeH + gapY);
      positions.set(node.id, { x, y });
    });
  });

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${palette.bg}"/>`,
  ];
  if (title) {
    parts.push(`<text x="${padding}" y="${padding + 8}" font-family="${theme.typography.body_font}" font-size="22" font-weight="700" fill="${palette.textMuted}">${escapeXml(title.toUpperCase())}</text>`);
  }

  // Edges first so nodes sit on top.
  for (const edge of edges) {
    const a = positions.get(edge.from);
    const b = positions.get(edge.to);
    if (!a || !b) continue;
    if (horizontal) {
      const x1 = a.x + nodeW;
      const y1 = a.y + nodeH / 2;
      const x2 = b.x;
      const y2 = b.y + nodeH / 2;
      const mid = (x1 + x2) / 2;
      parts.push(`<path d="M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2 - 10} ${y2}" fill="none" stroke="${withAlpha(palette.text, 0.45)}" stroke-width="2.5"/>`);
      parts.push(arrowHead(x2, y2, 0, palette.text));
      if (edge.label) parts.push(`<text x="${mid}" y="${(y1 + y2) / 2 - 10}" font-family="${theme.typography.body_font}" font-size="16" fill="${palette.textMuted}" text-anchor="middle">${escapeXml(edge.label)}</text>`);
    } else {
      const x1 = a.x + nodeW / 2;
      const y1 = a.y + nodeH;
      const x2 = b.x + nodeW / 2;
      const y2 = b.y;
      parts.push(`<path d="M${x1} ${y1} L${x2} ${y2 - 10}" fill="none" stroke="${withAlpha(palette.text, 0.45)}" stroke-width="2.5"/>`);
      parts.push(arrowHead(x2, y2, 90, palette.text));
      if (edge.label) parts.push(`<text x="${(x1 + x2) / 2 + 10}" y="${(y1 + y2) / 2}" font-family="${theme.typography.body_font}" font-size="16" fill="${palette.textMuted}">${escapeXml(edge.label)}</text>`);
    }
  }

  for (const node of nodes) {
    const pos = positions.get(node.id)!;
    const isAccent = (incoming.get(node.id) ?? 0) === 0;
    parts.push(`<rect x="${pos.x}" y="${pos.y}" width="${nodeW}" height="${nodeH}" rx="14" fill="${isAccent ? withAlpha(palette.accent, 0.12) : palette.surface}" stroke="${isAccent ? palette.accent : withAlpha(palette.text, 0.2)}" stroke-width="2"/>`);
    const label = node.label.length > 34 ? `${node.label.slice(0, 33)}…` : node.label;
    parts.push(`<text x="${pos.x + nodeW / 2}" y="${pos.y + nodeH / 2 + 7}" font-family="${theme.typography.body_font}" font-size="19" font-weight="600" fill="${palette.text}" text-anchor="middle">${escapeXml(label)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

function arrowHead(x: number, y: number, rotation: number, color: string): string {
  return `<path d="M${x - 12} ${y - 7} L${x} ${y} L${x - 12} ${y + 7}" fill="none" stroke="${color}" stroke-width="2.5" transform="rotate(${rotation} ${x} ${y})"/>`;
}

/** Convenience: the diagram as a base64 data URI usable inside an SVG scene. */
export function diagramDataUri(source: string, options: DiagramOptions = {}): string {
  return `data:image/svg+xml;base64,${Buffer.from(renderDiagramSvg(source, options)).toString('base64')}`;
}
