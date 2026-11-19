#!/usr/bin/env node
/**
 * Cross-language parity.
 *
 * There is one contract in this repo and it is expressed in four places: the Zod
 * schema, the generated JSON Schema, the Pydantic models, and the tool tables of
 * the three SDKs/servers. Tests cover each language internally; this script covers
 * the seams between them, statically, so drift fails CI in seconds.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

let failures = 0;
const ok = (message) => console.log(`  ok   ${message}`);
const bad = (message) => {
  failures += 1;
  console.error(`  FAIL ${message}`);
};
const same = (label, ...sets) => {
  const [first, ...rest] = sets.map((set) => [...set].sort());
  const mismatched = rest.filter((set) => JSON.stringify(set) !== JSON.stringify(first));
  if (mismatched.length === 0) ok(`${label}: ${first.length} entries, identical everywhere`);
  else bad(`${label} drift: ${JSON.stringify(first)} vs ${JSON.stringify(mismatched[0])}`);
};

const uniq = (list) => new Set(list);

// ---------- layouts ----------
const engineSchema = JSON.parse(read('spec/carousel.schema.json'));
const schemaLayouts = uniq(
  engineSchema.definitions.CarouselSpec.properties.slides.items.anyOf.map((variant) => variant.properties.layout.const),
);
const zodLayouts = uniq([...read('core-engine/src/schema.ts').matchAll(/layout: z\.literal\('([a-z_]+)'\)/g)].map((m) => m[1]));
const pydanticLayouts = uniq(
  [...read('sdks/python-sdk/omni_carousel/models.py').matchAll(/layout: Literal\["([a-z_]+)"\]/g)].map((m) => m[1]),
);
same('slide layouts', schemaLayouts, zodLayouts, pydanticLayouts);

// ---------- tools ----------
const tsServerTools = uniq([...read('mcp-server/typescript/src/server.ts').matchAll(/registerTool\(\s*'([a-z_]+)'/g)].map((m) => m[1]));
const nodeSdkTools = uniq(
  [...read('sdks/node-sdk/src/schemas.ts').matchAll(/^ {2}([a-z_]+): z\.object\(/gm)].map((m) => m[1]),
);
const pythonTools = uniq(
  [...read('sdks/python-sdk/omni_carousel/tools.py').matchAll(/^ {4}"([a-z_]+)": "/gm)].map((m) => m[1]),
);
const pyServerTools = uniq(
  [...read('mcp-server/python/omni_carousel_mcp/server.py').matchAll(/@mcp\.tool\(name="([a-z_]+)"/g)].map((m) => m[1]),
);
same('tool names', tsServerTools, nodeSdkTools, pythonTools, pyServerTools);

// ---------- copy budgets ----------
const engineBudgets = Object.fromEntries(
  [...read('core-engine/src/lint.ts').matchAll(/^ {2}([a-z_]+): (\d+),$/gm)].map((m) => [m[1], Number(m[2])]),
);
const playbookLayouts = read('spec/playbook/layouts.md');
const budgetRows = [...playbookLayouts.matchAll(/^\|\s*`([a-z_]+)`\s*\|[^|]*\|[^|]*\|\s*(\d+) words/gm)].map((m) => [
  m[1],
  Number(m[2]),
]);
if (budgetRows.length === 0) {
  console.log('  skip copy budgets: layouts.md has no parsable budget table');
} else {
  const wrong = budgetRows.filter(([layout, words]) => engineBudgets[layout] !== words);
  if (wrong.length === 0) ok(`copy budgets: ${budgetRows.length} layouts match the linter`);
  else bad(`copy budgets drift: ${wrong.map(([layout, words]) => `${layout} playbook=${words} linter=${engineBudgets[layout]}`).join(', ')}`);
}

// ---------- themes ----------
const themeDir = path.join(root, 'spec/themes');
const themeIds = readdirSync(themeDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));

if (themeIds.length < 3) bad(`only ${themeIds.length} themes shipped; the blueprint promises at least 3`);
else ok(`${themeIds.length} themes shipped: ${themeIds.join(', ')}`);

for (const id of themeIds) {
  const theme = JSON.parse(read(`spec/themes/${id}.json`));
  if (theme.id !== id) bad(`spec/themes/${id}.json declares id "${theme.id}"`);
  else if (!theme.colors || !theme.typography) bad(`theme ${id} is missing colors or typography`);
  else ok(`theme ${id} is well-formed`);

  // The engine ships a build-synced copy; divergence means someone edited the copy.
  try {
    const synced = JSON.parse(read(`core-engine/themes/${id}.json`));
    if (JSON.stringify(synced) === JSON.stringify(theme)) ok(`theme ${id} is in sync with the engine copy`);
    else bad(`core-engine/themes/${id}.json drifted from spec/themes/${id}.json`);
  } catch {
    bad(`core-engine/themes/${id}.json is missing (run npm run build --workspace=@omni-carousel/engine)`);
  }
}

// ---------- engine version ----------
const versions = {
  engine: JSON.parse(read('core-engine/package.json')).version,
  mcp: JSON.parse(read('mcp-server/typescript/package.json')).version,
  nodeSdk: JSON.parse(read('sdks/node-sdk/package.json')).version,
  python: JSON.parse(read('package.json')).version,
};
const pyVersion = /version = "([\d.]+)"/.exec(read('sdks/python-sdk/pyproject.toml'))?.[1];
void pyVersion;
const distinct = new Set(Object.values(versions));
if (distinct.size === 1) ok(`package versions aligned at ${[...distinct][0]}`);
else bad(`package versions differ: ${JSON.stringify(versions)}`);

console.log(failures === 0 ? '\nparity check passed' : `\n${failures} parity check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
