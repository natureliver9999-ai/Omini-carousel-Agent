/**
 * Minimal, dependency-free TrueType/OpenType metrics reader.
 *
 * Why hand-rolled: the engine must measure and wrap text identically on every
 * platform, without a browser and without loading 15 MB of font tools. We only
 * need advance widths (hmtx), a character map (cmap), units-per-em (head) and
 * vertical metrics (hhea/OS2), which is a few hundred lines of DataView work.
 *
 * Kerning is intentionally ignored: measured widths come out marginally wider
 * than the rasterizer's kerned output, which keeps wrapping conservative and
 * therefore never clips a glyph.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface FontFace {
  readonly family: string;
  readonly weight: number;
  readonly style: 'normal' | 'italic';
  readonly file: string;
  readonly unitsPerEm: number;
  readonly ascent: number;
  readonly descent: number;
  readonly capHeight: number;
  readonly xHeight: number;
  advance(codepoint: number): number;
  hasGlyph(codepoint: number): boolean;
}

const FONT_DIR_CANDIDATES = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fonts'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fonts'),
  path.resolve(process.cwd(), 'core-engine/fonts'),
  path.resolve(process.cwd(), 'fonts'),
];

export function resolveFontDir(): string {
  for (const dir of FONT_DIR_CANDIDATES) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.ttf'))) return dir;
    } catch {
      /* ignore */
    }
  }
  // Last resort: DejaVu is present on nearly every Linux image.
  return '/usr/share/fonts/truetype/dejavu';
}

/** Maps bundled file names onto (family, weight, style). */
function describeFile(file: string): { family: string; weight: number; style: 'normal' | 'italic' } | null {
  const base = path.basename(file, path.extname(file));
  const m = /^([A-Za-z]+(?:Serif|Mono|Grotesk|Sans)?)_(\d{3})([A-Za-z]+)(_Italic)?$/.exec(base);
  if (m) {
    const familyMap: Record<string, string> = {
      Inter: 'Inter',
      SpaceGrotesk: 'Space Grotesk',
      InstrumentSerif: 'Instrument Serif',
      JetBrainsMono: 'JetBrains Mono',
      Caveat: 'Caveat',
      DejaVuSans: 'DejaVu Sans',
      DejaVuSerif: 'DejaVu Serif',
    };
    const family = familyMap[m[1]] ?? m[1];
    return { family, weight: Number(m[2]), style: m[4] ? 'italic' : 'normal' };
  }
  const dejavu: Record<string, [string, number, 'normal' | 'italic']> = {
    'DejaVuSans': ['DejaVu Sans', 400, 'normal'],
    'DejaVuSans-Bold': ['DejaVu Sans', 700, 'normal'],
    'DejaVuSans-Oblique': ['DejaVu Sans', 400, 'italic'],
    'DejaVuSans-BoldOblique': ['DejaVu Sans', 700, 'italic'],
    'DejaVuSerif': ['DejaVu Serif', 400, 'normal'],
    'DejaVuSerif-Bold': ['DejaVu Serif', 700, 'normal'],
  };
  const hit = dejavu[base];
  return hit ? { family: hit[0], weight: hit[1], style: hit[2] } : null;
}

interface TableRecord {
  offset: number;
  length: number;
}

class TtfReader {
  private readonly view: DataView;
  private readonly tables = new Map<string, TableRecord>();

  constructor(readonly buffer: Buffer) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const numTables = this.u16(4);
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      const tag = String.fromCharCode(
        this.view.getUint8(rec),
        this.view.getUint8(rec + 1),
        this.view.getUint8(rec + 2),
        this.view.getUint8(rec + 3),
      );
      this.tables.set(tag, { offset: this.u32(rec + 8), length: this.u32(rec + 12) });
    }
  }

  u8(o: number): number { return this.view.getUint8(o); }
  u16(o: number): number { return this.view.getUint16(o, false); }
  i16(o: number): number { return this.view.getInt16(o, false); }
  u32(o: number): number { return this.view.getUint32(o, false); }

  has(tag: string): boolean { return this.tables.has(tag); }
  table(tag: string): TableRecord {
    const t = this.tables.get(tag);
    if (!t) throw new Error(`missing TTF table ${tag}`);
    return t;
  }

  /** cmap format 4 + format 12 lookups, built lazily into a Map. */
  buildCmap(): { map: Map<number, number>; max: number } {
    const map = new Map<number, number>();
    const { offset } = this.table('cmap');
    const numSubtables = this.u16(offset + 2);
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < numSubtables; i++) {
      const rec = offset + 4 + i * 8;
      const platform = this.u16(rec);
      const encoding = this.u16(rec + 2);
      const sub = offset + this.u32(rec + 4);
      const format = this.u16(sub);
      let score = 0;
      if (format === 4 && platform === 3 && (encoding === 1 || encoding === 0)) score = 3;
      if (format === 12 && platform === 3 && encoding === 10) score = 4;
      if (format === 6) score = 2;
      if (score > bestScore) { bestScore = score; best = sub; }
    }
    if (best < 0) return { map, max: 0 };
    const format = this.u16(best);
    let max = 0;
    if (format === 4) {
      const segCountX2 = this.u16(best + 6);
      const segCount = segCountX2 / 2;
      const endBase = best + 14;
      const startBase = endBase + segCountX2 + 2;
      const deltaBase = startBase + segCountX2;
      const rangeBase = deltaBase + segCountX2;
      for (let s = 0; s < segCount; s++) {
        const end = this.u16(endBase + s * 2);
        const start = this.u16(startBase + s * 2);
        const delta = this.i16(deltaBase + s * 2);
        const rangeOffsetPos = rangeBase + s * 2;
        const rangeOffset = this.u16(rangeOffsetPos);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph: number;
          if (rangeOffset === 0) {
            glyph = (c + delta) & 0xffff;
          } else {
            const glyphPos = rangeOffsetPos + rangeOffset + (c - start) * 2;
            if (glyphPos + 1 >= this.buffer.length) continue;
            glyph = this.u16(glyphPos);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) { map.set(c, glyph); if (c > max) max = c; }
        }
      }
    } else if (format === 12) {
      const nGroups = this.u32(best + 12);
      for (let g = 0; g < nGroups; g++) {
        const rec = best + 16 + g * 12;
        const start = this.u32(rec);
        const end = this.u32(rec + 4);
        const startGlyph = this.u32(rec + 8);
        for (let c = start; c <= end; c++) {
          map.set(c, startGlyph + (c - start));
          if (c > max) max = c;
        }
      }
    }
    return { map, max };
  }
}

