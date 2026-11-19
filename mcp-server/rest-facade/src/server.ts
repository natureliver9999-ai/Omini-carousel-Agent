#!/usr/bin/env node
/**
 * REST + OpenAPI 3.1 facade.
 *
 * Exists for hosts that speak HTTP but not MCP: ChatGPT Custom GPT Actions,
 * Zapier/Make, internal gateways, and the bundled web studio.
 *
 * Same engine, same schema, same linter — only the envelope is different.
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ChartSchema,
  renderChartPng,
  sanitizeSlug,
  auditThemeContrast,
  buildFullPlaybook,
  buildPlaybook,
  defaultOutputRoot,
  formatLintReport,
  getArtifact,
  lintSpec,
  listThemes,
  loadTheme,
  LAYOUT_META,
  mimeFor,
  registerArtifact,
  renderCarousel,
  resolveInsideRoot,
  signedFileUrl,
  verifySignedFileUrl,
} from '@omni-carousel/engine';
import type { PlaybookTopic, RenderResult } from '@omni-carousel/engine';
import { STUDIO_HTML } from './studio.js';
import { checkHost, checkOrigin, loadAuthConfig, isLoopback, authorize } from '@omni-carousel/engine';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 8 * 1024 * 1024;

interface Options {
  host: string;
  port: number;
  publicUrl?: string;
  outputRoot?: string;
  allowUnauthenticated: boolean;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

function html(res: http.ServerResponse, body: string): void {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function baseUrlFor(req: http.IncomingMessage, fallback?: string): string {
  if (fallback) return fallback.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '127.0.0.1');
  return `${proto}://${host}`;
}

function examplesDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'examples/specs'),
    path.resolve(HERE, '../../../../examples/specs'),
    path.resolve(HERE, '../../../examples/specs'),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) ?? null;
}

function loadExamples(): Array<{ id: string; title: string; platform: string; spec: unknown }> {
  const dir = examplesDir();
  if (!dir) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      try {
        const spec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as {
          id?: string; title?: string; platform?: string;
        };
        return [{ id: spec.id ?? file.replace(/\.json$/, ''), title: spec.title ?? spec.id ?? file, platform: spec.platform ?? 'instagram', spec }];
      } catch {
        return [];
      }
    });
}

export function createServer(options: Options): http.Server {
  const config = loadAuthConfig({ allowUnauthenticated: options.allowUnauthenticated });
  const outputRoot = options.outputRoot ?? defaultOutputRoot();

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const method = req.method ?? 'GET';

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-max-age': '600',
      });
      res.end();
      return;
    }

    if (!checkHost(req, config).ok) {
      json(res, 421, { error: checkHost(req, config).message });
      return;
    }
    if (!checkOrigin(req, config).ok) {
      json(res, 403, { error: checkOrigin(req, config).message });
      return;
    }

    try {
      /* ---------------- studio & docs ---------------- */
      if (url.pathname === '/' || url.pathname === '/studio') {
        html(res, STUDIO_HTML);
        return;
      }
      if (url.pathname === '/healthz') {
        json(res, 200, {
          ok: true, name: 'omni-carousel-rest', version: '0.1.0',
          endpoints: ['/v1/playbook', '/v1/layouts', '/v1/themes', '/v1/validate', '/v1/render', '/v1/examples', '/openapi.yaml'],
        });
        return;
      }
      if (url.pathname === '/openapi.yaml' || url.pathname === '/openapi.json') {
        const file = [
          path.resolve(HERE, '../openapi.yaml'),
          path.resolve(HERE, '../../openapi.yaml'),
          path.resolve(process.cwd(), 'mcp-server/rest-facade/openapi.yaml'),
        ].find((candidate) => fs.existsSync(candidate));
        if (!file) { json(res, 404, { error: 'openapi.yaml not found next to the server' }); return; }
        const text = fs.readFileSync(file, 'utf8');
        res.writeHead(200, { 'content-type': 'application/yaml; charset=utf-8', 'cache-control': 'no-store' });
        res.end(text);
        return;
      }

      /* ---------------- signed files ---------------- */
      if (url.pathname.startsWith('/files/')) {
        const segments = url.pathname.split('/').filter(Boolean);
        const artifactId = decodeURIComponent(segments[1] ?? '');
        const relative = segments.slice(2).map(decodeURIComponent).join('/');
        const artifact = getArtifact(artifactId);
        if (!artifact) { json(res, 404, { error: 'Unknown or expired artifact' }); return; }
        const verification = verifySignedFileUrl({
          artifactId,
          relativePath: relative,
          exp: url.searchParams.get('exp') ?? '',
          sig: url.searchParams.get('sig') ?? '',
        });
        if (!verification.ok) { json(res, verification.reason === 'link expired' ? 410 : 403, { error: verification.reason }); return; }
        const file = resolveInsideRoot(artifact.dir, relative);
        const bytes = await fsp.readFile(file);
        res.writeHead(200, {
          'content-type': mimeFor(file),
          'content-length': bytes.length,
          'cache-control': 'private, max-age=300',
          'x-content-type-options': 'nosniff',
        });
        res.end(bytes);
        return;
      }

      /* ---------------- read-only API ---------------- */
      if (method === 'GET' && url.pathname === '/v1/playbook') {
        const topic = (url.searchParams.get('topic') ?? 'all') as PlaybookTopic | 'all';
        const markdown = topic === 'all' ? buildFullPlaybook() : buildPlaybook(topic as PlaybookTopic);
        if (url.searchParams.get('format') === 'json') { json(res, 200, { topic, markdown }); return; }
        res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
        res.end(markdown);
        return;
      }

      if (method === 'GET' && url.pathname === '/v1/layouts') {
        json(res, 200, { layouts: Object.entries(LAYOUT_META).map(([id, meta]) => ({ id, ...meta })) });
        return;
      }

      if (method === 'GET' && url.pathname === '/v1/themes') {
        json(res, 200, { themes: listThemes() });
        return;
      }

      if (method === 'GET' && url.pathname.startsWith('/v1/themes/')) {
        const id = decodeURIComponent(url.pathname.slice('/v1/themes/'.length));
        const theme = loadTheme(id);
        json(res, 200, { theme, contrast: auditThemeContrast(theme) });
        return;
      }

      if (method === 'GET' && url.pathname === '/v1/examples') {
        const examples = loadExamples().map(({ spec, ...rest }) => ({ ...rest, spec }));
        json(res, 200, { examples });
        return;
      }

      if (method === 'GET' && url.pathname.startsWith('/v1/examples/')) {
        const id = decodeURIComponent(url.pathname.slice('/v1/examples/'.length));
        const example = loadExamples().find((entry) => entry.id === id);
        if (!example) { json(res, 404, { error: `No example "${id}"` }); return; }
        json(res, 200, { example });
        return;
      }

      /* ---------------- mutating API ---------------- */
      if (method === 'POST' && (url.pathname === '/v1/validate' || url.pathname === '/v1/render')) {
        const auth = authorize(req, config);
        if (!auth.ok) { json(res, auth.status, { error: auth.message }); return; }
      }

      if (method === 'POST' && url.pathname === '/v1/validate') {
        const body = JSON.parse(await readBody(req)) as { spec?: unknown };
        const report = lintSpec(body.spec);
        if (url.searchParams.get('format') === 'text') {
          res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(formatLintReport(report));
          return;
        }
        json(res, 200, { ok: report.ok, lint: report });
        return;
      }

      if (method === 'POST' && url.pathname === '/v1/render') {
        const body = JSON.parse(await readBody(req)) as {
          spec?: unknown;
          output_mode?: 'url' | 'path' | 'inline';
          theme?: string;
          formats?: Array<'png' | 'pdf' | 'zip' | 'html' | 'json' | 'caption'>;
          strict?: boolean;
          chart?: unknown;
        };
        const started = Date.now();
        const result: RenderResult = await renderCarousel(body.spec, {
          theme: body.theme,
          formats: body.formats,
          strict: body.strict,
          quiet: true,
          outputRoot,
        });
        const mode = body.output_mode ?? 'url';
        const base = baseUrlFor(req, options.publicUrl);
        const record = registerArtifact(result.dir, [
          ...result.slides.map((slide) => `slides/${slide.filename}`),
          ...Object.values(result.files).filter((file): file is string => Boolean(file)),
        ]);
        const ttl = 3600;
        const rel = (file?: string) => (file ? path.relative(result.dir, file).split(path.sep).join('/') : undefined);

        const payload: Record<string, unknown> = {
          ok: result.lint.ok,
          renderer: result.renderer,
          duration_ms: Date.now() - started,
          dir: result.dir,
          output_mode: mode,
          slides: result.slides.map((slide) => ({
            index: slide.index,
            layout: slide.layout,
            width: slide.width,
            height: slide.height,
            panorama: slide.panorama ?? null,
          })),
          lint: result.lint,
          warnings: result.warnings,
          caption: result.spec.caption?.text ?? '',
          files: Object.fromEntries(Object.entries(result.files).filter(([, value]) => Boolean(value))),
        };

        if (mode === 'url') {
          const fileUrls: Record<string, string> = {};
          for (const [key, relative] of Object.entries({
            pdf: rel(result.files.pdf),
            zip: rel(result.files.zip),
            html: rel(result.files.html),
            spec: rel(result.files.spec),
            caption: rel(result.files.caption),
            manifest: rel(result.files.manifest),
          })) {
            if (relative) fileUrls[key] = signedFileUrl({ baseUrl: base, artifactId: record.id, relativePath: relative, ttlSeconds: ttl });
          }
          payload.urls = {
            artifact_id: record.id,
            slides: result.slides.map((slide) => ({
              index: slide.index,
              url: signedFileUrl({ baseUrl: base, artifactId: record.id, relativePath: `slides/${slide.filename}`, ttlSeconds: ttl }),
            })),
            files: fileUrls,
            expires_in_seconds: ttl,
          };
        } else if (mode === 'inline') {
          payload.images = result.buffers.map((buffer) => `data:image/png;base64,${buffer.toString('base64')}`);
        }

        json(res, 200, payload);
        return;
      }

      if (method === 'POST' && url.pathname === '/v1/chart') {
        const body = JSON.parse(await readBody(req)) as {
          chart?: unknown; theme?: string; width?: number; height?: number; title?: string;
        };
        const chart = ChartSchema.parse(body.chart);
        const png = renderChartPng(chart, { theme: body.theme, width: body.width, height: body.height, title: body.title });
        const dir = path.join(outputRoot, 'charts');
        await fsp.mkdir(dir, { recursive: true });
        const file = path.join(dir, `chart-${sanitizeSlug(body.title ?? 'chart')}-${Date.now().toString(36)}.png`);
        await fsp.writeFile(file, png);
        const record = registerArtifact(dir, [path.basename(file)]);
        json(res, 200, { file, url: signedFileUrl({ baseUrl: baseUrlFor(req, options.publicUrl), artifactId: record.id, relativePath: path.basename(file) }) });
        return;
      }

      json(res, 404, { error: `No route for ${method} ${url.pathname}` });
    } catch (error) {
      const message = (error as Error).message;
      json(res, message.startsWith('Invalid CarouselSpec') ? 422 : 400, { error: message });
    }
  });
}

