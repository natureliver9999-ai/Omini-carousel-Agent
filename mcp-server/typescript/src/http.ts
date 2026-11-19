/**
 * Streamable HTTP transport (MCP 2025-11-25), plus signed artifact delivery.
 *
 * Stateless mode: every POST /mcp builds a fresh server + transport pair, so the
 * process can be horizontally scaled or restarted without breaking sessions.
 */
import http from 'node:http';
import fsp from 'node:fs/promises';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  getArtifact,
  mimeFor,
  resolveInsideRoot,
  verifySignedFileUrl,
} from '@omni-carousel/engine';
import { authorize, checkHost, checkOrigin, loadAuthConfig, type AuthConfig } from '@omni-carousel/engine';
import { createOmniServer, type ServerOptions } from './server.js';

export interface HttpServerOptions extends ServerOptions {
  port?: number;
  host?: string;
  auth?: Partial<AuthConfig>;
}

const MAX_BODY = 8 * 1024 * 1024;

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function cors(res: http.ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization, mcp-session-id, mcp-protocol-version, last-event-id');
  res.setHeader('access-control-expose-headers', 'mcp-session-id, mcp-protocol-version');
}

export function createHttpServer(options: HttpServerOptions = {}): { server: http.Server; config: AuthConfig } {
  const config = loadAuthConfig(options.auth);
  const serverOptions: ServerOptions = {
    publicUrl: options.publicUrl ?? process.env.OMNI_PUBLIC_URL,
    outputRoot: options.outputRoot,
    urlTtlSeconds: options.urlTtlSeconds,
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    cors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/healthz' || url.pathname === '/') {
      sendJson(res, 200, {
        ok: true,
        name: 'omni-carousel-mcp',
        version: '0.1.0',
        transport: 'streamable-http',
        endpoint: '/mcp',
        auth: Boolean(config.token),
      });
      return;
    }

    const hostCheck = checkHost(req, config);
    if (!hostCheck.ok) {
      sendJson(res, 421, { error: hostCheck.message });
      return;
    }

    const originCheck = checkOrigin(req, config);
    if (!originCheck.ok) {
      sendJson(res, 403, { error: originCheck.message });
      return;
    }

    // ---- signed artifact delivery (no bearer token needed: the signature *is* the capability)
    if (url.pathname.startsWith('/files/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'Use GET' });
        return;
      }
      const segments = url.pathname.split('/').filter(Boolean); // ['files', id, ...rest]
      const artifactId = decodeURIComponent(segments[1] ?? '');
      const relative = segments.slice(2).map(decodeURIComponent).join('/');
      const artifact = getArtifact(artifactId);
      if (!artifact) {
        sendJson(res, 404, { error: 'Unknown artifact' });
        return;
      }
      const verification = verifySignedFileUrl({
        artifactId,
        relativePath: relative,
        exp: url.searchParams.get('exp') ?? '',
        sig: url.searchParams.get('sig') ?? '',
      });
      if (!verification.ok) {
        sendJson(res, verification.reason === 'link expired' ? 410 : 403, { error: verification.reason });
        return;
      }
      try {
        const file = resolveInsideRoot(artifact.dir, relative);
        const stat = await fsp.stat(file);
        const bytes = await fsp.readFile(file);
        res.writeHead(200, {
          'content-type': mimeFor(file),
          'content-length': stat.size,
          'cache-control': 'private, max-age=300',
          'content-disposition': `inline; filename="${relative.split('/').pop()}"`,
          'x-content-type-options': 'nosniff',
        });
        res.end(req.method === 'HEAD' ? undefined : bytes);
      } catch (error) {
        sendJson(res, 404, { error: (error as Error).message });
      }
      return;
    }

    if (url.pathname !== '/mcp') {
      sendJson(res, 404, { error: 'Not found. MCP endpoint is /mcp.' });
      return;
    }

    const auth = authorize(req, config);
    if (!auth.ok) {
      res.setHeader('www-authenticate', 'Bearer realm="omni-carousel"');
      sendJson(res, auth.status, { error: auth.message });
      return;
    }

    if (req.method !== 'POST') {
      // Stateless mode has no long-lived stream, so GET/DELETE are explicitly unsupported.
      sendJson(res, 405, {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed. This server is stateless: POST JSON-RPC to /mcp.' },
        id: null,
      });
      return;
    }

    let body: unknown;
    try {
      body = JSON.parse((await readBody(req)).toString('utf8'));
    } catch (error) {
      sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: `Parse error: ${(error as Error).message}` }, id: null });
      return;
    }

    const omniServer = createOmniServer(serverOptions);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void omniServer.close();
    });

    try {
      await omniServer.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) {
        sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: (error as Error).message }, id: null });
      }
    }
  });

  return { server, config };
}
