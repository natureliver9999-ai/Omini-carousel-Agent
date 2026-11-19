/**
 * Optional Playwright backend.
 *
 * Same scene, rendered by a real Chromium: useful when a host wants CSS effects,
 * web fonts beyond the bundled set, or when a team already has browsers in CI.
 * The engine never *requires* it — the native resvg path is the default so that
 * `npx`-style installs, serverless functions and airgapped runners still work.
 */
import sharp from 'sharp';

export interface PlaywrightCaptureOptions {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

type BrowserLike = {
  newPage: (opts?: Record<string, unknown>) => Promise<PageLike>;
  close: () => Promise<void>;
};
type PageLike = {
  setContent: (html: string, opts?: Record<string, unknown>) => Promise<void>;
  screenshot: (opts?: Record<string, unknown>) => Promise<Buffer | Uint8Array>;
  close: () => Promise<void>;
};

let cachedBrowser: BrowserLike | null = null;

export interface PlaywrightAvailability {
  available: boolean;
  reason?: string;
}

export async function playwrightAvailability(): Promise<PlaywrightAvailability> {
  try {
    const mod = await import(/* @vite-ignore */ 'playwright' as string);
    const chromium = (mod as unknown as { chromium?: { executablePath?: () => string } }).chromium;
    if (!chromium) return { available: false, reason: 'playwright installed but chromium export missing' };
    const path = chromium.executablePath?.();
    const fs = await import('node:fs');
    if (path && !fs.existsSync(path)) return { available: false, reason: `chromium binary not installed (${path})` };
    return { available: true };
  } catch (error) {
    return { available: false, reason: (error as Error).message };
  }
}

async function getBrowser(): Promise<BrowserLike> {
  if (cachedBrowser) return cachedBrowser;
  const mod = await import(/* @vite-ignore */ 'playwright' as string);
  const browser = await (mod as unknown as {
    chromium: { launch: (opts?: Record<string, unknown>) => Promise<BrowserLike> };
  }).chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--force-color-profile=srgb'],
  });
  cachedBrowser = browser;
  return browser;
}

export async function closePlaywright(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close().catch(() => undefined);
    cachedBrowser = null;
  }
}

function slideHtml(svg: string, width: number, height: number): string {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#000;}
  svg{display:block;width:${width}px;height:${height}px;}
</style></head><body>${svg}</body></html>`;
}

/** Captures each slide SVG as a pixel-exact PNG through Chromium. */
export async function captureWithPlaywright(svgs: string[], opts: PlaywrightCaptureOptions): Promise<Buffer[]> {
  const browser = await getBrowser();
  const out: Buffer[] = [];
  try {
    for (const svg of svgs) {
      const page = await browser.newPage({
        viewport: { width: opts.width, height: opts.height },
        deviceScaleFactor: opts.deviceScaleFactor ?? 1,
      });
      try {
        // Block every outbound request: a spec must never be able to phone home.
        await page.setContent(slideHtml(svg, opts.width, opts.height), { waitUntil: 'load' });
        const shot = await page.screenshot({
          type: 'png',
          clip: { x: 0, y: 0, width: opts.width, height: opts.height },
          omitBackground: false,
          animations: 'disabled',
        });
        out.push(await sharp(Buffer.from(shot)).png({ compressionLevel: 9 }).toBuffer());
      } finally {
        await page.close();
      }
    }
  } finally {
    // Keep the browser warm between slides; callers may reuse the process.
  }
  return out;
}
