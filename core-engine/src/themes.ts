/**
 * Theme loading + resolution.
 *
 * A theme is pure data (JSON) so an agent can invent its own palette in-context
 * and still render deterministically. Every theme is audited for WCAG AA contrast
 * at load time; violations are reported by the linter and auto-repaired for
 * rendering so a slide is never shipped unreadable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { contrastRatio, ensureContrast, mix, withAlpha, bestOn } from './colors.js';

const HexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

export const ThemeColorsSchema = z.object({
  bg_primary: HexColor,
  bg_secondary: HexColor,
  bg_surface: HexColor,
  bg_elevated: HexColor,
  text_primary: HexColor,
  text_secondary: HexColor,
  text_muted: HexColor,
  accent: HexColor,
  accent_soft: HexColor,
  accent_text: HexColor,
  border: HexColor,
  border_strong: HexColor,
  success: HexColor,
  success_soft: HexColor,
  danger: HexColor,
  danger_soft: HexColor,
  chart_palette: z.array(HexColor).min(3).max(10),
});

export const ThemeTypographySchema = z.object({
  display_font: z.string(),
  body_font: z.string(),
  mono_font: z.string(),
  headline_px: z.number().positive(),
  subhead_px: z.number().positive(),
  body_px: z.number().positive(),
  footer_px: z.number().positive(),
  eyebrow_px: z.number().positive(),
});

export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  style: z.enum(['editorial', 'brutal', 'scrapbook']).default('editorial'),
  colors: ThemeColorsSchema,
  typography: ThemeTypographySchema,
  radii: z.object({ card: z.number().nonnegative(), pill: z.number().nonnegative(), tile: z.number().nonnegative() }),
  decoration: z.object({
    grid_opacity: z.number().min(0).max(1),
    grain: z.boolean(),
    border_width: z.number().nonnegative(),
    shadow: z.enum(['none', 'subtle', 'hard', 'offset']),
  }),
});

export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;
export type ThemeTypography = z.infer<typeof ThemeTypographySchema>;

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function themeDirs(): string[] {
  return [
    path.resolve(HERE, '../themes'),
    path.resolve(HERE, '../../themes'),
    path.resolve(HERE, '../../spec/themes'),
    path.resolve(HERE, '../../../spec/themes'),
    path.resolve(process.cwd(), 'spec/themes'),
    path.resolve(process.cwd(), 'themes'),
  ];
}

export function themeDir(): string {
  for (const dir of themeDirs()) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.json'))) return dir;
    } catch { /* keep looking */ }
  }
  throw new Error(`No theme JSON found. Looked in:\n${themeDirs().join('\n')}`);
}

export interface ThemeSummary {
  id: string;
  name: string;
  description: string;
  style: string;
  accent: string;
  background: string;
}

export function listThemes(): ThemeSummary[] {
  let dir: string;
  try { dir = themeDir(); } catch { return []; }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      try {
        const theme = ThemeSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
        return [{
          id: theme.id,
          name: theme.name,
          description: theme.description,
          style: theme.style,
          accent: theme.colors.accent,
          background: theme.colors.bg_primary,
        }];
      } catch {
        return [];
      }
    });
}

export function loadTheme(idOrPath: string): Theme {
  const looksLikePath = idOrPath.includes('/') || idOrPath.includes('\\') || idOrPath.endsWith('.json');
  if (looksLikePath) {
    const candidate = path.isAbsolute(idOrPath) ? idOrPath : path.resolve(process.cwd(), idOrPath);
    if (!fs.existsSync(candidate)) throw new Error(`Theme file not found: ${candidate}`);
    return ThemeSchema.parse(JSON.parse(fs.readFileSync(candidate, 'utf8')));
  }
  const dir = themeDir();
  const direct = path.join(dir, `${idOrPath}.json`);
  if (fs.existsSync(direct)) {
    return ThemeSchema.parse(JSON.parse(fs.readFileSync(direct, 'utf8')));
  }
  const available = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  throw new Error(`Unknown theme "${idOrPath}". Available: ${available.join(', ')}`);
}

