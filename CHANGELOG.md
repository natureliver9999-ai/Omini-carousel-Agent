# Changelog

All notable changes to `omni-carousel-agent` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-19

### Added
- **Phase 1 Deep Research Corpus (`docs/research/`)**: Empirical synthesis of 2025–Q3 2026 Instagram & LinkedIn carousel benchmarks, cognitive swipe psychology, 14-host MCP/REST/Skill compatibility audit, and deterministic threat modeling.
- **Canonical Spec & Themes (`spec/`)**: Zod-authored `carousel.schema.json`, four WCAG AA-verified themes (`editorial`, `brutal-bento`, `scrapbook`, `linkedin-executive`), and platform playbooks (`instagram.md`, `linkedin.md`, `hooks.md`, `patterns.md`).
- **Core Engine (`core-engine/`)**:
  - 11 deterministic typed layouts (`cover_hook`, `contrast_split`, `layer_stack`, `bento_grid`, `reveal_hold`, `scrapbook`, `data_chart`, `steps`, `proof`, `summary`, `cta`).
  - Dual-backend renderer: Playwright HTML/CSS/GSAP/SVG + Zero-Browser Native Rust `@resvg/resvg-js` + `sharp` + `pdf-lib` with bundled OFL fonts.
  - Pixel-exact wide-canvas panorama slicer (`1080 * N x 1350` -> `1080x1350` slides).
  - Multi-page `1080x1350` LinkedIn PDF exporter and attribution-aware ZIP bundler.
  - Comprehensive spec linter (slide count, retention backbone, copy word caps, banned clichés, layout alternation, WCAG AA contrast, seam safety, alt text).
  - SSRF-guarded optional Unsplash/Pexels hooks and offline theme-colored chart & diagram generators.
- **MCP & REST Access Layer (`mcp-server/`)**:
  - TypeScript MCP server (`stdio` + `Streamable HTTP` `/mcp`).
  - Python FastMCP wrapper delegating to the shared `omni-carousel` CLI.
  - REST + OpenAPI 3.1.0 facade (`/v1/*` + `/openapi.yaml`) + Interactive Web Studio preview.
- **Cross-Agent Skill & Connectors (`skills/`, `connectors/`)**:
  - `carousel-architect` skill package (`SKILL.md`, `references/`, `assets/`).
  - Merge-safe one-click installer (`omni-carousel-mcp setup`) + ready-made configs for Claude Desktop, Claude Code, ChatGPT, Google Antigravity, OpenCode, OpenAI Codex CLI, VS Code, Cursor, Windsurf, and LibreChat.
- **SDKs (`sdks/python-sdk`, `sdks/node-sdk`)**: Native tool definitions and local/remote runners for Anthropic SDK, OpenAI Responses/Chat SDKs, and Vercel AI SDK v5+.
- **Examples & CI (`examples/`, `.github/workflows/`)**: Full specs and rendered outputs across patterns plus automated test & conformance workflows.
- **Tests (112)**: engine lint/schema/panorama/golden (38), MCP contract + signed-URL tamper/expiry + path traversal (26), Node SDK tool dialects (8), Python models/tools/runner (32), FastMCP conformance (8).
- **CI**: `ci.yml` (build, typecheck, schema reproducibility, TS + Python matrices, cross-language parity), `golden.yml` (deterministic hashes on Linux/macOS + font licensing), `mcp-conformance.yml` (stdio handshake, HTTP signed artifacts, traversal), `connectors.yml` (13 configs, installer matrix on three OSes), `release.yml` (npm + PyPI + GitHub release assets).
- **Parity tooling**: `scripts/check-parity.mjs` (layouts/tools/copy budgets/themes across Zod, JSON Schema, TypeScript and Pydantic), `scripts/validate-connectors.mjs`, `scripts/smoke-connectors.mjs` (merge safety, idempotency, uninstall).

### Fixed
- `contrast_split`: a `verdict` label was drawn at a fixed y and collided with the card border on tall headlines. The panel now reserves the verdict's height and the label is positioned from the panel's measured bottom.
- `bento_grid`: hero values (`Pixels`, `Source`) overflowed their tile at large row heights. Values are measured and scaled down to fit the tile's inner width.
- Python runner: `layouts`/`themes` returned bare arrays from the CLI, so `handle_tool_call` saw `None` data; both now normalise to the `{layouts|themes: [...]}` shape the MCP tools return.
- `reveal_hold`: the "hold that thought" hint was drawn at a fixed y and printed over the body copy; the teaser card's label ran past the canvas instead of truncating; `footer_hook` was rendered twice (once by the layout, once by the scene footer). The body now fits by shrinking, the hint is anchored under the body, the card label wraps to two lines within the visible area, and footers are drawn once.
- Footer: `footer_hook` cleared the page counter by only 18px on long hooks; clearance is now 150px and hooks truncate at 42% of the content width.
- Golden coverage extended to `contrast_split`, `bento_grid` and `reveal_hold` so all three regressions fail CI if reintroduced.