function loadFace(file: string): FontFace | null {
  const desc = describeFile(file);
  if (!desc) return null;
  let reader: TtfReader;
  try {
    reader = new TtfReader(fs.readFileSync(file));
  } catch {
    return null;
  }
  let unitsPerEm = 1000;
  try { unitsPerEm = reader.u16(reader.table('head').offset + 18) || 1000; } catch { /* default */ }
  let ascent = Math.round(unitsPerEm * 0.8);
  let descent = -Math.round(unitsPerEm * 0.2);
  try {
    const hhea = reader.table('hhea').offset;
    ascent = reader.i16(hhea + 4);
    descent = reader.i16(hhea + 6);
  } catch { /* default */ }
  let capHeight = Math.round(ascent * 0.72);
  let xHeight = Math.round(ascent * 0.52);
  try {
    const os2 = reader.table('OS/2').offset;
    const version = reader.u16(os2);
    if (version >= 2) {
      xHeight = reader.i16(os2 + 86) || xHeight;
      capHeight = reader.i16(os2 + 88) || capHeight;
    }
  } catch { /* default */ }

  let advances: Uint16Array = new Uint16Array(0);
  try {
    const hhea = reader.table('hhea').offset;
    const numberOfHMetrics = reader.u16(hhea + 34);
    const hmtx = reader.table('hmtx').offset;
    advances = new Uint16Array(numberOfHMetrics);
    for (let i = 0; i < numberOfHMetrics; i++) advances[i] = reader.u16(hmtx + i * 4);
  } catch { /* default */ }

  const cmap = reader.buildCmap();
  const fallbackAdvance = advances.length ? advances[0] : Math.round(unitsPerEm * 0.5);

  return {
    family: desc.family,
    weight: desc.weight,
    style: desc.style,
    file,
    unitsPerEm,
    ascent,
    descent,
    capHeight,
    xHeight,
    advance(codepoint: number): number {
      const glyph = cmap.map.get(codepoint);
      if (glyph === undefined) return fallbackAdvance;
      if (advances.length === 0) return fallbackAdvance;
      if (glyph < advances.length) return advances[glyph];
      return advances[advances.length - 1];
    },
    hasGlyph(codepoint: number): boolean {
      return cmap.map.has(codepoint);
    },
  };
}

let registry: FontFace[] | null = null;

export function fontRegistry(): FontFace[] {
  if (registry) return registry;
  const dir = resolveFontDir();
  const faces: FontFace[] = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!/\.(ttf|otf)$/i.test(name)) continue;
      const face = loadFace(path.join(dir, name));
      if (face) faces.push(face);
    }
  } catch {
    /* no fonts available */
  }
  if (faces.length === 0) {
    throw new Error(
      `No usable font files found in ${dir}. Reinstall @omni-carousel/engine (bundled OFL fonts) or install fonts-dejavu.`,
    );
  }
  registry = faces;
  return faces;
}

export function fontFiles(): string[] {
  return fontRegistry().map((f) => f.file);
}

const NEAREST_WEIGHT: Record<string, number[]> = {};

export function selectFace(family: string, weight = 400, style: 'normal' | 'italic' = 'normal'): FontFace {
  const faces = fontRegistry();
  const candidates = faces.filter((f) => f.family.toLowerCase() === family.toLowerCase());
  const pool = candidates.length ? candidates : faces.filter((f) => f.family === 'Inter');
  const usable = pool.length ? pool : faces;
  const stylePool = usable.filter((f) => f.style === style);
  const finalPool = stylePool.length ? stylePool : usable;
  let best = finalPool[0];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const face of finalPool) {
    const delta = Math.abs(face.weight - weight);
    if (delta < bestDelta) { best = face; bestDelta = delta; }
  }
  void NEAREST_WEIGHT;
  return best;
}

/** Advance width of a single line, in CSS pixels. */
export function measureText(text: string, opts: { family: string; size: number; weight?: number; style?: 'normal' | 'italic'; letterSpacing?: number }): number {
  const face = selectFace(opts.family, opts.weight ?? 400, opts.style ?? 'normal');
  let units = 0;
  for (const ch of text) units += face.advance(ch.codePointAt(0) ?? 32);
  const px = (units / face.unitsPerEm) * opts.size;
  const spacing = (opts.letterSpacing ?? 0) * Math.max(0, [...text].length - 1);
  return px + spacing;
}

export function faceMetrics(family: string, weight = 400, style: 'normal' | 'italic' = 'normal') {
  const face = selectFace(family, weight, style);
  return {
    ascentRatio: face.ascent / face.unitsPerEm,
    descentRatio: -face.descent / face.unitsPerEm,
    capRatio: face.capHeight / face.unitsPerEm,
    xRatio: face.xHeight / face.unitsPerEm,
    face,
  };
}
