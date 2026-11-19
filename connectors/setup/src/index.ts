#!/usr/bin/env node
/**
 * `omni-carousel setup` — the installer.
 *
 *   npx omni-carousel-setup --client claude-code --scope project
 *   npx omni-carousel-setup --client antigravity --mode http --url https://x/mcp --token $TOKEN
 *   npx omni-carousel-setup --client cursor --dry-run
 *   npx omni-carousel-setup --client codex --uninstall
 */
import fs from 'node:fs';
import path from 'node:path';
import { CLIENTS, buildEntry, findClient, instructionsFor, type ClientId, type InstallOptions, type Scope } from './clients.js';
import { SERVER_KEY, tomlTable, upsertJson, upsertToml, type WriteResult } from './merge.js';

interface Args extends InstallOptions {
  client?: ClientId;
  scope: Scope;
  dryRun: boolean;
  uninstall: boolean;
  print: boolean;
  list: boolean;
  help: boolean;
  all?: boolean;
}

const USAGE = `omni-carousel setup — connect the carousel engine to your AI host

Usage
  omni-carousel-setup --client <id> [options]
  omni-carousel-setup --list
  omni-carousel-setup --client <id> --print

Clients
${CLIENTS.map((client) => `  ${client.id.padEnd(16)} ${client.label}`).join('\n')}

Options
  --client <id>        Target host (see list above)
  --scope <s>          user | project (default: user)
  --mode <m>           stdio | http (default: stdio)
  --url <url>          Remote MCP endpoint for --mode http
  --token <secret>     Bearer token to write into the host config
  --output-dir <dir>   Where renders are written (default: ~/carousels)
  --command <bin>      Override the binary (default: npx; use an absolute path if PATH is not inherited)
  --dry-run            Show what would change, touch nothing
  --uninstall          Remove only the omni-carousel entry
  --print              Print the config/instructions instead of writing
  --list               List supported clients
  --help               This message

Guarantees: timestamped backup before any write · sibling servers preserved ·
running twice is a no-op · uninstall leaves everything else intact.
`;

function parse(argv: string[]): Args {
  const args: Args = {
    mode: 'stdio',
    url: 'http://127.0.0.1:8765/mcp',
    scope: 'user',
    dryRun: false,
    uninstall: false,
    print: false,
    list: false,
    help: false,
    outputDir: process.env.OMNI_OUTPUT_DIR ?? path.join(process.env.HOME ?? '.', 'carousels'),
    token: process.env.OMNI_AUTH_TOKEN,
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
    pexelsKey: process.env.PEXELS_API_KEY,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case '--client': args.client = argv[++i] as ClientId; break;
      case '--scope': args.scope = (argv[++i] as Scope) ?? 'user'; break;
      case '--mode': args.mode = (argv[++i] as 'stdio' | 'http') ?? 'stdio'; break;
      case '--url': args.url = argv[++i]; break;
      case '--token': args.token = argv[++i]; break;
      case '--output-dir': args.outputDir = argv[++i]; break;
      case '--command': args.command = argv[++i]; break;
      case '--dry-run': args.dryRun = true; break;
      case '--uninstall': args.uninstall = true; break;
      case '--print': args.print = true; break;
      case '--list': args.list = true; break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        if (flag.startsWith('-')) {
          console.error(`Unknown option ${flag}\n`);
          process.stderr.write(USAGE);
          process.exit(2);
        }
    }
  }
  return args;
}

function report(result: WriteResult, dryRun: boolean): void {
  const prefix = dryRun ? 'would ' : '';
  const label = result.changed ? `${prefix}${result.diffSummary}` : result.diffSummary;
  console.log(`  ${result.path}`);
  console.log(`    ${label}${result.created ? ' (new file)' : ''}${result.backup ? ` · backup ${path.basename(result.backup)}` : ''}`);
}

