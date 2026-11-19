/**
 * One descriptor per host. Every field here was verified against the host's
 * 2026 documentation (see docs/research/03-agent-ecosystem-and-mcp-compatibility-2026.md).
 *
 * The quirks are the point: Antigravity and Windsurf only accept `serverUrl` for
 * remote MCP, VS Code nests under `servers`, OpenCode uses `mcp` with a single
 * `command` array, and Codex is TOML.
 */
import os from 'node:os';
import path from 'node:path';

export type ClientId =
  | 'claude-desktop'
  | 'claude-code'
  | 'cursor'
  | 'windsurf'
  | 'vscode'
  | 'codex'
  | 'opencode'
  | 'antigravity'
  | 'zed'
  | 'librechat'
  | 'chatgpt'
  | 'generic';

export type Scope = 'user' | 'project';
export type Mode = 'stdio' | 'http';

export interface InstallOptions {
  mode: Mode;
  /** Remote endpoint, e.g. https://host/mcp */
  url: string;
  token?: string;
  /** Absolute path where rendered decks are written. */
  outputDir?: string;
  /** Optional Unsplash key to forward into the server env. */
  unsplashKey?: string;
  /** Pexels key, same. */
  pexelsKey?: string;
  /** Npx package name / binary. */
  command?: string;
}

export interface ClientSpec {
  id: ClientId;
  label: string;
  format: 'json' | 'toml' | 'instructions';
  /** Container key inside the JSON document. */
  container?: string;
  /** JSON path per scope; omitted scope = unsupported. */
  paths: Partial<Record<Scope, string>>;
  /** Some hosts only accept `serverUrl` for remote entries. */
  remoteKey?: 'url' | 'serverUrl';
  /** VS Code needs `type` on each entry; OpenCode needs `type: local|remote`. */
  dialect?: 'standard' | 'vscode' | 'opencode' | 'zed';
  notes?: string[];
}

const home = () => os.homedir();
const appData = () => process.env.APPDATA ?? path.join(home(), 'AppData', 'Roaming');

