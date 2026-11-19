/**
 * The web studio: one self-contained HTML page, served by the REST facade.
 *
 * It exists so the whole engine can be demonstrated — and the user can literally
 * watch a deck render — without any build step, CDN, or front-end dependency.
 */
export const STUDIO_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Omni Carousel Studio</title>
<style>
  :root{
    --bg:#0a0b0e; --panel:#111318; --panel-2:#161922; --line:#242936; --ink:#e9edf5; --muted:#8b93a5;
    --accent:#c8ff32; --danger:#ff6b6b; --warn:#ffb84d; --ok:#4ade80; --radius:14px;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
  .app{display:grid;grid-template-columns:minmax(380px,1fr) minmax(420px,1.05fr);height:100vh;overflow:hidden}
  header{padding:18px 22px 12px;border-bottom:1px solid var(--line);display:flex;align-items:baseline;gap:12px}
  header h1{font-size:16px;margin:0;letter-spacing:-.01em}
  header .dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent)}
  header .sub{color:var(--muted);font-size:12px}
  .col{display:flex;flex-direction:column;min-height:0;overflow:hidden}
  .col.left{border-right:1px solid var(--line)}
  .toolbar{display:flex;gap:8px;flex-wrap:wrap;padding:12px 22px;border-bottom:1px solid var(--line);align-items:center}
  select,input,button,textarea{font:inherit;color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:7px 10px}
  select:focus,textarea:focus,button:focus{outline:2px solid rgba(200,255,50,.35);outline-offset:1px}
  button{cursor:pointer;background:var(--panel-2)}
  button.primary{background:var(--accent);color:#0b0d0a;border-color:var(--accent);font-weight:700}
  button.primary[disabled]{opacity:.55;cursor:progress}
  button.ghost{background:transparent}
  .editor{flex:1;display:flex;min-height:0;padding:14px 22px 18px}
  textarea{width:100%;height:100%;resize:none;font-family:var(--mono);font-size:12.5px;line-height:1.6;padding:14px;border-radius:var(--radius);background:#0d0f14}
  .status{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--muted);padding:0 22px 14px}
  .pill{padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
  .pill.pass{background:rgba(74,222,128,.15);color:var(--ok)}
  .pill.fail{background:rgba(255,107,107,.15);color:var(--danger)}
  .pill.timing{background:rgba(255,255,255,.06);color:var(--muted)}
  .viewer{flex:1;overflow:auto;padding:20px 22px 28px}
  .stage{background:#05060a;border:1px solid var(--line);border-radius:var(--radius);padding:16px;display:grid;place-items:center;min-height:340px}
  .stage img{width:100%;max-width:340px;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.6);display:block}
  .empty{color:var(--muted);font-size:13px;text-align:center;max-width:320px;line-height:1.7}
  .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px;margin-top:14px}
  .thumbs button{padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:none;line-height:0}
  .thumbs button.on{border-color:var(--accent)}
  .thumbs img{width:100%;display:block}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:24px 0 8px}
  .lint{display:flex;flex-direction:column;gap:6px;font-size:12.5px}
  .lint .row{border-left:3px solid var(--line);padding:6px 10px;background:var(--panel);border-radius:0 8px 8px 0}
  .lint .row.error{border-color:var(--danger)}
  .lint .row.warn{border-color:var(--warn)}
  .lint .row.info{border-color:#5b6577}
  .lint code{color:var(--muted);font-family:var(--mono);font-size:11px}
  pre.caption{white-space:pre-wrap;font-size:13px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;margin:0;color:#cdd4e2}
  .links{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  .links a{color:var(--accent);text-decoration:none;font-size:12.5px;border:1px solid var(--line);padding:5px 10px;border-radius:8px}
  .links a:hover{border-color:var(--accent)}
  .hint{color:var(--muted);font-size:12px}
  @media (max-width:960px){ .app{grid-template-columns:1fr;height:auto;overflow:visible} .col.left{border-right:0} .editor{min-height:320px} }
</style>
</head>
<body>
<div class="app">
  <section class="col left">
    <header><span class="dot"></span><h1>Omni Carousel Studio</h1><span class="sub">spec → validate → render</span></header>
    <div class="toolbar">
      <select id="examples" aria-label="Load an example spec"></select>
      <select id="theme" aria-label="Theme override"><option value="">theme: from spec</option></select>
      <button class="ghost" id="validate">Validate</button>
      <button class="primary" id="render">Render</button>
    </div>
    <div class="editor"><textarea id="spec" spellcheck="false"></textarea></div>
    <div class="status" id="status"><span class="pill timing">idle</span><span>Ctrl/Cmd + Enter to render</span></div>
  </section>
  <section class="col right">
    <header><h1>Preview</h1><span class="sub" id="meta">1080 × 1350 · WCAG AA</span></header>
    <div class="viewer">
      <div class="stage" id="stage"><div class="empty">Load an example, edit the spec, then hit <strong>Render</strong>.<br/>Slides, lint findings, the caption and a downloadable bundle all appear here.</div></div>
      <div class="thumbs" id="thumbs"></div>
      <div id="outputs"></div>
    </div>
  </section>
</div>
<script>
const $ = (id) => document.getElementById(id);
const state = { slides: [], index: 0 };

async function boot() {
  const [layouts, themes, examples] = await Promise.all([
    fetch('/v1/layouts').then(r => r.json()).catch(() => ({ layouts: [] })),
    fetch('/v1/themes').then(r => r.json()).catch(() => ({ themes: [] })),
    fetch('/v1/examples').then(r => r.json()).catch(() => ({ examples: [] })),
  ]);
  $('theme').innerHTML = '<option value="">theme: from spec</option>' +
    themes.themes.map(t => '<option value="' + t.id + '">' + t.name + '</option>').join('');
  $('examples').innerHTML = examples.examples.map(e =>
    '<option value="' + e.id + '">' + e.title + ' · ' + e.platform + '</option>').join('');
  $('examples').onchange = async () => {
    const res = await fetch('/v1/examples/' + encodeURIComponent($('examples').value));
    const data = await res.json();
    $('spec').value = JSON.stringify(data.spec, null, 2);
    setStatus('loaded', 'info');
  };
  if (examples.examples.length) {
    $('spec').value = JSON.stringify(examples.examples[0].spec ?? {}, null, 2);
    $('examples').dispatchEvent(new Event('change'));
  }
  $('meta').textContent = layouts.layouts.length + ' layouts · ' + themes.themes.length + ' themes · 1080 × 1350';
}

function setStatus(text, kind) {
  const cls = kind === 'pass' ? 'pass' : kind === 'fail' ? 'fail' : 'timing';
  $('status').innerHTML = '<span class="pill ' + cls + '">' + text + '</span>' +
    (kind === 'pass' || kind === 'fail' ? '<span>Ctrl/Cmd + Enter to render</span>' : '');
}

function readSpec() {
  try { return JSON.parse($('spec').value); }
  catch (error) { throw new Error('Spec is not valid JSON: ' + error.message); }
}

async function validate() {
  try {
    const res = await fetch('/v1/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spec: readSpec() }) });
    const data = await res.json();
    renderLint(data.lint);
    setStatus(data.ok ? (data.lint.warnings.length ? 'pass (warnings)' : 'pass') : 'fail', data.ok ? 'pass' : 'fail');
  } catch (error) { setStatus(error.message, 'fail'); }
}

async function render() {
  $('render').disabled = true;
  setStatus('rendering…');
  try {
    const body = { spec: readSpec(), output_mode: 'url' };
    const theme = $('theme').value;
    if (theme) body.theme = theme;
    const res = await fetch('/v1/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    state.slides = data.urls?.slides ?? data.slides ?? [];
    showSlide(0);
    renderThumbs();
    renderLint(data.lint);
    renderOutputs(data);
    setStatus(data.lint.ok ? (data.lint.warnings.length ? 'pass (warnings)' : 'pass') : 'fail', data.lint.ok ? 'pass' : 'fail');
    $('meta').textContent = data.slides.length + ' slides · ' + data.renderer + ' · ' + Math.round(data.duration_ms) + 'ms';
  } catch (error) {
    setStatus(error.message, 'fail');
  } finally { $('render').disabled = false; }
}

function showSlide(index) {
  const slide = state.slides[index];
  if (!slide) return;
  state.index = index;
  const url = slide.url || slide.file_url || '';
  $('stage').innerHTML = '<img alt="slide ' + (index + 1) + '" src="' + url + '" />';
  document.querySelectorAll('.thumbs button').forEach((b, i) => b.classList.toggle('on', i === index));
}

function renderThumbs() {
  $('thumbs').innerHTML = state.slides.map((slide, i) =>
    '<button title="slide ' + (i + 1) + '"><img alt="" src="' + (slide.url || slide.file_url || '') + '" /></button>').join('');
  document.querySelectorAll('.thumbs button').forEach((b, i) => b.onclick = () => showSlide(i));
}

function renderLint(lint) {
  const rows = [].concat(lint.errors || [], lint.warnings || [], lint.infos || []).slice(0, 40);
  if (!rows.length) { document.getElementById('outputs')?.querySelector('.lint')?.remove(); return; }
  let host = document.querySelector('.lint');
  if (!host) {
    host = document.createElement('div');
    host.className = 'lint';
    const title = document.createElement('h2');
    title.textContent = 'Lint';
    $('outputs').appendChild(title);
    $('outputs').appendChild(host);
  }
  host.innerHTML = rows.map(issue =>
    '<div class="row ' + issue.severity + '"><code>' + issue.code + '</code> · ' + issue.path + '<br/>' +
    escapeHtml(issue.message) + (issue.hint ? '<br/><span class="hint">→ ' + escapeHtml(issue.hint) + '</span>' : '') + '</div>').join('');
}

function renderOutputs(data) {
  const links = data.urls?.files ?? {};
  const params = data.urls?.artifact_id ? ' (artifact ' + data.urls.artifact_id + ')' : '';
  $('outputs').innerHTML =
    '<h2>Artifacts' + params + '</h2>' +
    '<div class="links">' +
    Object.entries(links).filter(([, v]) => v).map(([k, v]) => '<a href="' + v + '" target="_blank" rel="noreferrer">' + k + '</a>').join('') +
    '</div>' +
    (data.caption ? '<h2>Caption</h2><pre class="caption">' + escapeHtml(data.caption) + '</pre>' : '');
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

$('render').onclick = render;
$('validate').onclick = validate;
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); render(); }
});
boot();
</script>
</body>
</html>`;