function main(): number {
  const args = parse(process.argv.slice(2));

  if (args.help || (!args.client && !args.list)) {
    process.stdout.write(USAGE);
    return args.client || args.list ? 0 : 2;
  }

  if (args.list) {
    for (const client of CLIENTS) {
      const scopes = Object.keys(client.paths).join('/') || 'instructions only';
      console.log(`${client.id.padEnd(16)} ${client.label.padEnd(34)} ${scopes}`);
    }
    return 0;
  }

  const client = findClient(args.client!);
  if (!client) {
    console.error(`Unknown client "${args.client}". Run --list to see the supported hosts.`);
    return 2;
  }

  console.log(`\nomni-carousel → ${client.label} (${args.mode}, ${args.scope} scope${args.dryRun ? ', dry run' : ''})\n`);

  if (client.format === 'instructions') {
    console.log(instructionsFor(client, args));
    console.log('');
    (client.notes ?? []).forEach((note) => console.log(`note: ${note}`));
    return 0;
  }

  if (args.print) {
    console.log(JSON.stringify({ [client.container ?? 'mcpServers']: { [SERVER_KEY]: buildEntry(client, args) } }, null, 2));
    return 0;
  }

  const target = client.paths[args.scope];
  if (!target) {
    console.error(`${client.label} does not support ${args.scope} scope. Available: ${Object.keys(client.paths).join(', ') || 'none'}`);
    return 2;
  }

  const results: WriteResult[] = [];
  if (client.format === 'toml') {
    const entry = buildEntry(client, args);
    const body = args.mode === 'http'
      ? tomlTable(`mcp_servers.${SERVER_KEY}`, { url: String(entry.url), bearer_token_env_var: 'OMNI_AUTH_TOKEN' })
      : tomlTable(`mcp_servers.${SERVER_KEY}`, {
        command: String(entry.command),
        args: (entry.args as string[]) ?? [],
        env_vars: entry.env ? Object.keys(entry.env as Record<string, string>) : undefined,
      });
    results.push(upsertToml({ file: target, table: `mcp_servers.${SERVER_KEY}`, body, uninstall: args.uninstall, dryRun: args.dryRun }));
  } else {
    results.push(upsertJson({
      file: target,
      containerKey: client.container ?? 'mcpServers',
      entry: buildEntry(client, args),
      uninstall: args.uninstall,
      dryRun: args.dryRun,
    }));
  }

  for (const result of results) report(result, args.dryRun);

  // Skills: Claude Code and Codex read project skills from `.claude/skills` / `.agents/skills`.
  if (args.scope === 'project' && !args.uninstall) {
    const skillSource = path.resolve(process.cwd(), 'skills/carousel-architect');
    if (fs.existsSync(skillSource)) {
      const links: Array<[string, string]> = [];
      if (client.id === 'claude-code') links.push([path.join(process.cwd(), '.claude', 'skills', 'carousel-architect'), skillSource]);
      if (client.id === 'codex') links.push([path.join(process.cwd(), '.agents', 'skills', 'carousel-architect'), skillSource]);
      if (client.id === 'antigravity') links.push([path.join(process.cwd(), '.agents', 'skills', 'carousel-architect'), skillSource]);
      for (const [link, source] of links) {
        if (args.dryRun) {
          console.log(`  ${link}\n    would link → ${path.relative(process.cwd(), source)}`);
          continue;
        }
        try {
          fs.mkdirSync(path.dirname(link), { recursive: true });
          if (fs.existsSync(link) || fs.lstatSync(link, { throwIfNoEntry: false })) {
            console.log(`  ${link}\n    already present`);
            continue;
          }
          fs.symlinkSync(path.relative(path.dirname(link), source), link, 'dir');
          console.log(`  ${link}\n    linked → ${path.relative(process.cwd(), source)}`);
        } catch (error) {
          console.log(`  ${link}\n    skipped (${(error as Error).message})`);
        }
      }
    }
  }

  if (!args.uninstall && !args.dryRun) {
    console.log('\nNext steps');
    if (client.id === 'claude-desktop' || client.id === 'windsurf') console.log('  · Restart the app so it reloads MCP servers.');
    if (client.id === 'codex') console.log('  · Run `codex` and check /mcp inside the session.');
    if (client.id === 'vscode') console.log('  · Reload the window, then run "MCP: List Servers" from the command palette.');
    if (client.id === 'opencode') console.log('  · Run `opencode` and check the MCP panel.');
    console.log('  · Ask: "Use omni-carousel to make a 9-slide Instagram carousel about <topic>."');
    console.log('  · Verify: npx -y omni-carousel-mcp --version && node -e "console.log(require(\'./package.json\').version)" >/dev/null');
  }

  (client.notes ?? []).forEach((note) => console.log(`\nnote: ${note}`));
  console.log('');
  return 0;
}

process.exitCode = main();
