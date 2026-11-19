/**
 * A zero-dependency, offline, interactive preview deck.
 *
 * Slides are inline SVG, so the deck is resolution-independent, shareable as a
 * single file, and needs no CDN. A tiny script exposes the same hooks a GSAP
 * timeline would (`window.__seekSlide`, `window.__deckReady`) so screenshot
 * tooling and custom animation layers can drive it deterministically.
 */
import type { CarouselSpec } from './schema.js';
import type { Theme } from './themes.js';

export interface DeckSlide {
  index: number;
  svg: string;
  alt: string;
  layout: string;
  panorama?: { spanLength: number; indexInSpan: number };
}

export interface DeckOptions {
  spec: CarouselSpec;
  theme: Theme;
  slides: DeckSlide[];
  caption?: string;
  hashtags?: string[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildDeckHtml(opts: DeckOptions): string {
  const { spec, theme, slides } = opts;
  const title = spec.title ?? spec.id ?? 'Carousel';
  const brand = spec.brand?.name ?? '';
  const slideMarkup = slides
    .map(
      (slide) => `
      <section class="slide${slide.index === 0 ? ' is-active' : ''}" data-index="${slide.index}" aria-label="Slide ${slide.index + 1} of ${slides.length}"${slide.index === 0 ? '' : ' aria-hidden="true"'}>
        <div class="frame">${slide.svg}</div>
        <div class="meta">
          <span class="layout">${escapeHtml(slide.layout)}</span>
          ${slide.panorama ? `<span class="pano">panorama ${slide.panorama.indexInSpan + 1}/${slide.panorama.spanLength}</span>` : ''}
          <span class="count">${String(slide.index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}</span>
        </div>
        <p class="alt">${escapeHtml(slide.alt || '')}</p>
      </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} — omni-carousel preview</title>
<style>
  :root {
    --bg: ${theme.colors.bg_primary};
    --stage: #0b0c0f;
    --ink: ${theme.colors.text_primary};
    --muted: ${theme.colors.text_muted};
    --accent: ${theme.colors.accent};
    --font: ${theme.typography.body_font}, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --radius: ${theme.radii.card}px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background: var(--stage);
    color: var(--ink);
    font-family: var(--font);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 0;
    overflow: hidden;
  }
  .stage { position: relative; display: grid; place-items: center; padding: 28px; }
  .deck { position: relative; width: min(1080px, calc((100vh - 96px) * 0.8)); aspect-ratio: 4 / 5; }
  .slide {
    position: absolute; inset: 0;
    opacity: 0; visibility: hidden;
    transform: translateX(28px) scale(.985);
    transition: opacity .28s ease, transform .28s ease, visibility .28s;
  }
  .slide.is-active { opacity: 1; visibility: visible; transform: none; }
  .frame { width: 100%; height: 100%; border-radius: var(--radius); overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,.55); background: var(--bg); }
  .frame svg { display: block; width: 100%; height: 100%; }
  .meta { position: absolute; left: 0; right: 0; bottom: -34px; display: flex; gap: 10px; align-items: center; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #7b8391; }
  .meta .layout { color: var(--accent); font-weight: 700; }
  .meta .pano { color: #9aa4b2; }
  .meta .count { margin-left: auto; }
  .alt { position: absolute; top: -26px; font-size: 11px; color: #5d6470; max-width: 80%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .controls { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; }
  .controls button {
    background: #1b1f27; color: #cfd6e1; border: 1px solid #2b313c; border-radius: 10px;
    padding: 8px 14px; font: inherit; font-size: 13px; cursor: pointer;
  }
  .controls button:hover { border-color: var(--accent); color: #fff; }
  .dots { position: absolute; top: 4px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; }
  .dot { width: 22px; height: 4px; border-radius: 2px; background: #2b313c; border: 0; padding: 0; cursor: pointer; }
  .dot.on { background: var(--accent); }
  aside.panel { border-left: 1px solid #1d2129; background: #0f1116; padding: 22px 22px 28px; overflow-y: auto; font-size: 13px; line-height: 1.6; color: #b9c0cc; }
  aside.panel h1 { font-size: 15px; margin: 0 0 4px; color: #fff; letter-spacing: -.01em; }
  aside.panel .sub { color: #6f7887; font-size: 12px; margin-bottom: 18px; }
  aside.panel h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #6f7887; margin: 22px 0 8px; }
  aside.panel pre { white-space: pre-wrap; font-family: ${theme.typography.body_font}, ui-monospace, monospace; font-size: 12.5px; margin: 0; color: #d5dbe5; }
  aside.panel .tags { color: var(--accent); word-break: break-word; }
  aside.panel .stat { display: flex; justify-content: space-between; border-bottom: 1px dashed #222833; padding: 5px 0; }
  aside.panel .stat span:last-child { color: #fff; }
  @media (max-width: 900px) { body { grid-template-columns: 1fr; } aside.panel { display: none; } }
  @media print { body { display: block; background: #fff; } .slide { position: static; opacity: 1; visibility: visible; transform: none; page-break-after: always; } .meta, .alt, .controls, .dots, aside.panel { display: none; } .deck { width: 100%; aspect-ratio: auto; } }
</style>
</head>
<body>
  <div class="stage">
    <div class="dots" role="tablist">${slides.map((s, i) => `<button class="dot${i === 0 ? ' on' : ''}" data-goto="${i}" aria-label="Go to slide ${i + 1}"></button>`).join('')}</div>
    <div class="deck" id="deck">${slideMarkup}</div>
    <div class="controls">
      <button data-step="-1" aria-label="Previous slide">← Prev</button>
      <button data-step="1" aria-label="Next slide">Next →</button>
    </div>
  </div>
  <aside class="panel">
    <h1>${escapeHtml(title)}</h1>
    <div class="sub">${escapeHtml(brand)}${brand ? ' · ' : ''}${spec.platform} · ${spec.goal} · ${theme.name}</div>
    <div class="stat"><span>Slides</span><span>${slides.length}</span></div>
    <div class="stat"><span>Canvas</span><span>1080 × 1350</span></div>
    <div class="stat"><span>Theme</span><span>${escapeHtml(theme.id)}</span></div>
    <h2>Caption</h2>
    <pre>${escapeHtml(opts.caption ?? spec.caption?.text ?? '')}</pre>
    ${opts.hashtags?.length ? `<h2>Hashtags</h2><p class="tags">${escapeHtml(opts.hashtags.join(' '))}</p>` : ''}
    <h2>Keyboard</h2>
    <pre>← → navigate · 1-9 jump · Home reset · P print</pre>
  </aside>
  <script>
  (function () {
    var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    var dots = Array.prototype.slice.call(document.querySelectorAll('.dot'));
    var current = 0;
    function render(index) {
      current = Math.max(0, Math.min(slides.length - 1, index));
      slides.forEach(function (slide, i) {
        var active = i === current;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots.forEach(function (dot, i) { dot.classList.toggle('on', i === current); });
      window.__slideIndex = current;
    }
    // Deterministic capture hooks, GSAP-timeline compatible.
    window.__seekSlide = function (value) {
      if (value > 0 && value <= 1 && value % 1 !== 0) value = Math.round(value * (slides.length - 1));
      render(value);
      return current;
    };
    window.__gsapSeek = window.__seekSlide;
    window.__deckReady = true;
    window.__deckSlides = slides.length;
    document.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' || event.key === ' ') { render(current + 1); event.preventDefault(); }
      else if (event.key === 'ArrowLeft') { render(current - 1); event.preventDefault(); }
      else if (event.key === 'Home') render(0);
      else if (event.key === 'End') render(slides.length - 1);
      else if (event.key === 'p' || event.key === 'P') window.print();
      else if (/^[1-9]$/.test(event.key)) render(Number(event.key) - 1);
    });
    document.querySelectorAll('[data-step]').forEach(function (button) {
      button.addEventListener('click', function () { render(current + Number(button.dataset.step)); });
    });
    document.querySelectorAll('[data-goto]').forEach(function (button) {
      button.addEventListener('click', function () { render(Number(button.dataset.goto)); });
    });
    var startX = null;
    document.addEventListener('touchstart', function (event) { startX = event.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', function (event) {
      if (startX === null) return;
      var dx = event.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) render(current + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
    if (/[?&]capture=1/.test(location.search)) {
      slides.forEach(function (slide) { slide.style.transition = 'none'; });
    }
  })();
  </script>
</body>
</html>`;
}
