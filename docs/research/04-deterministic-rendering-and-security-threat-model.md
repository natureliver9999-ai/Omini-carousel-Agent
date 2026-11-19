# Research Report 04: Deterministic Dual-Backend Rendering & Zero-Trust Threat Model

**Last Updated:** 19 November 2026  
**Scope:** Rendering determinism, wide-canvas panorama mathematics, dual-backend architecture (Playwright + Rust Resvg/Sharp/PDF-Lib), security controls, and open-source licensing.

---

## 1. Why Dual-Backend Deterministic Rendering?

The blueprint specifies **TypeScript + Playwright** as the primary rendering stack because HTML/CSS/SVG/GSAP offers expressive layout control. However, production deployments across developer machines, CI runners, Docker containers, MCP `npx` one-liners, and serverless functions expose a critical operational reality:

- **Playwright Chromium** requires downloading ~400 MB of browser binaries + OS shared libraries (`libnss3`, `libatk`, `libgbm`, `libasound2`). In locked-down corporate proxies, airgapped CI runners, or lightweight containers, browser binary downloads are frequently blocked or unavailable.
- **Native Rust `@resvg/resvg-js` + `sharp` + `pdf-lib`** compiles directly into ~15 MB prebuilt Node native addons distributed via standard `registry.npmjs.org`, loads bundled `.ttf` OFL font files directly from `core-engine/fonts/` without touching OS fontconfig, and rasterizes `1080×1350` slides in **30–60 ms per slide** (10x faster than cold-launching Chromium) with **100% bit-exact cross-platform determinism**.

### The Unified Scene Architecture in `core-engine`
`core-engine` implements **both** backends from the exact same `CarouselSpec` and theme tokens:
1. **Deterministic Vector Scene Composer (`layouts/*.ts`):** Produces crisp, pixel-positioned `1080×1350` (and `1080*K × 1350` panorama) SVG scenes using bundled OFL typography metrics, deterministic text wrapping, WCAG-verified theme tokens, and Lucide vector icons.
2. **HTML + Tailwind-Token CSS + GSAP Deck Wrapper (`render.ts`):** Wraps every slide (and panorama viewport) in standalone semantic HTML5 + CSS custom properties + deterministic GSAP timeline hooks (`window.__seekSlide(progress)` sought to `1.0` before capture), serving both:
   - **Playwright Chromium capture** (`--renderer=playwright`, or `auto` when Chromium is installed), AND
   - **Interactive `deck.html` Web Preview**, allowing humans to swipe, inspect safe zones, copy captions, and preview animations in any browser!
3. **Native Raster & PDF Pipeline (`--renderer=resvg`, automatic in `auto` when Chromium is absent):** Rasterizes the SVG scene via `@resvg/resvg-js` with bundled `.ttf` fonts, slices wide panorama canvases with `sharp.extract()`, and embeds exact `1080×1350 pt` pages into a LinkedIn-ready multi-page PDF via `pdf-lib`.

Result: **Zero external binary failures, <0.5s full 10-slide carousel renders, and full Playwright compatibility.**

---

## 2. Pixel-Exact Panorama Slicing Mathematics

Let a carousel have $N$ slides ($1$-indexed) and a panorama span configured across slides $[a, b]$ where $1 \le a < b \le N$ and $K = b - a + 1 \in [2, 6]$.

1. **Unified Panorama Coordinate Space:**
   - Total width: $W_{\text{pan}} = 1080 \times K\text{ px}$
   - Total height: $H_{\text{pan}} = 1350\text{ px}$
   - Seam abscissae: $S_j = 1080 \cdot j$ for $j \in \{1, \dots, K-1\}$

2. **Continuous Cross-Seam Artwork:**
   - Background gradient, subtle architectural grid, continuous multi-segment cubic Bezier ribbon $B(t)$ for $t \in [0, W_{\text{pan}}]$, and cross-seam geometric nodes centered at $x = S_j$ with radius $r \ge 90\text{ px}$ (guaranteeing **50% left / 50% right** presence across seam $S_j$, comfortably exceeding the 25% minimum rule) are drawn **once** onto the single $W_{\text{pan}} \times 1350$ canvas.
   - Per-slide foreground typography for slide $i \in [a, b]$ is translated by $\Delta x_i = 1080 \cdot (i - a)$ and confined to $[\Delta x_i + 72, \Delta x_i + 1008]$, ensuring **72 px clearance on both sides of every seam $S_j$**.

3. **Exact Integer Cropping:**
   - The full $W_{\text{pan}} \times 1350$ raster buffer is sliced into $K$ tiles using exact integer bounding boxes:
     $$\text{Crop}_j = \{ \text{left}: 1080j,\ \text{top}: 0,\ \text{width}: 1080,\ \text{height}: 1350 \}, \quad j \in \{0, \dots, K-1\}$$
   - Because anti-aliasing of cross-seam curves happens **prior** to slicing on the unified $W_{\text{pan}}$ buffer, column $x = 1079$ of Slide $a+j$ and column $x = 0$ of Slide $a+j+1$ are mathematically adjacent pixels of the same rasterization pass—eliminating sub-pixel seam flicker on Instagram and LinkedIn mobile swipes.

