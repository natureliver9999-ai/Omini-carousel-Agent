#!/usr/bin/env node
/**
 * Connector installer smoke test.
 *
 * For every host the installer supports: install into a throwaway HOME, assert the
 * config was written with a sibling key preserved, install again and assert nothing
 * changed (idempotency), then uninstall and assert only our entry was removed.
 * Runs in CI on every PR — a broken installer is worse than no installer.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'connectors/setup/dist/index.js');

if (!existsSync(cli)) {
  console.error(`installer not built: ${cli}\nrun: npm run build --workspace=omni-carousel-setup`);
  process.exit(1);
}

// Paths are resolved by the installer itself (they are platform-dependent, e.g.
// Claude Desktop uses ~/Library/Application Support on macOS), so each case runs a
// dry run first and reads the target path back out of the report.
const HOSTS = [
  { client: 'claude-desktop', scope: 'user', expectBackup: false },
  { client: 'claude-code', scope: 'user', expectBackup: false },
  { client: 'claude-code', scope: 'project' },
  { client: 'cursor', scope: 'user' },
  { client: 'cursor', scope: 'project' },
  { client: 'windsurf', scope: 'user' },
  { client: 'vscode', scope: 'project' },
  { client: 'codex', scope: 'user' },
  { client: 'opencode', scope: 'project' },
  { client: 'opencode', scope: 'user' },
  { client: 'antigravity', scope: 'user' },
  { client: 'antigravity', scope: 'project' },
  { client: 'zed', scope: 'user' },
];

function resolveTarget(client, scope, cwd, env) {
  const output = run(['--client', client, '--scope', scope, '--dry-run'], { cwd, env });
  const match = output.match(/^\s{2}(\/\S+)$/m) ?? output.match(/^\s{2}([A-Za-z]:\\\S+)$/m);
  if (!match) throw new Error(`could not parse target path from dry run:\n${output}`);
  return match[1];
}

let failures = 0;
const ok = (message) => console.log(`  ok   ${message}`);
const bad = (message) => {
  failures += 1;
  console.error(`  FAIL ${message}`);
};

function run(args, options) {
  return execFileSync('node', [cli, ...args], { encoding: 'utf8', ...options });
}

for (const host of HOSTS) {
  const home = mkdtempSync(path.join(tmpdir(), `omni-home-${host.client}-`));
  const project = mkdtempSync(path.join(tmpdir(), `omni-proj-${host.client}-`));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const label = `${host.client} (${host.scope})`;
  let target;
  try {
    target = resolveTarget(host.client, host.scope, project, env);
  } catch (error) {
    bad(`${label}: ${error.message.split('\n')[0]}`);
    continue;
  }

  // Seed a sibling entry, so the merge path is exercised rather than the create path.
  mkdirSync(path.dirname(target), { recursive: true });
  if (target.endsWith('.toml')) {
    writeFileSync(target, '[mcp_servers.other]\ncommand = "other-server"\n');
  } else {
    writeFileSync(target, JSON.stringify({ mcpServers: { other: { command: 'other-server' } } }, null, 2));
  }

  try {
    run(['--client', host.client, '--scope', host.scope, '--mode', 'stdio'], { cwd: project, env });
  } catch (error) {
    bad(`${label}: install failed (${error.stderr?.trim() || error.message})`);
    continue;
  }

  if (!existsSync(target)) {
    bad(`${label}: expected config at ${target}`);
    continue;
  }

  const first = readFileSync(target, 'utf8');
  const mentionsUs = first.includes('omni-carousel');
  const keepsSibling = first.includes('other');
  if (!mentionsUs) bad(`${label}: install did not add the omni-carousel entry`);
  if (!keepsSibling) bad(`${label}: install dropped the pre-existing sibling server`);
  if (mentionsUs && keepsSibling) ok(`${label}: installs, preserves siblings`);

  // readdir, not `ls`: some hosts keep dotfiles (e.g. `.claude.json.bak.<iso>`).
  const backups = existsSync(path.dirname(target))
    ? readdirSync(path.dirname(target)).filter((name) => name.includes('.bak.'))
    : [];
  if (backups.length > 0) ok(`${label}: wrote a timestamped backup`);
  else if (host.expectBackup === false) ok(`${label}: installs without a backup (documented: ~/.claude.json is append-only)`);
  else bad(`${label}: no .bak.<timestamp> backup was written`);

  run(['--client', host.client, '--scope', host.scope, '--mode', 'stdio'], { cwd: project, env });
  const second = readFileSync(target, 'utf8');
  if (second === first) ok(`${label}: idempotent`);
  else bad(`${label}: a second install changed the file`);

  run(['--client', host.client, '--scope', host.scope, '--uninstall'], { cwd: project, env });
  const after = readFileSync(target, 'utf8');
  if (after.includes('omni-carousel')) bad(`${label}: uninstall left our entry behind`);
  else if (!after.includes('other')) bad(`${label}: uninstall removed the sibling server`);
  else ok(`${label}: uninstall removes only our entry`);
}

// Remote mode must emit each host's own key dialect.
const home = mkdtempSync(path.join(tmpdir(), 'omni-home-remote-'));
const env = { ...process.env, HOME: home, USERPROFILE: home };
for (const client of ['antigravity', 'opencode', 'vscode', 'zed', 'cursor']) {
  try {
    const output = run(['--client', client, '--scope', 'user', '--mode', 'http', '--url', 'https://example.com/mcp', '--print'], { env });
    const expects = { antigravity: 'serverUrl', opencode: 'mcp', vscode: 'servers', zed: 'context_servers', cursor: 'url' };
    if (output.includes(expects[client])) ok(`remote config for ${client} uses \`${expects[client]}\``);
    else bad(`remote config for ${client} is missing \`${expects[client]}\``);
  } catch (error) {
    bad(`remote config for ${client} failed (${error.stderr?.trim() || error.message})`);
  }
}

console.log(failures === 0 ? '\ninstaller smoke test passed' : `\n${failures} installer check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
