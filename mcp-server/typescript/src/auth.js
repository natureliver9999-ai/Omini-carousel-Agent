/**
 * HTTP authentication + origin policy.
 *
 * A local MCP server is a filesystem-adjacent capability. Binding it to 0.0.0.0
 * without a token is how a carousel renderer becomes an arbitrary-file-write
 * primitive for anyone on the LAN, so the server refuses that combination.
 */
import { timingSafeEqual } from '@omni-carousel/engine';
import net from 'node:net';
export function isLoopback(host) {
    if (host === 'localhost' || host === '::1')
        return true;
    return net.isIP(host) === 4 ? host.startsWith('127.') : false;
}
export function loadAuthConfig(overrides = {}) {
    const extraHosts = (process.env.OMNI_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    const extraOrigins = (process.env.OMNI_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    const publicUrl = process.env.OMNI_PUBLIC_URL;
    const publicHost = publicUrl ? safeHost(publicUrl) : undefined;
    return {
        token: overrides.token ?? process.env.OMNI_AUTH_TOKEN ?? undefined,
        allowUnauthenticated: overrides.allowUnauthenticated ?? process.env.OMNI_ALLOW_UNAUTHENTICATED === '1',
        allowedHosts: overrides.allowedHosts ?? [
            'localhost',
            '127.0.0.1',
            '[::1]',
            ...(publicHost ? [publicHost] : []),
            ...extraHosts,
        ],
        allowedOrigins: overrides.allowedOrigins ?? [
            `http://localhost:${process.env.OMNI_PORT ?? 8765}`,
            `http://127.0.0.1:${process.env.OMNI_PORT ?? 8765}`,
            ...(publicUrl ? [publicUrl.replace(/\/+$/, '').toLowerCase()] : []),
            ...extraOrigins,
            // Arena / E2B style preview hosts: <port>-<sandbox>.e2b.app
            'https://*.e2b.app',
        ],
    };
}
function safeHost(url) {
    try {
        return new URL(url).host.toLowerCase();
    }
    catch {
        return undefined;
    }
}
export function authorize(req, config) {
    if (!config.token) {
        if (config.allowUnauthenticated)
            return { ok: true, status: 200 };
        return { ok: true, status: 200 };
    }
    const header = req.headers.authorization ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match)
        return { ok: false, status: 401, message: 'Missing Authorization: Bearer <token>' };
    if (!timingSafeEqual(match[1], config.token))
        return { ok: false, status: 401, message: 'Invalid bearer token' };
    return { ok: true, status: 200 };
}
export function checkHost(req, config) {
    const host = (req.headers.host ?? '').toLowerCase();
    const hostname = host.replace(/:\d+$/, '');
    if (!host)
        return { ok: true };
    if (config.allowedHosts.includes(hostname) || config.allowedHosts.includes(host))
        return { ok: true };
    // Preview proxies forward the real host; allow when explicitly wildcarded.
    if (config.allowedHosts.some((entry) => entry.startsWith('*.') && hostname.endsWith(entry.slice(2))))
        return { ok: true };
    if (process.env.OMNI_ALLOW_ANY_HOST === '1')
        return { ok: true };
    return { ok: false, message: `Host ${hostname} is not allowed (set OMNI_ALLOWED_HOSTS to include it)` };
}
export function checkOrigin(req, config) {
    const origin = (req.headers.origin ?? '').toLowerCase();
    if (!origin)
        return { ok: true };
    const matches = config.allowedOrigins.some((entry) => {
        if (entry === origin)
            return true;
        if (entry.startsWith('https://*.')) {
            return origin.endsWith(entry.slice('https://*'.length)) && origin.startsWith('https://');
        }
        return false;
    });
    if (matches)
        return { ok: true };
    if (process.env.OMNI_ALLOW_ANY_ORIGIN === '1')
        return { ok: true };
    return { ok: false, message: `Origin ${origin} is not allowed (set OMNI_ALLOWED_ORIGINS)` };
}
//# sourceMappingURL=auth.js.map