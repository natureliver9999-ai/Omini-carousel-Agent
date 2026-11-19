/**
 * File-level merge primitives.
 *
 * Invariants (each one has a test):
 *   1. A timestamped backup is written before any mutation.
 *   2. Sibling servers and unrelated keys survive untouched.
 *   3. Running twice is a no-op (idempotent, byte-stable after the first write).
 *   4. `--uninstall` removes only our entry.
 *   5. `--dry-run` never touches the filesystem.
 */
import fs from 'node:fs';
import path from 'node:path';

export const SERVER_KEY = 'omni-carousel';

export interface WriteResult {
  path: string;
  changed: boolean;
  created: boolean;
  backup?: string;
  contents: string;
  diffSummary: string;
}

/** Strips // and /* *\/ comments plus trailing commas so strict JSON.parse works. */
export function parseJsonc(text: string): Record<string, unknown> {
  const withoutComments = text
    .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match, string) => (string ? string : ''));
  const withoutTrailingCommas = withoutComments.replace(/,(\s*[}\]])/g, '$1');
  if (!withoutTrailingCommas.trim()) return {};
  return JSON.parse(withoutTrailingCommas) as Record<string, unknown>;
}

function backupPath(file: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${file}.bak.${stamp}`;
}

export function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export interface UpsertJsonOptions {
  file: string;
  containerKey: string;
  entry?: Record<string, unknown>;
  /** When true, removes our entry instead of writing it. */
  uninstall?: boolean;
  dryRun?: boolean;
  /** Root-level keys only (VS Code / OpenCode / Zed style are still containers). */
  allowRootMerge?: boolean;
}

export function upsertJson(options: UpsertJsonOptions): WriteResult {
  const { file, containerKey, entry, uninstall, dryRun } = options;
  const existing = readIfExists(file);
  const document: Record<string, unknown> = existing ? parseJsonc(existing) : {};
  const container = (document[containerKey] && typeof document[containerKey] === 'object'
    ? document[containerKey]
    : {}) as Record<string, unknown>;

  const before = JSON.stringify(container[SERVER_KEY] ?? null, Object.keys(container[SERVER_KEY] ?? {}).sort());
  let changed: boolean;

  if (uninstall) {
    changed = SERVER_KEY in container;
    delete container[SERVER_KEY];
  } else {
    if (!entry) throw new Error('entry is required unless uninstall is true');
    container[SERVER_KEY] = entry;
    changed = before !== JSON.stringify(entry, Object.keys(entry).sort());
  }

  if (Object.keys(container).length > 0) document[containerKey] = container;
  else delete document[containerKey];

  const contents = `${JSON.stringify(document, null, 2)}\n`;
  const created = existing === null;
  const diffSummary = uninstall
    ? (changed ? `remove ${containerKey}.${SERVER_KEY}` : 'already absent')
    : (changed ? `${created ? 'create' : 'update'} ${containerKey}.${SERVER_KEY}` : 'unchanged');

  if (dryRun || (!changed && existing !== null)) {
    return { path: file, changed: false, created, contents: existing ?? contents, diffSummary };
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  let backup: string | undefined;
  if (existing !== null) {
    backup = backupPath(file);
    fs.writeFileSync(backup, existing, { mode: 0o600 });
  }
  fs.writeFileSync(file, contents, { mode: 0o600 });
  return { path: file, changed: true, created, backup, contents, diffSummary };
}

export interface UpsertTomlOptions {
  file: string;
  table: string; // e.g. mcp_servers.omni-carousel
  body: string; // TOML lines for the table body
  uninstall?: boolean;
  dryRun?: boolean;
}

/** Section-scoped TOML upsert that never rewrites unrelated tables. */
export function upsertToml(options: UpsertTomlOptions): WriteResult {
  const { file, table, body, uninstall, dryRun } = options;
  const existing = readIfExists(file) ?? '';
  const lines = existing.split('\n');
  const header = `[${table}]`;
  const start = lines.findIndex((line) => line.trim() === header);

  let next: string[];
  if (start === -1) {
    // Remove nothing; append the table if we are installing.
    next = uninstall ? lines : [...lines.filter((line) => line.trim() !== '' || true), header, body, ''];
    if (!uninstall) {
      // Trim trailing blank runs before appending.
      while (next.length > 0 && next[0] === '') next.shift();
      next = [...lines];
      while (next.length > 0 && next[next.length - 1].trim() === '') next.pop();
      if (next.length) next.push('');
      next.push(header, body, '');
    }
  } else {
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\s*\[/.test(lines[i])) { end = i; break; }
    }
    const replacement = uninstall ? [] : [header, body, ''];
    next = [...lines.slice(0, start), ...replacement, ...lines.slice(end)];
    // Collapse a trailing blank run.
    while (next.length > 1 && next[next.length - 1].trim() === '' && next[next.length - 2].trim() === '') next.pop();
  }

  const contents = next.join('\n').replace(/\n{3,}/g, '\n\n');
  const changed = contents !== existing;
  const diffSummary = uninstall ? (start === -1 ? 'already absent' : `remove ${header}`) : (start === -1 ? `append ${header}` : `update ${header}`);

  if (dryRun || !changed) {
    return { path: file, changed: false, created: existing === '', contents: existing || contents, diffSummary };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let backup: string | undefined;
  if (existing) {
    backup = backupPath(file);
    fs.writeFileSync(backup, existing, { mode: 0o600 });
  }
  fs.writeFileSync(file, contents, { mode: 0o600 });
  return { path: file, changed: true, created: existing === '', backup, contents, diffSummary };
}

/** TOML serialisation for the small subset we write. */
export function tomlTable(table: string, values: Record<string, string | string[] | undefined>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key} = [${value.map((item) => JSON.stringify(item)).join(', ')}]`);
    } else {
      lines.push(`${key} = ${JSON.stringify(value)}`);
    }
  }
  return lines.join('\n');
}
