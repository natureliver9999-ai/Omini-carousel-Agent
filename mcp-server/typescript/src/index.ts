#!/usr/bin/env node
import './stdio-guard.js';
/**
 * `omni-carousel-mcp` — entry point.
 *
 *   omni-carousel-mcp                 # stdio (Claude Desktop, Codex, Cursor, …)
 *   omni-carousel-mcp --http          # Streamable HTTP on 127.0.0.1:8765/mcp
 *   omni-carousel-mcp --http --host 0.0.0.0 --token $OMNI_AUTH_TOKEN
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createOmniServer } from './server.js';
import { createHttpServer } from './http.js';
import { isLoopback } from '@omni-carousel/engine';

interface Args {
  http: boolean;
  host: string;
  port: number;
  token?: string;
  publicUrl?: string;
  outputDir?: string;
  allowUnauthenticated: boolean;
  help: boolean;
  version: boolean;
}

const USAGE = `omni-carousel-mcp — MCP server for omni-carousel-agent

Usage
  omni-carousel-mcp [--http] [options]

Options
  --http                   Serve Streamable HTTP instead of stdio (endpoint /mcp)
  --host <addr>            Bind address for --http (default 127.0.0.1)
  --port <n>               Port for --http (default 8765, or $OMNI_PORT)
  --token <secret>         Require Authorization: Bearer <secret> (or $OMNI_AUTH_TOKEN)
  --public-url <url>       Base URL used to mint signed artifact links (or $OMNI_PUBLIC_URL)
  --output-dir <dir>       Root directory for rendered decks (or $OMNI_OUTPUT_DIR)
  --allow-unauthenticated  Permit a non-loopback bind without a token (trusted sandboxes only)
  --version                Print the version
  --help                   Print this help

Tools: get_playbook, list_layouts, list_themes, validate_spec, render_carousel,
preview_slide, fetch_asset, make_chart, make_diagram
Resources: carousel://playbook, carousel://schema.json, carousel://themes/{id}
Prompt: create_carousel(topic, platform, goal)
`;

function parse(argv: string[]): Args {
  const args: Args = {
    http: false,
    host: process.env.OMNI_HOST ?? '127.0.0.1',
    port: Number(process.env.OMNI_PORT ?? 8765),
    token: process.env.OMNI_AUTH_TOKEN,
    publicUrl: process.env.OMNI_PUBLIC_URL,
    outputDir: process.env.OMNI_OUTPUT_DIR,
    allowUnauthenticated: process.env.OMNI_ALLOW_UNAUTHENTICATED === '1',
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    switch (token) {
      case '--http': args.http = true; break;
      case '--host': args.host = argv[++i]; break;
      case '--port': args.port = Number(argv[++i]); break;
      case '--token': args.token = argv[++i]; break;
      case '--public-url': args.publicUrl = argv[++i]; break;
      case '--output-dir': args.outputDir = argv[++i]; break;
      case '--allow-unauthenticated': args.allowUnauthenticated = true; break;
      case '--version': args.version = true; break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        if (token.startsWith('-')) {
          console.error(`Unknown option ${token}\n`);
          process.stderr.write(USAGE);
          process.exit(2);
        }
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parse(process.argv.slice(2));

  if (args.help) { process.stdout.write(USAGE); return; }
  if (args.version) { console.log('omni-carousel-mcp 0.1.0'); return; }

  if (!args.http) {
    const server = createOmniServer({
      publicUrl: args.publicUrl,
      outputRoot: args.outputDir,
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[omni-carousel] stdio transport ready');
    return;
  }

  if (!args.token && !isLoopback(args.host) && !args.allowUnauthenticated) {
    console.error(
      `[omni-carousel] refusing to bind ${args.host} without authentication.\n` +
      'Set --token/OMNI_AUTH_TOKEN, bind 127.0.0.1, or pass --allow-unauthenticated for a trusted sandbox.',
    );
    process.exit(1);
  }

  const { server } = createHttpServer({
    port: args.port,
    host: args.host,
    publicUrl: args.publicUrl ?? `http://${args.host === '0.0.0.0' ? '127.0.0.1' : args.host}:${args.port}`,
    outputRoot: args.outputDir,
    auth: { token: args.token, allowUnauthenticated: args.allowUnauthenticated },
  });

  server.listen(args.port, args.host, () => {
    console.error(`[omni-carousel] Streamable HTTP ready on http://${args.host}:${args.port}/mcp`);
    console.error(`[omni-carousel] artifacts: ${args.outputDir ?? process.env.OMNI_OUTPUT_DIR ?? './carousels'}`);
    if (!args.token) console.error('[omni-carousel] no auth token configured (loopback only recommended)');
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(`[omni-carousel] fatal: ${(error as Error).message}`);
  process.exit(1);
});
