import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Static gallery for a rendered output tree.
 *
 * Why generate HTML instead of a markdown index: a carousel repo is judged by its
 * pixels. The gallery puts every cover, every slide and every artefact one click
 * away, and it opens from disk with no server and no network (no CDN fonts, no
 * framework) so it also works inside a zip or a GitHub Pages push.
 */

export interface GalleryDeck {
  id: string;
  title: string;
  platform: string;
  theme: string;
  goal?: string;
  slides: Array<{ index: number; layout: string; file: string }>;
  files: Record<string, string | undefined>;
  renderer: string;
  durationMs?: number;
  caption?: string;
  patterns: string[];
}

export interface GalleryOptions {
  /** Directory containing one folder per rendered deck. */
  renderedRoot: string;
  /** Output HTML file. */
  outFile: string;
  title?: string;
}

const LAYOUT_PATTERNS: Record<string, string> = {
  cover_hook: 'hook',
  contrast_split: 'contrast',
  layer_stack: 'system',
  bento_grid: 'framework',
  reveal_hold: 'open loop',
  scrapbook: 'human',
  data_chart: 'evidence',
  steps: 'playbook',
  proof: 'authority',
  summary: 'recap',
  cta: 'conversion',
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function collectDecks(renderedRoot: string): GalleryDeck[] {
  if (!fs.existsSync(renderedRoot)) return [];
  const decks: GalleryDeck[] = [];
  for (const entry of fs.readdirSync(renderedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(renderedRoot, entry.name);
    const manifest = readJson<{
      renderer?: string;
      platform?: string;
      theme?: string;
      slides?: Array<{ index: number; layout: string; file: string }>;
      duration_ms?: number;
    }>(path.join(dir, 'manifest.json'));
    const spec = readJson<{ title?: string; platform?: string; theme?: string; goal?: string; caption?: { text?: string }; slides?: Array<{ layout: string }> }>(
      path.join(dir, 'spec.json'),
    );
    if (!manifest || !spec) continue;
    const slides = (manifest.slides ?? []).map((slide) => ({
      index: slide.index,
      layout: slide.layout,
      file: `${entry.name}/${slide.file}`,
    }));
    const files: Record<string, string | undefined> = {};
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.pdf')) files.pdf = `${entry.name}/${file}`;
      else if (file.endsWith('.zip')) files.zip = `${entry.name}/${file}`;
      else if (file.endsWith('.html')) files.deck = `${entry.name}/${file}`;
      else if (file === 'caption.md') files.caption = `${entry.name}/${file}`;
      else if (file === 'spec.json') files.spec = `${entry.name}/${file}`;
      else if (file === 'manifest.json') files.manifest = `${entry.name}/${file}`;
      else if (file === 'attribution.json') files.attribution = `${entry.name}/${file}`;
    }
    const layouts = new Set(slides.map((slide) => LAYOUT_PATTERNS[slide.layout] ?? slide.layout));
    decks.push({
      id: entry.name,
      title: spec.title ?? entry.name,
      platform: spec.platform ?? manifest.platform ?? 'generic',
      theme: spec.theme ?? manifest.theme ?? 'editorial',
      goal: spec.goal,
      slides,
      files,
      renderer: manifest.renderer ?? 'resvg',
      durationMs: manifest.duration_ms,
      caption: spec.caption?.text,
      patterns: [...layouts],
    });
  }
  return decks.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildGalleryHtml(decks: GalleryDeck[], options: { title?: string } = {}): string {
  const totalSlides = decks.reduce((sum, deck) => sum + deck.slides.length, 0);
  const themes = [...new Set(decks.map((deck) => deck.theme))];
  const layouts = [...new Set(decks.flatMap((deck) => deck.slides.map((slide) => slide.layout)))].sort();
  const renderers = [...new Set(decks.map((deck) => deck.renderer))];
  const title = options.title ?? 'omni-carousel · rendered decks';

  const cards = decks
    .map((deck) => {
      const cover = deck.slides[0]?.file;
      const strip = deck.slides
        .slice(1, 6)
        .map((slide) => `<img loading="lazy" src="${escapeHtml(slide.file)}" alt="${escapeHtml(slide.layout)} slide" />`)
        .join('');
      const links = [
        deck.files.pdf ? `<a href="${escapeHtml(deck.files.pdf)}">PDF</a>` : '',
        deck.files.zip ? `<a href="${escapeHtml(deck.files.zip)}">ZIP</a>` : '',
        deck.files.deck ? `<a href="${escapeHtml(deck.files.deck)}">HTML deck</a>` : '',
        deck.files.spec ? `<a href="${escapeHtml(deck.files.spec)}">spec.json</a>` : '',
        deck.files.caption ? `<a href="${escapeHtml(deck.files.caption)}">caption.md</a>` : '',
      ].filter(Boolean).join('');
      return `
      <article class="deck" data-platform="${escapeHtml(deck.platform)}" data-theme="${escapeHtml(deck.theme)}">
        <button class="cover" data-open="${escapeHtml(deck.id)}" aria-label="Open ${escapeHtml(deck.title)}">
          ${cover ? `<img loading="lazy" src="${escapeHtml(cover)}" alt="Cover of ${escapeHtml(deck.title)}" />` : ''}
          <span class="cover-badge">${deck.slides.length} slides</span>
        </button>
        <div class="meta">
          <h3>${escapeHtml(deck.title)}</h3>
          <p class="sub"><span class="pill">${escapeHtml(deck.platform)}</span><span class="pill">${escapeHtml(deck.theme)}</span>${
            deck.durationMs ? `<span class="dim">${(deck.durationMs / 1000).toFixed(2)}s</span>` : ''
          }</p>
          <p class="patterns">${deck.patterns.map((pattern) => `<span>${escapeHtml(pattern)}</span>`).join('')}</p>
          <div class="strip">${strip}</div>
          <p class="links">${links}</p>
        </div>
      </article>`;
    })
    .join('');

  const lightbox = decks
    .map((deck) => `
      <div class="lightbox" id="lb-${escapeHtml(deck.id)}" hidden>
        <div class="lb-inner">
          <header>
            <h4>${escapeHtml(deck.title)}</h4>
            <button data-close>Close</button>
          </header>
          <div class="lb-slides">
            ${deck.slides.map((slide) => `<figure><img loading="lazy" src="${escapeHtml(slide.file)}" alt="${escapeHtml(slide.layout)}" /><figcaption>${slide.index}. ${escapeHtml(slide.layout)}</figcaption></figure>`).join('')}
          </div>
        </div>
      </div>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --bg: #0b0c0e; --panel: #14161a; --line: #262a31; --text: #f4f1ea; --dim: #9aa1ad;
    --accent: #c8ff32; --serif: ui-serif, Georgia, 'Times New Roman', serif;
    --sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); }
  a { color: inherit; }
  header.hero { padding: 72px clamp(20px, 5vw, 72px) 40px; border-bottom: 1px solid var(--line); }
  .eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); }
  h1 { font-family: var(--serif); font-weight: 700; font-size: clamp(34px, 5vw, 64px); line-height: 1.02; margin: 18px 0 16px; max-width: 22ch; }
  .lede { color: var(--dim); max-width: 62ch; line-height: 1.55; font-size: 17px; }
  .atlas-link { margin-top: 24px; font-family: var(--mono); font-size: 12px; letter-spacing: .06em; }
  .atlas-link a { color: var(--accent); text-decoration: none; border-bottom: 1px solid currentColor; padding-bottom: 2px; }
  .stats { display: flex; flex-wrap: wrap; gap: 32px; margin-top: 26px; }
  .stat b { display: block; font-family: var(--serif); font-size: 34px; }
  .stat span { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
  main { padding: 44px clamp(20px, 5vw, 72px) 96px; display: grid; gap: 40px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
  .deck { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; }
  .cover { position: relative; display: block; padding: 0; border: 0; background: #000; cursor: zoom-in; }
  .cover img { width: 100%; display: block; transition: transform .5s ease, opacity .3s ease; }
  .cover:hover img { transform: scale(1.02); }
  .cover-badge { position: absolute; left: 14px; bottom: 14px; font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; background: rgba(11,12,14,.82); color: var(--accent); padding: 6px 10px; border-radius: 999px; }
  .meta { padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 10px; }
  .meta h3 { margin: 0; font-family: var(--serif); font-size: 22px; line-height: 1.2; }
  .sub { margin: 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .pill { font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; border: 1px solid var(--line); border-radius: 999px; padding: 4px 9px; color: var(--dim); }
  .dim { color: var(--dim); font-family: var(--mono); font-size: 11px; }
  .patterns { margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .patterns span { font-size: 11px; color: var(--accent); border-bottom: 1px solid rgba(200,255,50,.35); padding-bottom: 1px; }
  .strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .strip img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 6px; opacity: .82; }
  .links { margin: 4px 0 0; display: flex; flex-wrap: wrap; gap: 14px; font-family: var(--mono); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
  .links a { color: var(--dim); text-decoration: none; border-bottom: 1px solid var(--line); padding-bottom: 2px; }
  .links a:hover { color: var(--accent); border-color: var(--accent); }
  .lightbox { position: fixed; inset: 0; background: rgba(4,5,7,.94); z-index: 10; overflow: auto; }
  .lightbox[hidden] { display: none; }
  .lb-inner { max-width: 1280px; margin: 0 auto; padding: 28px clamp(16px, 4vw, 48px) 64px; }
  .lb-inner header { display: flex; justify-content: space-between; align-items: center; gap: 16px; position: sticky; top: 0; background: rgba(4,5,7,.92); padding: 10px 0 18px; backdrop-filter: blur(6px); }
  .lb-inner h4 { font-family: var(--serif); font-size: 24px; margin: 0; }
  .lb-inner button { background: transparent; color: var(--text); border: 1px solid var(--line); border-radius: 999px; padding: 8px 16px; cursor: pointer; font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; }
  .lb-slides { display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .lb-slides figure { margin: 0; }
  .lb-slides img { width: 100%; border-radius: 10px; display: block; }
  .lb-slides figcaption { font-family: var(--mono); font-size: 11px; color: var(--dim); margin-top: 8px; }
  footer { border-top: 1px solid var(--line); padding: 28px clamp(20px, 5vw, 72px) 64px; color: var(--dim); font-family: var(--mono); font-size: 11px; letter-spacing: .06em; display: flex; flex-wrap: wrap; gap: 18px; justify-content: space-between; }
  @media (prefers-reduced-motion: reduce) { .cover img { transition: none; } }
</style>
</head>
<body>
<header class="hero">
  <p class="eyebrow">omni-carousel-agent · gallery</p>
  <h1>Every deck here was written as JSON and rendered by the engine.</h1>
  <p class="lede">No design tool, no browser renderer, no stock-template. Copy budgets, WCAG contrast and panorama geometry are enforced by the linter before a single pixel is drawn — then the same spec renders the PNG slides, the multi-page PDF, the printable HTML deck and the caption.</p>
  <p class="atlas-link"><a href="atlas.html">▸ The generative atlas — eight plotter styles in every theme</a></p>
  <div class="stats">
    <div class="stat"><b>${decks.length}</b><span>decks</span></div>
    <div class="stat"><b>${totalSlides}</b><span>slides</span></div>
    <div class="stat"><b>${layouts.length}</b><span>layouts used</span></div>
    <div class="stat"><b>${themes.length}</b><span>themes</span></div>
    <div class="stat"><b>${renderers.join(' · ')}</b><span>renderer</span></div>
  </div>
</header>
<main>${cards}</main>
${lightbox}
<footer>
  <span>Generated by <code>omni-carousel gallery</code> · <code>omni-carousel canvas</code></span>
  <span>${new Date().toISOString().slice(0, 10)}</span>
</footer>
<script>
  document.querySelectorAll('[data-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const box = document.getElementById('lb-' + button.dataset.open);
      if (box) box.hidden = false;
      document.body.style.overflow = 'hidden';
    });
  });
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.lightbox').hidden = true;
      document.body.style.overflow = '';
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.lightbox').forEach((box) => { box.hidden = true; });
    document.body.style.overflow = '';
  });
</script>
</body>
</html>
`;
}

export function writeGallery(options: GalleryOptions): { outFile: string; decks: GalleryDeck[] } {
  const decks = collectDecks(options.renderedRoot);
  const html = buildGalleryHtml(decks, { title: options.title });
  fs.mkdirSync(path.dirname(options.outFile), { recursive: true });
  fs.writeFileSync(options.outFile, html);
  return { outFile: options.outFile, decks };
}

/** Default rendered root, relative to the repo (works from dist/ or src/). */
export function defaultRenderedRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repo = path.resolve(here, '..');
  return path.join(repo, '..', 'examples', 'rendered');
}
