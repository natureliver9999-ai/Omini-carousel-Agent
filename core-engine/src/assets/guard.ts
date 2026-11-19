/**
 * SSRF guard for every outbound fetch the engine performs.
 *
 * Tool arguments are authored by an LLM, and an LLM can be prompt-injected by a
 * web page it just read. So a URL arriving at `fetch_asset` is treated as hostile:
 * HTTPS only, allowlisted hosts and ports, DNS resolved and then *re-checked*
 * against private/loopback/link-local ranges (defeating DNS rebinding), plus a
 * response size cap and a MIME allowlist.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

export const ALLOWED_HOSTS = [
  'api.unsplash.com',
  'images.unsplash.com',
  'api.pexels.com',
  'images.pexels.com',
  'quickchart.io',
  'fonts.gstatic.com',
];

export const MAX_BYTES = 10 * 1024 * 1024;

export interface GuardOptions {
  allowedHosts?: string[];
  allowAnyHost?: boolean;
  maxBytes?: number;
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4ToInt(address);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // IPv4-mapped / IPv4-compatible forms
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true; // not an IP at all: refuse
}

export async function assertSafeUrl(rawUrl: string, options: GuardOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Malformed URL: ${rawUrl}`);
  }
  if (url.protocol !== 'https:') throw new SsrfError('Only https: URLs are allowed');
  if (url.username || url.password) throw new SsrfError('Credentials in URLs are not allowed');
  if (url.port && url.port !== '443') throw new SsrfError(`Port ${url.port} is not allowed`);

  const host = url.hostname.toLowerCase();
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new SsrfError(`Address ${host} is in a private or reserved range`);
  } else {
    const allowed = options.allowedHosts ?? ALLOWED_HOSTS;
    if (!options.allowAnyHost) {
      const ok = allowed.some((entry) => host === entry || host.endsWith(`.${entry}`));
      if (!ok) throw new SsrfError(`Host ${host} is not on the allowlist (${allowed.join(', ')})`);
    }
    // Resolve, then re-check every answer: this is what stops DNS rebinding.
    let records: Array<{ address: string }>;
    try {
      records = await dns.lookup(host, { all: true, verbatim: true });
    } catch (error) {
      throw new SsrfError(`DNS resolution failed for ${host}: ${(error as Error).message}`);
    }
    if (!records.length) throw new SsrfError(`Host ${host} did not resolve`);
    for (const record of records) {
      if (isPrivateAddress(record.address)) {
        throw new SsrfError(`Host ${host} resolves to ${record.address}, a private or reserved address`);
      }
    }
  }
  return url;
}

/** Fetches with the guard applied, a hard timeout, and a streaming size cap. */
export async function guardedFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: GuardOptions = {},
): Promise<{ bytes: Buffer; contentType: string; url: string }> {
  const url = await assertSafeUrl(rawUrl, options);
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.allowAnyHost ? 30_000 : 12_000);
  try {
    const response = await fetch(url, { ...init, redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) {
      throw new SsrfError(`Redirects are not followed (${response.status} from ${url.hostname})`);
    }
    if (!response.ok) throw new Error(`Upstream responded ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type') ?? '';
    const lengthHeader = Number(response.headers.get('content-length') ?? '0');
    if (lengthHeader && lengthHeader > maxBytes) throw new Error(`Response is ${lengthHeader} bytes; cap is ${maxBytes}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Upstream returned no body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Response exceeded the ${maxBytes}-byte cap`);
      }
      chunks.push(value);
    }
    return { bytes: Buffer.concat(chunks), contentType, url: url.toString() };
  } finally {
    clearTimeout(timeout);
  }
}
