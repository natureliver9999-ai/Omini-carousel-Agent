#!/usr/bin/env node
/**
 * `omni-carousel` — the deterministic executor every host shares.
 *
 * The MCP servers, the REST facade and the SDKs all shell out to (or import) this
 * same surface, so there is exactly one implementation of "what a carousel is".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CarouselSpecSchema, LAYOUT_META, parseSpec, validateSpec } from './schema.js';
import { formatLintReport, lintSpec } from './lint.js';
import { listThemes, loadTheme, themeDir, auditThemeContrast } from './themes.js';
import { renderCarousel, renderSlidePreview, defaultOutputRoot, sanitizeSlug } from './render.js';
import { renderExamples, examplesDir } from './examples.js';
import { defaultRenderedRoot, writeGallery } from './gallery.js';
import { buildFullPlaybook, buildPlaybook, PLAYBOOK_TOPICS, type PlaybookTopic } from './playbook.js';
import { renderChartPng, parseChart } from './assets/quickchart.js';
import { renderDiagramSvg } from './assets/mermaid.js';
import { playwrightAvailability, closePlaywright } from './playwright.js';
import { ICON_NAMES } from './icons.js';
import { resolveFontDir, fontRegistry } from './fontmetrics.js';

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const [rawKey, inline] = token.slice(2).split('=');
      const key = rawKey.trim();
      if (inline !== undefined) {
        flags[key] = inline;
      } else if (rest[i + 1] && !rest[i + 1].startsWith('--')) {
        flags[key] = rest[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(token);
    }
  }
  return { command, positional, flags };
}

const USAGE = `omni-carousel — agent-agnostic carousel engine

Usage
  omni-carousel render <spec.json | -> [options]
  omni-carousel validate <spec.json | -> [--strict] [--json]
  omni-carousel preview <spec.json> --slide <n> [--out file.png] [--theme id]
  omni-carousel layouts [--json]
  omni-carousel themes [--json]
  omni-carousel playbook [instagram|linkedin|hooks|patterns|layouts|all] [--json]
  omni-carousel schema
  omni-carousel chart <chart.json> [--out file.png] [--theme id]
  omni-carousel diagram <file.mmd> [--out file.svg] [--theme id]
  omni-carousel examples [--out dir] [--only id,id]
  omni-carousel gallery [--rendered dir] [--out index.html]
  omni-carousel doctor [--json]

Gallery
  --rendered <dir>        tree of rendered decks (default: examples/rendered)
  --out <file>            output page (default: <rendered>/index.html)

Render options
  --theme <id>            editorial | brutal-bento | scrapbook | linkedin-executive | <path.json>
  --out <dir>             exact output directory (default: $OMNI_OUTPUT_DIR/<slug>-<timestamp>)
  --renderer <kind>       auto | resvg | playwright
  --formats <list>        comma separated: png,pdf,zip,html,json,caption
  --strict                fail instead of rendering when lint reports errors
  --json                  machine-readable result on stdout
  --quiet                 suppress warnings on stderr

Exit codes: 0 ok · 1 invalid spec or failing lint (with --strict) · 2 usage error · 3 render error
`;

function readSpecSource(source: string): unknown {
  const raw = source === '-'
    ? fs.readFileSync(0, 'utf8')
    : fs.readFileSync(path.resolve(source), 'utf8');
  if (!raw.trim()) throw new Error('Empty spec input');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Spec is not valid JSON: ${(error as Error).message}`);
  }
}

function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<number> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'render': {
      if (!positional[0]) { console.error('render requires a spec path (or - for stdin)'); return 2; }
      const spec = readSpecSource(positional[0]);
      const formats = typeof flags.formats === 'string'
        ? flags.formats.split(',').map((f) => f.trim()).filter(Boolean) as Array<'png' | 'pdf' | 'zip' | 'html' | 'json' | 'caption'>
        : undefined;
      const result = await renderCarousel(spec, {
        theme: typeof flags.theme === 'string' ? flags.theme : undefined,
        outDir: typeof flags.out === 'string' ? flags.out : undefined,
        renderer: (typeof flags.renderer === 'string' ? flags.renderer : 'auto') as 'auto' | 'resvg' | 'playwright',
        strict: flags.strict === true,
        formats,
        quiet: flags.quiet === true || flags.json === true,
      });
      if (flags.json === true) {
        json({
          ok: result.lint.ok,
          dir: result.dir,
          renderer: result.renderer,
          duration_ms: result.durationMs,
          slides: result.slides,
          files: result.files,
          warnings: result.warnings,
          lint: { ok: result.lint.ok, errors: result.lint.errors, warnings: result.lint.warnings, metrics: result.lint.metrics },
        });
      } else {
        console.log(`Rendered ${result.slides.length} slides in ${result.durationMs}ms via ${result.renderer}`);
        console.log(`  output   ${result.dir}`);
        for (const [kind, file] of Object.entries(result.files)) {
          if (file) console.log(`  ${kind.padEnd(8)} ${file}`);
        }
        if (result.warnings.length) console.log(`  warnings ${result.warnings.length} (see /manifest.json)`);
      }
      return result.lint.ok ? 0 : 1;
    }

    case 'validate': {
      if (!positional[0]) { console.error('validate requires a spec path (or - for stdin)'); return 2; }
      const spec = readSpecSource(positional[0]);
      const schema = validateSpec(spec);
      const report = schema.ok ? lintSpec(spec) : lintSpec(spec);
      if (flags.json === true) {
        json({ schema: { ok: schema.ok, issues: schema.issues }, lint: report });
      } else {
        console.log(formatLintReport(report));
      }
      if (!schema.ok) return 1;
      if (flags.strict === true && !report.ok) return 1;
      return 0;
    }

    case 'preview': {
      if (!positional[0]) { console.error('preview requires a spec path'); return 2; }
      const index = Number(flags.slide ?? 0);
      const parsed = parseSpec(readSpecSource(positional[0]));
      const preview = await renderSlidePreview(parsed, index, { theme: typeof flags.theme === 'string' ? flags.theme : undefined });
      const out = typeof flags.out === 'string'
        ? path.resolve(flags.out)
        : path.resolve(defaultOutputRoot(), `${sanitizeSlug(parsed.id ?? 'carousel')}-slide-${index + 1}.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, preview.png!);
      if (flags.json === true) json({ ok: true, out, slide: index, layout: preview.slide.layout });
      else console.log(`wrote ${out} (${preview.slide.layout})`);
      return 0;
    }

    case 'layouts': {
      const entries = Object.entries(LAYOUT_META).map(([id, meta]) => ({ id, ...meta }));
      if (flags.json === true) json(entries);
      else {
        for (const entry of entries) {
          console.log(`${entry.id.padEnd(16)} ${entry.density.padEnd(7)} ${entry.role}`);
        }
        console.log(`\nIcons: ${ICON_NAMES.join(', ')}`);
      }
      return 0;
    }

    case 'themes': {
      const themes = listThemes();
      if (flags.json === true) json(themes);
      else {
        for (const theme of themes) console.log(`${theme.id.padEnd(20)} ${theme.style.padEnd(10)} ${theme.name}`);
        console.log(`\nTheme directory: ${themeDir()}`);
      }
      return 0;
    }

    case 'playbook': {
      const topic = (positional[0] ?? 'index') as PlaybookTopic | 'all';
      const text = topic === 'all'
        ? buildFullPlaybook()
        : buildPlaybook((PLAYBOOK_TOPICS as readonly string[]).includes(topic) ? (topic as PlaybookTopic) : 'index');
      if (flags.json === true) json({ topic, markdown: text });
      else process.stdout.write(`${text}\n`);
      return 0;
    }

    case 'schema': {
      const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../spec/carousel.schema.json');
      if (fs.existsSync(schemaPath)) {
        process.stdout.write(fs.readFileSync(schemaPath, 'utf8'));
      } else {
        json({ note: 'Run `npm run export:schema` to materialise spec/carousel.schema.json', source: 'core-engine/src/schema.ts' });
      }
      void CarouselSpecSchema;
      return 0;
    }

    case 'chart': {
      if (!positional[0]) { console.error('chart requires a chart JSON file'); return 2; }
      const chart = parseChart(JSON.parse(fs.readFileSync(path.resolve(positional[0]), 'utf8')));
      const png = renderChartPng(chart, { theme: typeof flags.theme === 'string' ? flags.theme : undefined });
      const out = typeof flags.out === 'string' ? path.resolve(flags.out) : path.resolve(defaultOutputRoot(), 'chart.png');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, png);
      console.log(`wrote ${out}`);
      return 0;
    }

    case 'diagram': {
      if (!positional[0]) { console.error('diagram requires a .mmd file'); return 2; }
      const source = fs.readFileSync(path.resolve(positional[0]), 'utf8');
      const svg = renderDiagramSvg(source, { theme: typeof flags.theme === 'string' ? flags.theme : undefined });
      const out = typeof flags.out === 'string' ? path.resolve(flags.out) : path.resolve(defaultOutputRoot(), 'diagram.svg');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, svg);
      console.log(`wrote ${out}`);
      return 0;
    }

    case 'gallery': {
      const renderedRoot = typeof flags.rendered === 'string' ? path.resolve(flags.rendered) : defaultRenderedRoot();
      const outFile = typeof flags.out === 'string' ? path.resolve(flags.out) : path.join(renderedRoot, 'index.html');
      const { decks } = writeGallery({ renderedRoot, outFile });
      if (flags.json === true) json({ ok: true, outFile, decks: decks.map((deck) => deck.id) });
      else console.log(`Gallery: ${decks.length} decks, ${decks.reduce((sum, deck) => sum + deck.slides.length, 0)} slides -> ${outFile}`);
      return 0;
    }

    case 'examples': {
      const outRoot = typeof flags.out === 'string' ? path.resolve(flags.out) : path.resolve('examples/rendered');
      console.log(`Rendering examples from ${examplesDir()} -> ${outRoot}`);
      const wanted = typeof flags.only === 'string' ? new Set(flags.only.split(',').map((s) => s.trim())) : null;
      const results = await renderExamples(outRoot);
      for (const { id, result } of results) {
        if (wanted && !wanted.has(id)) continue;
        console.log(`  ${id.padEnd(34)} ${result.slides.length} slides, ${result.durationMs}ms, ${result.warnings.length} warnings -> ${result.dir}`);
      }
      return 0;
    }

    case 'doctor': {
      const availability = await playwrightAvailability();
      const fonts = fontRegistry();
      const themes = listThemes().map((theme) => {
        const audit = auditThemeContrast(loadTheme(theme.id));
        return { ...theme, contrast: audit.every((a) => a.pass || a.required < 4.5) ? 'pass' : 'warn' };
      });
      const report = {
        version: '0.1.0',
        node: process.version,
        fonts: { dir: resolveFontDir(), families: [...new Set(fonts.map((f) => f.family))] },
        themes,
        renderers: { resvg: true, playwright: availability.available, playwright_reason: availability.reason },
        output_root: defaultOutputRoot(),
        env: {
          OMNI_OUTPUT_DIR: process.env.OMNI_OUTPUT_DIR ?? null,
          OMNI_RENDERER: process.env.OMNI_RENDERER ?? null,
          UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY ? 'set' : 'unset',
          PEXELS_API_KEY: process.env.PEXELS_API_KEY ? 'set' : 'unset',
        },
        icons: ICON_NAMES.length,
      };
      if (flags.json === true) json(report);
      else {
        console.log(`omni-carousel ${report.version} on node ${report.node}`);
        console.log(`fonts      ${report.fonts.dir} (${report.fonts.families.join(', ')})`);
        console.log(`themes     ${themes.map((t) => `${t.id}${t.contrast === 'warn' ? ' (!)' : ''}`).join(', ')}`);
        console.log(`renderers  resvg=yes playwright=${availability.available ? 'yes' : `no (${availability.reason})`}`);
        console.log(`output     ${report.output_root}`);
      }
      await closePlaywright();
      return 0;
    }

    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(USAGE);
      return 0;

    case '--version':
    case 'version':
      console.log('0.1.0');
      return 0;

    default:
      console.error(`Unknown command "${command}"\n`);
      process.stderr.write(USAGE);
      return 2;
  }
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    console.error(`error: ${(error as Error).message}`);
    if (process.env.OMNI_DEBUG) console.error(error);
    process.exitCode = 3;
  });
