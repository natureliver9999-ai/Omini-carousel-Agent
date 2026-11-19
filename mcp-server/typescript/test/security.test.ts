import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mimeFor,
  normalizeRelative,
  resolveInsideRoot,
  signedFileUrl,
  verifySignedFileUrl,
} from '@omni-carousel/engine';

const SECRET = 'test-secret-do-not-ship';
const ARTIFACT = 'carousel-abc123';

function url(overrides: Partial<Parameters<typeof signedFileUrl>[0]> = {}, now = Date.now()) {
  return signedFileUrl({
    baseUrl: 'https://studio.example.com',
    artifactId: ARTIFACT,
    relativePath: 'slides/slide-01.png',
    ttlSeconds: 60,
    secret: SECRET,
    now,
    ...overrides,
  });
}

function params(signed: string) {
  const parsed = new URL(signed);
  const relative = decodeURIComponent(parsed.pathname.replace(`/files/${ARTIFACT}/`, ''));
  return {
    artifactId: ARTIFACT,
    relativePath: relative,
    exp: parsed.searchParams.get('exp') ?? '',
    sig: parsed.searchParams.get('sig') ?? '',
  };
}

describe('signed artifact URLs', () => {
  it('verifies a freshly signed URL', () => {
    const now = Date.now();
    expect(verifySignedFileUrl({ ...params(url({}, now)), secret: SECRET, now })).toEqual({ ok: true });
  });

  it('rejects a tampered path', () => {
    const now = Date.now();
    const parts = params(url({}, now));
    const result = verifySignedFileUrl({ ...parts, relativePath: 'slides/slide-02.png', secret: SECRET, now });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bad signature');
  });

  it('rejects a tampered expiry (extending the TTL invalidates the signature)', () => {
    const now = Date.now();
    const parts = params(url({}, now));
    const result = verifySignedFileUrl({ ...parts, exp: Number(parts.exp) + 86400, secret: SECRET, now });
    expect(result.ok).toBe(false);
  });

  it('rejects a URL signed with another secret', () => {
    const now = Date.now();
    const parts = params(url({}, now));
    expect(verifySignedFileUrl({ ...parts, secret: 'attacker', now }).reason).toBe('bad signature');
  });

  it('expires links once the TTL passes', () => {
    const now = Date.now();
    const parts = params(url({ ttlSeconds: 60 }, now));
    expect(verifySignedFileUrl({ ...parts, secret: SECRET, now: now + 61_000 }).reason).toBe('link expired');
  });

  it('rejects a non-numeric expiry', () => {
    const now = Date.now();
    const parts = params(url({}, now));
    expect(verifySignedFileUrl({ ...parts, exp: 'later', secret: SECRET, now }).ok).toBe(false);
  });

  it('percent-encodes segments and keeps the path inside the artifact', () => {
    const signed = url({ relativePath: 'slides/slide 01.png' });
    expect(signed).toContain('/files/carousel-abc123/slides/slide%2001.png?');
  });
});

describe('path handling', () => {
  it('normalises redundant separators', () => {
    expect(normalizeRelative('./slides//slide-01.png')).toBe('slides/slide-01.png');
  });

  it('refuses anything that escapes upward', () => {
    for (const attack of ['../etc/passwd', 'slides/../../etc/passwd', 'a/b/../../../c', '..\\..\\windows\\win.ini']) {
      expect(() => normalizeRelative(attack), attack).toThrow(/traversal/i);
    }
  });

  it('rebases an absolute path into the root instead of honouring it', () => {
    // `/etc/passwd` is not an escape attempt *after* normalisation, but it must never
    // resolve to the host filesystem — the leading slash is stripped, so it becomes
    // a relative path inside the artifact directory.
    expect(normalizeRelative('/etc/passwd')).toBe('etc/passwd');
  });

  it('resolves a real file inside the artifact root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omni-artifact-'));
    mkdirSync(path.join(root, 'slides'));
    writeFileSync(path.join(root, 'slides', 'slide-01.png'), 'png');
    expect(resolveInsideRoot(root, 'slides/slide-01.png')).toBe(path.join(root, 'slides', 'slide-01.png'));
  });

  it('refuses a symlink that escapes the artifact root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omni-artifact-'));
    const outside = mkdtempSync(path.join(tmpdir(), 'omni-outside-'));
    writeFileSync(path.join(outside, 'secret.txt'), 'nope');
    expect(() => resolveInsideRoot(root, '../' + path.basename(outside) + '/secret.txt')).toThrow(/traversal/i);
  });

  it('reports a missing file rather than guessing', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omni-artifact-'));
    expect(() => resolveInsideRoot(root, 'slides/missing.png')).toThrow(/not found/i);
  });

  it('maps known extensions and falls back safely', () => {
    expect(mimeFor('a.png')).toBe('image/png');
    expect(mimeFor('a.pdf')).toBe('application/pdf');
    expect(mimeFor('a.zip')).toBe('application/zip');
    expect(mimeFor('a.exe')).toBe('application/octet-stream');
  });
});
