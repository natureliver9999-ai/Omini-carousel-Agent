#!/usr/bin/env node
/**
 * Top-level smoke test: the CLI surface a user actually touches.
 *
 * Unit tests prove the layout functions; this proves the commands wire up, the
 * exit codes are honest, and every documented subcommand still answers. Runs in
 * CI on every push and takes a few seconds.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'core-engine/dist/cli.js');
const spec = path.join(root, 'examples/specs/ig-contrast-myths.json');

if (!existsSync(cli)) {
  console.error('engine not built: run `npm run build`');
  process.exit(1);
}

let failures = 0;
const ok = (message) => console.log(`  ok   ${message}`);
const bad = (message) => {
  failures += 1;
  console.error(`  FAIL ${message}`);
};

function run(args, options = {}) {
  return execFileSync('node', [cli, ...args], { encoding: 'utf8', cwd: root, ...options });
}

function expectExit(args, code, label) {
  try {
    run(args, { stdio: 'pipe' });
    if (code === 0) ok(`${label} (exit 0)`);
    else bad(`${label}: expected exit ${code}, got 0`);
  } catch (error) {
    const actual = error.status;
    if (actual === code) ok(`${label} (exit ${code})`);
    else bad(`${label}: expected exit ${code}, got ${actual}: ${(error.stderr ?? '').toString().split('\n')[0]}`);
  }
}

console.log('cli');

expectExit(['help'], 0, 'help prints usage');
expectExit(['validate', spec, '--strict'], 0, 'validate --strict on a shipped deck');
expectExit(['validate', spec], 0, 'validate without strict');
expectExit(['layouts', '--json'], 0, 'layouts --json');

const layouts = JSON.parse(run(['layouts', '--json']));
if (Array.isArray(layouts) && layouts.length === 11) ok('11 layouts are listed');
else bad(`expected 11 layouts, got ${Array.isArray(layouts) ? layouts.length : typeof layouts}`);

const themes = JSON.parse(run(['themes', '--json']));
if (Array.isArray(themes) && themes.length >= 4) ok(`${themes.length} themes are listed`);
else bad('themes list is short');

const playbook = run(['playbook', 'instagram']);
if (playbook.length > 400 && /instagram/i.test(playbook)) ok('playbook prints markdown');
else bad('playbook output looks empty');

const schema = JSON.parse(run(['schema']));
if (schema.definitions?.CarouselSpec) ok('schema command emits the JSON Schema');
else bad('schema command did not emit the contract');

const doctor = JSON.parse(run(['doctor', '--json']));
if (doctor && typeof doctor === 'object') ok(`doctor reports ${Object.keys(doctor).length} sections`);
else bad('doctor did not return JSON');

// Render + preview into a temp dir.
const out = mkdtempSync(path.join(tmpdir(), 'omni-smoke-'));
const render = JSON.parse(run(['render', spec, '--out', out, '--formats', 'png,pdf,html,json,caption', '--json']));
if (render.ok && render.renderer === 'resvg') ok(`render produced ${render.slides.length} slides via ${render.renderer}`);
else bad('render did not report success');

for (const [kind, file] of Object.entries(render.files ?? {})) {
  if (!file) continue;
  if (existsSync(file)) ok(`${kind} artefact written`);
  else bad(`${kind} artefact missing at ${file}`);
}

const pdf = Object.entries(render.files ?? {}).find(([kind]) => kind === 'pdf')?.[1];
if (pdf && readFileSync(pdf).subarray(0, 5).toString() === '%PDF-') ok('PDF has a valid header');
else bad('PDF is missing or malformed');

const png = path.join(out, 'slides', 'slide-01.png');
if (existsSync(png)) {
  const buffer = readFileSync(png);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 1080 && height === 1350) ok('slide is 1080x1350');
  else bad(`slide is ${width}x${height}`);
} else bad('no slide PNGs were written');

const preview = path.join(out, 'preview.png');
run(['preview', spec, '--slide', '1', '--out', preview]);
if (existsSync(preview) && readFileSync(preview).length > 20_000) ok('preview renders a single slide');
else bad('preview did not write a PNG');

// Invalid deck must fail loudly.
expectExit(['validate', path.join(root, 'package.json')], 1, 'validate rejects a non-spec file');
expectExit(['render'], 2, 'render without a spec is a usage error');

console.log('\ngallery');
const gallery = mkdtempSync(path.join(tmpdir(), 'omni-gallery-smoke-'));
const galleryResult = JSON.parse(run(['gallery', '--rendered', path.join(root, 'examples/rendered'), '--out', path.join(gallery, 'index.html'), '--json']));
if (galleryResult.ok && galleryResult.decks.length >= 8) ok(`gallery indexes ${galleryResult.decks.length} decks`);
else bad('gallery did not index the shipped decks');
if (existsSync(path.join(gallery, 'index.html'))) ok('gallery page written');
else bad('gallery page missing');

console.log(failures === 0 ? '\ntop-level smoke test passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