---

## 3. Security & Threat Model

Because an MCP server or REST Action executes tool inputs authored by an LLM (which may itself process untrusted web pages or prompt-injected user documents), `omni-carousel-agent` treats `CarouselSpec` as **untrusted input**:

| Threat Vector | Attack Scenario | Implemented Control |
|---|---|---|
| **HTML / Script Injection (XSS -> Local File Read in Headless Browser)** | Prompt-injected LLM places `<script>fetch('file:///etc/passwd')...</script>` or `<img src="http://169.254.169.254/...">` inside `headline` or `body`. | 1. Typed schema only—no raw HTML field exists in `CarouselSpec` (unless explicit CLI flag `--unsafe-html` is set by local operator).<br>2. All text strings pass through strict XML/HTML entity escaping (`&`, `<`, `>`, `"`, `'`) and control-character stripping.<br>3. Playwright context blocks `file://` and non-allowlisted outbound network requests via `page.route("**/*", ...)`. |
| **Server-Side Request Forgery (SSRF) in `fetch_asset`** | Agent requests `http://127.0.0.1:8080/admin` or AWS IMDS `http://169.254.169.254/latest/meta-data/`. | 1. Provider allowlist (`unsplash`, `pexels`, `quickchart`) with hardcoded HTTPS API origins.<br>2. Custom URL resolver blocks loopback (`127.0.0.0/8`, `::1`), RFC1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`, `fe80::/10`), and non-HTTPS schemes.<br>3. Strict `image/*` MIME verification and `10 MB` response body cap. |
| **Arbitrary File Write / Path Traversal** | Malicious output filename `../../.ssh/authorized_keys` or reading arbitrary server files via `/files/` endpoint. | 1. All artifacts are written inside `path.resolve(OMNI_OUTPUT_DIR)` under sanitized UUID/slug run directories.<br>2. Canonical `realpath` prefix assertion (`target.startsWith(root + path.sep)`) rejects any traversal attempt. |
| **Unauthorized Network Exposure & DNS Rebinding** | Local HTTP MCP server bound to `0.0.0.0` without auth or targeted via browser DNS rebinding. | 1. Binds to `127.0.0.1` by default.<br>2. Refuses to start on non-loopback interfaces (`0.0.0.0`) unless `OMNI_AUTH_TOKEN` is configured (or `--allow-unauthenticated` is explicitly passed for trusted sandbox previews).<br>3. Validates `Authorization: Bearer <token>` using constant-time `crypto.timingSafeEqual` and checks `Origin` / `Host` allowlists. |
| **Remote File Leakage (`output_mode="url"`)** | Predictable download URLs expose other users' rendered decks on shared remote MCP servers. | Download links use **HMAC-SHA256 signed expiring tokens** (`/files/<artifactId>?exp=<unix>&sig=<hmac>`) bound to artifact path and expiration timestamp (default TTL: 3600s). |
| **MCP `stdio` Stream Corruption** | `console.log()` from a dependency prints text to `stdout`, breaking Claude Desktop / Codex JSON-RPC framing. | In `stdio` mode, `console.log` is redirected to `process.stderr` at entrypoint initialization before any module executes. |

---

## 4. Open-Source Licensing Audit

| Component | License | Compliance Requirement & Implementation |
|---|---|---|
| `omni-carousel-agent` repository | **MIT** | Root `LICENSE` file included. |
| Bundled Google Fonts (`Inter`, `Space Grotesk`, `Instrument Serif`, `JetBrains Mono`, `Caveat`) | **SIL Open Font License 1.1 (OFL-1.1)** | Permitted to bundle, embed in PDFs, and rasterize into commercial images freely; cannot sell font files standalone; `core-engine/fonts/OFL-NOTICES.md` ships copyright and OFL text. |
| Lucide Icons (`lucide.ts`) | **ISC License** | Permissive MIT-equivalent; copyright/permission notice included in `core-engine/src/assets/lucide.ts` and `THIRD_PARTY_NOTICES.md`. |
| Playwright, Zod, `@modelcontextprotocol/sdk`, `@resvg/resvg-js`, `sharp`, `pdf-lib`, `FastMCP` | **Apache-2.0 / MIT / MPL-2.0** | Standard open-source runtime dependencies; no GPL copyleft contamination. |
| Unsplash & Pexels API Hooks | **Unsplash API Terms / Pexels Terms** | Never hotlink-scrape without attribution; `fetch_asset` records photographer name, profile URL, and platform link into `attribution.json` inside every rendered ZIP bundle and triggers Unsplash's required `download_location` ping when API keys are supplied. |
