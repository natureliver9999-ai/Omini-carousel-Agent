#!/usr/bin/env node
/** Copies spec/themes + spec/playbook next to the compiled package so an installed
 *  engine still knows its themes without needing the monorepo. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

for (const [from, to] of [
  [path.join(root, 'spec/themes'), path.join(root, 'core-engine/themes')],
  [path.join(root, 'spec/playbook'), path.join(root, 'core-engine/playbook')],
  [path.join(root, 'spec/carousel.schema.json'), path.join(root, 'core-engine/schema.json')],
]) {
  try {
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true, force: true });
    console.log(`synced ${path.relative(root, from)} -> ${path.relative(root, to)}`);
  } catch (error) {
    console.warn(`sync skipped for ${from}: ${error.message}`);
  }
}
