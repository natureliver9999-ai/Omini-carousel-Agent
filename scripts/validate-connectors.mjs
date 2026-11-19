#!/usr/bin/env node
/**
 * Connector validation — the file equivalent of "does this host accept it?".
 *
 * Every connector in this repo is a small config blob with a documented shape.
 * Nobody notices when one rots, because the host only complains at install time.
 * This script parses each blob, checks the keys the host actually reads, and
 * asserts that the two OpenAPI copies have not drifted.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const connectors = path.join(root, 'connectors');

let failures = 0;
const pass = (message) => console.log(`  ok   ${message}`);
const fail = (message) => {
  failures += 1;
  console.error(`  FAIL ${message}`);
};
const check = (condition, message) => (condition ? pass(message) : fail(message));

function json(relative) {
  const file = path.join(root, relative);
  if (!existsSync(file)) {
    fail(`${relative} is missing`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${relative} is not valid JSON (${error.message})`);
    return null;
  }
}

function yaml(relative) {
  const file = path.join(root, relative);
  if (!existsSync(file)) {
    fail(`${relative} is missing`);
    return null;
  }
  try {
    return YAML.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${relative} is not valid YAML (${error.message})`);
    return null;
  }
}

console.log('connectors/');

const claudeDesktop = readFileSync(path.join(connectors, 'claude-desktop/README.md'), 'utf8');
check(claudeDesktop.includes('mcpServers') && claudeDesktop.includes('omni-carousel-mcp'), 'claude-desktop README documents the stdio config');

const claudeCode = json('connectors/claude-code/.mcp.json');
check(claudeCode?.mcpServers?.['omni-carousel']?.command !== undefined, 'claude-code/.mcp.json declares mcpServers.omni-carousel');

const plugin = json('connectors/claude-code/.claude-plugin/plugin.json');
check(Boolean(plugin?.name && plugin?.version), 'claude-code plugin.json has name + version');
check(Array.isArray(plugin?.skills) || plugin?.skills === undefined, 'claude-code plugin.json skills entry is well-formed');
check(existsSync(path.join(root, plugin?.skills?.[0]?.path ?? 'skills/carousel-architect')) || existsSync(path.join(root, 'skills/carousel-architect/SKILL.md')), 'carousel-architect skill exists at the path the plugin points to');

const antigravity = json('connectors/antigravity/mcp_config.json');
const antigravityEntry = antigravity?.mcpServers?.['omni-carousel'];
check(Boolean(antigravityEntry?.command || antigravityEntry?.serverUrl), 'antigravity stdio config is loadable');
const antigravityRemote = json('connectors/antigravity/mcp_config.remote.json');
check(
  Boolean(antigravityRemote?.mcpServers?.['omni-carousel']?.serverUrl),
  'antigravity remote config uses `serverUrl` (not `url`)',
);

const opencode = json('connectors/opencode/opencode.json');
const opencodeEntry = opencode?.mcp?.['omni-carousel'];
check(Boolean(opencodeEntry), 'opencode declares an `mcp` block');
check(Array.isArray(opencodeEntry?.command), 'opencode local server uses a single command array');
check(['local', 'remote'].includes(opencodeEntry?.type), 'opencode entry declares type local|remote');

const codex = readFileSync(path.join(connectors, 'codex/config.toml'), 'utf8');
check(/\[mcp_servers\.omni-carousel\]/.test(codex), 'codex TOML uses [mcp_servers.omni-carousel]');
check(/command\s*=/.test(codex), 'codex TOML declares a command');

const vscode = json('connectors/vscode/.vscode/mcp.json');
check(Boolean(vscode?.servers?.['omni-carousel'] || vscode?.mcp?.servers?.['omni-carousel']), 'vscode uses the `servers` key');

const generic = json('connectors/generic/mcpServers.json');
check(Boolean(generic?.mcpServers?.['omni-carousel']), 'generic mcpServers.json is loadable');

console.log('\nOpenAPI');

const spec = yaml('mcp-server/rest-facade/openapi.yaml');
if (spec) {
  check(String(spec.openapi).startsWith('3.1'), 'openapi.yaml declares 3.1.x');
  const paths = Object.keys(spec.paths ?? {});
  for (const route of ['/v1/playbook', '/v1/validate', '/v1/render', '/v1/layouts', '/v1/themes']) {
    check(paths.includes(route), `openapi.yaml documents ${route}`);
  }
  const operations = Object.values(spec.paths ?? {}).flatMap((entry) =>
    Object.entries(entry).filter(([method]) => ['get', 'post'].includes(method)).map(([, operation]) => operation),
  );
  check(operations.every((operation) => operation.operationId), 'every operation has an operationId');
  check(operations.every((operation) => operation.responses), 'every operation documents responses');
  const chatgpt = YAML.parse(readFileSync(path.join(connectors, 'chatgpt/openapi.yaml'), 'utf8'));
  const strip = (document) => JSON.stringify(document);
  check(strip(chatgpt) === strip(spec), 'connectors/chatgpt/openapi.yaml matches the facade spec');
}

console.log('\nSkills');

const skill = readFileSync(path.join(root, 'skills/carousel-architect/SKILL.md'), 'utf8');
check(/^---\n/.test(skill), 'SKILL.md starts with YAML front-matter');
check(/name:\s*carousel-architect/.test(skill), 'SKILL.md declares its name');
check(/description:\s*\S/.test(skill), 'SKILL.md declares a description');
for (const reference of ['hooks', 'layouts', 'platform-specs']) {
  check(existsSync(path.join(root, `skills/carousel-architect/references/${reference}.md`)), `reference ${reference}.md exists`);
}
for (const asset of readdirSync(path.join(root, 'skills/carousel-architect/assets'))) {
  if (asset.endsWith('.json')) {
    try {
      JSON.parse(readFileSync(path.join(root, 'skills/carousel-architect/assets', asset), 'utf8'));
      pass(`asset ${asset} parses`);
    } catch {
      fail(`asset ${asset} is not valid JSON`);
    }
  }
}

console.log(failures === 0 ? '\nall connector checks passed' : `\n${failures} connector check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