/** A resolved, contrast-audited palette handed to layouts. */
export interface ResolvedPalette {
  theme: Theme;
  bg: string;
  bgAlt: string;
  surface: string;
  elevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  border: string;
  borderStrong: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  chart: string[];
  isDark: boolean;
  hairline: string;
  /** Soft translucent wash used by decorative layers. */
  wash: string;
}

export interface ThemeAudit {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
  pass: boolean;
}

export function auditThemeContrast(theme: Theme): ThemeAudit[] {
  const c = theme.colors;
  const bgs: Array<[string, string]> = [
    ['bg_primary', c.bg_primary],
    ['bg_secondary', c.bg_secondary],
    ['bg_surface', c.bg_surface],
    ['bg_elevated', c.bg_elevated],
  ];
  const audits: ThemeAudit[] = [];
  const push = (pair: string, fg: string, bg: string, required: number) => {
    const ratio = contrastRatio(fg, bg);
    audits.push({ pair, foreground: fg, background: bg, ratio, required, pass: ratio >= required });
  };
  for (const [bgName, bg] of bgs) {
    push(`text_primary on ${bgName}`, c.text_primary, bg, 4.5);
    push(`text_secondary on ${bgName}`, c.text_secondary, bg, 4.5);
    push(`accent on ${bgName}`, c.accent, bg, 3);
  }
  push('accent_text on accent', c.accent_text, c.accent, 4.5);
  push('success on bg_primary', c.success, c.bg_primary, 3);
  push('danger on bg_primary', c.danger, c.bg_primary, 3);
  return audits;
}

export function resolvePalette(theme: Theme, bgToken?: string, accentSlide?: boolean, colorOverride?: Record<string, string>): ResolvedPalette {
  const colors = { ...theme.colors, ...(colorOverride ?? {}) } as ThemeColors;
  const pick = (token: string | undefined, fallback: string) => {
    switch (token) {
      case 'primary': return colors.bg_primary;
      case 'secondary': return colors.bg_secondary;
      case 'surface': return colors.bg_surface;
      case 'elevated': return colors.bg_elevated;
      case 'accent': return colors.accent;
      default: return fallback;
    }
  };
  const baseBg = pick(bgToken, colors.bg_primary);
  const bg = accentSlide ? colors.accent : baseBg;
  const isDark = contrastRatio(colors.text_primary, colors.bg_primary) > 0 && contrastRatio('#ffffff', colors.bg_primary) > contrastRatio('#000000', colors.bg_primary);
  const onAccent = bestOn(bg, [colors.accent_text, '#ffffff', '#0b0b0b']);
  const text = accentSlide ? onAccent : ensureContrast(colors.text_primary, bg, 7);
  const textSecondary = accentSlide ? withAlpha(onAccent, 0.88) : ensureContrast(colors.text_secondary, bg, 4.5);
  const textMuted = accentSlide ? withAlpha(onAccent, 0.72) : ensureContrast(colors.text_muted, bg, 4.5);
  const accent = accentSlide ? onAccent : ensureContrast(colors.accent, bg, 3);
  return {
    theme,
    bg,
    bgAlt: pick(accentSlide ? 'surface' : 'secondary', colors.bg_secondary),
    surface: accentSlide ? withAlpha('#ffffff', 0.14) : colors.bg_surface,
    elevated: accentSlide ? withAlpha('#ffffff', 0.22) : colors.bg_elevated,
    text,
    textSecondary,
    textMuted,
    accent,
    accentSoft: accentSlide ? withAlpha('#ffffff', 0.16) : colors.accent_soft,
    accentText: accentSlide ? bg : colors.accent_text,
    border: accentSlide ? withAlpha(onAccent, 0.4) : colors.border,
    borderStrong: accentSlide ? onAccent : colors.border_strong,
    success: ensureContrast(colors.success, bg, 3),
    successSoft: colors.success_soft,
    danger: ensureContrast(colors.danger, bg, 3),
    dangerSoft: colors.danger_soft,
    chart: colors.chart_palette.map((c) => ensureContrast(c, bg, 3)),
    isDark,
    hairline: accentSlide ? withAlpha(onAccent, 0.35) : withAlpha(colors.border_strong, 0.18),
    wash: accentSlide ? withAlpha('#ffffff', 0.08) : mix(bg, colors.text_primary, 0.035),
  };
}