export const CLIENTS: ClientSpec[] = [
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    format: 'json',
    container: 'mcpServers',
    paths: {
      user: process.platform === 'darwin'
        ? path.join(home(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
        : process.platform === 'win32'
          ? path.join(appData(), 'Claude', 'claude_desktop_config.json')
          : path.join(home(), '.config', 'Claude', 'claude_desktop_config.json'),
    },
    notes: [
      'GUI-launched apps do not inherit your shell PATH: if npx fails, use the absolute path from `which npx`.',
      'Remote connectors are added in Settings → Connectors, not in this file.',
    ],
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    format: 'json',
    container: 'mcpServers',
    paths: {
      user: path.join(home(), '.claude.json'),
      project: path.join(process.cwd(), '.mcp.json'),
    },
    notes: ['Precedence: local > project > user; the winning entry replaces the whole object.'],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    format: 'json',
    container: 'mcpServers',
    paths: {
      user: path.join(home(), '.cursor', 'mcp.json'),
      project: path.join(process.cwd(), '.cursor', 'mcp.json'),
    },
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    format: 'json',
    container: 'mcpServers',
    remoteKey: 'serverUrl',
    paths: { user: path.join(home(), '.codeium', 'windsurf', 'mcp_config.json') },
    notes: ['Windsurf accepts `serverUrl` (not `url`) for remote servers.'],
  },
  {
    id: 'vscode',
    label: 'VS Code (GitHub Copilot)',
    format: 'json',
    container: 'servers',
    dialect: 'vscode',
    paths: {
      user: process.platform === 'darwin'
        ? path.join(home(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json')
        : process.platform === 'win32'
          ? path.join(appData(), 'Code', 'User', 'mcp.json')
          : path.join(home(), '.config', 'Code', 'User', 'mcp.json'),
      project: path.join(process.cwd(), '.vscode', 'mcp.json'),
    },
    notes: ['Top-level key is `servers`, not `mcpServers`.'],
  },
  {
    id: 'codex',
    label: 'OpenAI Codex CLI',
    format: 'toml',
    paths: {
      user: path.join(home(), '.codex', 'config.toml'),
      project: path.join(process.cwd(), '.codex', 'config.toml'),
    },
    notes: ['Uses `[mcp_servers.omni-carousel]`; remote entries use `url` + `bearer_token_env_var`.'],
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    format: 'json',
    container: 'mcp',
    dialect: 'opencode',
    paths: {
      user: path.join(home(), '.config', 'opencode', 'opencode.json'),
      project: path.join(process.cwd(), 'opencode.json'),
    },
    notes: ['`command` is a single array; remote entries use `type: "remote"` + `url`; `{env:VAR}` interpolation is supported.'],
  },
  {
    id: 'antigravity',
    label: 'Google Antigravity',
    format: 'json',
    container: 'mcpServers',
    remoteKey: 'serverUrl',
    paths: {
      user: path.join(home(), '.gemini', 'config', 'mcp_config.json'),
      project: path.join(process.cwd(), '.agents', 'mcp_config.json'),
    },
    notes: [
      'Remote entries require `serverUrl`; `url` and `httpUrl` are rejected.',
      'Several 2026 builds ignore project-level MCP files — prefer `--scope user`.',
      'Strict JSON: no comments, no trailing commas, no top-level `timeout`.',
    ],
  },
  {
    id: 'zed',
    label: 'Zed',
    format: 'json',
    container: 'context_servers',
    dialect: 'zed',
    paths: {
      user: process.platform === 'win32'
        ? path.join(appData(), 'Zed', 'settings.json')
        : path.join(home(), '.config', 'zed', 'settings.json'),
    },
    notes: ['Zed uses `context_servers` with a nested `command: { path, args }` object; stdio only.'],
  },
  {
    id: 'librechat',
    label: 'LibreChat',
    format: 'instructions',
    paths: {},
    notes: ['Add to `librechat.yaml` under `mcpServers`.'],
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT (Developer Mode + Custom GPT Actions)',
    format: 'instructions',
    paths: {},
    notes: [
      'Developer Mode connectors require a public HTTPS /mcp endpoint; localhost is not reachable.',
      'Custom GPT Actions import connectors/chatgpt/openapi.yaml instead.',
    ],
  },
  {
    id: 'generic',
    label: 'Generic / other MCP hosts',
    format: 'instructions',
    paths: {},
  },
];

export function findClient(id: string): ClientSpec | undefined {
  return CLIENTS.find((client) => client.id === id);
}

/** Builds the server entry in the host's dialect. */
export function buildEntry(client: ClientSpec, options: InstallOptions): Record<string, unknown> {
  const command = options.command ?? 'npx';
  const env: Record<string, string> = {};
  if (options.outputDir) env.OMNI_OUTPUT_DIR = options.outputDir;
  if (options.unsplashKey) env.UNSPLASH_ACCESS_KEY = options.unsplashKey;
  if (options.pexelsKey) env.PEXELS_API_KEY = options.pexelsKey;

  const remoteKey = client.remoteKey ?? 'url';

  if (client.dialect === 'opencode') {
    if (options.mode === 'http') {
      return {
        type: 'remote',
        url: options.url,
        enabled: true,
        ...(options.token ? { headers: { Authorization: 'Bearer {env:OMNI_AUTH_TOKEN}' } } : {}),
      };
    }
    return {
      type: 'local',
      command: [command, '-y', 'omni-carousel-mcp'],
      enabled: true,
      ...(Object.keys(env).length ? { environment: env } : {}),
    };
  }

  if (client.dialect === 'vscode') {
    return options.mode === 'http'
      ? {
        type: 'http',
        url: options.url,
        ...(options.token ? { headers: { Authorization: 'Bearer ${input:omni-token}' } } : {}),
      }
      : {
        type: 'stdio',
        command,
        args: ['-y', 'omni-carousel-mcp'],
        ...(Object.keys(env).length ? { env } : {}),
      };
  }

  if (client.dialect === 'zed') {
    return {
      command: { path: command, args: ['-y', 'omni-carousel-mcp'], ...(Object.keys(env).length ? { env } : {}) },
    };
  }

  if (options.mode === 'http') {
    return {
      [remoteKey]: options.url,
      ...(options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : {}),
    };
  }

  return {
    command,
    args: ['-y', 'omni-carousel-mcp'],
    ...(Object.keys(env).length ? { env } : {}),
  };
}

/** Human-readable snippet for hosts we do not edit (ChatGPT, LibreChat, generic). */
export function instructionsFor(client: ClientSpec, options: InstallOptions): string {
  const entry = buildEntry(client, options);
  if (client.id === 'chatgpt') {
    return [
      '# ChatGPT',
      '',
      '## Developer Mode (MCP)',
      `1. Expose the server publicly: \`omni-carousel-mcp --http --host 0.0.0.0 --token $OMNI_AUTH_TOKEN --public-url https://<your-host>\``,
      options.mode === 'http' ? `2. Settings → Apps & Connectors → Advanced → Developer Mode → Create → URL: ${options.url}` : '2. Re-run this installer with --mode http after exposing the server.',
      '3. Remote hosts cannot read your disk: ask for slides with output_mode "url".',
      '',
      '## Custom GPT Action',
      '1. Import `connectors/chatgpt/openapi.yaml` in the GPT editor (Actions → Import).',
      '2. Set Authentication → API key → Bearer, and paste the same OMNI_AUTH_TOKEN.',
      `3. Server URL: ${options.url.replace(/\/mcp$/, '')}`,
    ].join('\n');
  }
  if (client.id === 'librechat') {
    return [
      '# LibreChat — append to librechat.yaml',
      '',
      'mcpServers:',
      '  omni-carousel:',
      options.mode === 'http'
        ? `    type: streamable-http\n    url: ${options.url}`
        : '    type: stdio\n    command: npx\n    args:\n      - "-y"\n      - "omni-carousel-mcp"',
    ].join('\n');
  }
  return [
    '# Generic MCP host',
    '',
    'JSON (most hosts):',
    '```json',
    JSON.stringify({ mcpServers: { 'omni-carousel': entry } }, null, 2),
    '```',
    '',
    'stdio command:',
    '```bash',
    'npx -y omni-carousel-mcp',
    '```',
  ].join('\n');
}
