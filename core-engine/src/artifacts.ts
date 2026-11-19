/**
 * Artifact registry + signed URLs.
 *
 * A remote MCP host or a Custom GPT Action cannot read the server's disk, so
 * `render_carousel` must be able to hand back a link. A bare static directory
 * would expose every tenant's deck, so links are HMAC-signed, path-bound and
 * expiring, and every file read is re-resolved inside its artifact root.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ArtifactRecord {
  id: string;
  dir: string;
  files: string[];
  createdAt: number;
}

const registry = new Map<string, ArtifactRecord>();

export function newArtifactId(prefix = 'carousel'): string {
  return `${prefix}-${crypto.randomBytes(9).toString('base64url')}`;
}

export function registerArtifact(dir: string, files: string[], id = newArtifactId()): ArtifactRecord {
  const record: ArtifactRecord = { id, dir, files, createdAt: Date.now() };
  registry.set(id, record);
  // Keep the in-memory map bounded on long-lived servers.
  if (registry.size > 512) {
    const oldest = [...registry.values()].sort((a, b) => a.createdAt - b.createdAt).slice(0, 128);
    for (const entry of oldest) registry.delete(entry.id);
  }
  return record;
}

export function getArtifact(id: string): ArtifactRecord | undefined {
  return registry.get(id);
}

export function listArtifacts(): ArtifactRecord[] {
  return [...registry.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function signingSecret(): string {
  if (process.env.OMNI_SIGNING_SECRET) return process.env.OMNI_SIGNING_SECRET;
  // Ephemeral per-process secret: URLs die with the process, which is the safe default.
  if (!ephemeralSecret) ephemeralSecret = crypto.randomBytes(32).toString('hex');
  return ephemeralSecret;
}
let ephemeralSecret: string | undefined;

export function signPayload(payload: string, secret = signingSecret()): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

export interface SignedFileUrlOptions {
  baseUrl: string;
  artifactId: string;
  /** Path relative to the artifact directory, e.g. "slides/slide-01.png". */
  relativePath: string;
  ttlSeconds?: number;
  secret?: string;
  now?: number;
}

export function signedFileUrl(options: SignedFileUrlOptions): string {
  const ttl = options.ttlSeconds ?? 3600;
  const exp = Math.floor((options.now ?? Date.now()) / 1000) + ttl;
  const clean = normalizeRelative(options.relativePath);
  const sig = signPayload(`${options.artifactId}/${clean}.${exp}`, options.secret);
  const base = options.baseUrl.replace(/\/+$/, '');
  return `${base}/files/${encodeURIComponent(options.artifactId)}/${clean
    .split('/')
    .map(encodeURIComponent)
    .join('/')}?exp=${exp}&sig=${sig}`;
}

export interface VerifyOptions {
  artifactId: string;
  relativePath: string;
  exp: string | number;
  sig: string;
  secret?: string;
  now?: number;
}

export function verifySignedFileUrl(options: VerifyOptions): { ok: boolean; reason?: string } {
  const exp = Number(options.exp);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'invalid exp' };
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  if (exp < now) return { ok: false, reason: 'link expired' };
  const clean = normalizeRelative(options.relativePath);
  const expected = signPayload(`${options.artifactId}/${clean}.${exp}`, options.secret);
  if (!timingSafeEqual(expected, String(options.sig))) return { ok: false, reason: 'bad signature' };
  return { ok: true };
}

export function normalizeRelative(relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/')).replace(/^\/+/, '');
  if (normalized.startsWith('..') || normalized.includes('/../')) {
    throw new Error('Path traversal is not allowed');
  }
  return normalized;
}

/** Resolves a file inside an artifact root, refusing anything that escapes it. */
export function resolveInsideRoot(root: string, relativePath: string): string {
  const clean = normalizeRelative(relativePath);
  const rootReal = fs.realpathSync(root);
  const target = path.resolve(rootReal, clean);
  const relative = path.relative(rootReal, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Resolved path escapes the artifact directory');
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`File not found: ${clean}`);
  }
  return target;
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}
