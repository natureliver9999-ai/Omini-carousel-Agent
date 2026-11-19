/**
 * Example rendering: the repo ships printed proof, not promises.
 * `omni-carousel examples` re-renders every starter spec in `examples/specs`.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSpec } from './schema.js';
import { renderCarousel, type RenderResult } from './render.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const EXAMPLE_IDS = [
  'ig-panorama-retention',
  'ig-contrast-myths',
  'ig-layer-stack-architecture',
  'ig-reveal-hold-diagnostic',
  'ig-bento-agent-stack',
  'ig-scrapbook-founder-note',
  'li-executive-ai-adoption',
] as const;

export type ExampleId = (typeof EXAMPLE_IDS)[number];

function specDirs(): string[] {
  return [
    path.resolve(HERE, '../examples/specs'),
    path.resolve(HERE, '../../examples/specs'),
    path.resolve(HERE, '../../../examples/specs'),
    path.resolve(process.cwd(), 'examples/specs'),
  ];
}

export function examplesDir(): string {
  for (const dir of specDirs()) {
    try {
      if (fsSync.existsSync(dir)) return dir;
    } catch {
      /* keep looking */
    }
  }
  throw new Error(`No examples/specs directory found. Looked in:\n${specDirs().join('\n')}`);
}

export async function renderExamples(outRoot: string): Promise<Array<{ id: string; result: RenderResult }>> {
  const dir = examplesDir();
  const results: Array<{ id: string; result: RenderResult }> = [];
  for (const file of (await fs.readdir(dir)).sort()) {
    if (!file.endsWith('.json')) continue;
    const raw = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    const spec = parseSpec(raw);
    const id = spec.id ?? file.replace(/\.json$/, '');
    const result = await renderCarousel(spec, {
      outDir: path.join(outRoot, id),
      formats: ['png', 'pdf', 'zip', 'html', 'json', 'caption'],
      quiet: true,
    });
    results.push({ id, result });
  }
  return results;
}
