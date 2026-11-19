#!/usr/bin/env node
/**
 * Exports the Zod contract to spec/carousel.schema.json (JSON Schema 2020-12),
 * which is then the input for Pydantic model generation and the OpenAPI 3.1 doc.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

const candidates = [
  path.resolve(here, '../dist/schema.js'),
  path.resolve(here, '../src/schema.ts'),
];
let mod;
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    mod = await import(candidate);
    break;
  }
}
if (!mod) {
  console.error('Build the engine first: npm run build --workspace=@omni-carousel/engine');
  process.exit(1);
}

const jsonSchema = zodToJsonSchema(mod.CarouselSpecSchema, {
  name: 'CarouselSpec',
  $refStrategy: 'none',
});

const output = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://omni-carousel.dev/spec/carousel.schema.json',
  title: 'CarouselSpec',
  description:
    'Canonical contract for omni-carousel-agent. One deck (Instagram PNG slides, a LinkedIn multi-page PDF, or a panorama canvas) described declaratively so any AI host can author it and any renderer can reproduce it pixel for pixel.',
  ...jsonSchema,
};

const targets = [
  path.join(root, 'spec/carousel.schema.json'),
  path.join(root, 'core-engine/schema.json'),
];
for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, target)}`);
}

// Keep a machine-readable layout catalog next to the schema.
const layouts = Object.entries(mod.LAYOUT_META).map(([id, meta]) => ({ id, ...meta }));
fs.writeFileSync(path.join(root, 'spec/layouts.json'), `${JSON.stringify(layouts, null, 2)}\n`);
console.log('wrote spec/layouts.json');