function parseArgs(argv: string[]): Options & { help: boolean; token?: string } {
  const options: Options & { help: boolean; token?: string } = {
    host: process.env.OMNI_HOST ?? '127.0.0.1',
    port: Number(process.env.OMNI_PORT ?? 8765),
    publicUrl: process.env.OMNI_PUBLIC_URL,
    outputRoot: process.env.OMNI_OUTPUT_DIR,
    allowUnauthenticated: process.env.OMNI_ALLOW_UNAUTHENTICATED === '1',
    help: false,
    token: process.env.OMNI_AUTH_TOKEN,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--host': options.host = argv[++i]; break;
      case '--port': options.port = Number(argv[++i]); break;
      case '--public-url': options.publicUrl = argv[++i]; break;
      case '--output-dir':
      case '--out': options.outputRoot = argv[++i]; break;
      case '--token': options.token = argv[++i]; break;
      case '--allow-unauthenticated': options.allowUnauthenticated = true; break;
      case '--help':
      case '-h': options.help = true; break;
      default: break;
    }
  }
  return options;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`omni-carousel-rest — REST facade + web studio

Usage: omni-carousel-rest [--host 0.0.0.0] [--port 8765] [--public-url URL]
                          [--output-dir DIR] [--token SECRET] [--allow-unauthenticated]

GET  /                  web studio
GET  /openapi.yaml      OpenAPI 3.1 document (import into a Custom GPT Action)
GET  /v1/playbook       markdown playbook (?topic=instagram|linkedin|hooks|patterns|layouts)
GET  /v1/layouts        layout catalog
GET  /v1/themes         themes (+ id variant)
GET  /v1/examples       starter specs (+ id variant)
POST /v1/validate       { spec } -> lint report
POST /v1/render         { spec, output_mode?, theme?, formats? } -> slides + signed links
GET  /files/:id/*       signed, expiring artifact delivery
GET  /healthz           liveness`);
    process.exit(0);
  }
  if (!options.token && !isLoopback(options.host) && !options.allowUnauthenticated) {
    console.error(`Refusing to bind ${options.host} without a token. Use --token, bind 127.0.0.1, or pass --allow-unauthenticated.`);
    process.exit(1);
  }
  const server = createServer(options);
  server.listen(options.port, options.host, () => {
    console.error(`[omni-carousel] studio  http://${options.host}:${options.port}/`);
    console.error(`[omni-carousel] openapi http://${options.host}:${options.port}/openapi.yaml`);
    console.error(`[omni-carousel] output  ${options.outputRoot ?? defaultOutputRoot()}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
