# Omni Carousel Agent — Deep Research Executive Synthesis (November 2026)

**Status:** Verified Production Research Corpus (v0.1.0)  
**Date:** 19 November 2026  
**Scope:** Empirical 2025–2026 carousel engagement benchmarks, cognitive & visual design systems for swipe retention, multi-agent MCP/REST/Skill interoperability, deterministic dual-backend rendering, and zero-trust tool security.

---

## 1. Why `omni-carousel-agent` Exists

Across 2025 and Q1–Q3 2026 organic social studies covering more than **120 million posts**, swipeable carousels (Instagram multi-slide posts and LinkedIn native PDF document posts) are the **highest-engaging organic content format per impression and per follower** on both Instagram and LinkedIn:

- **Instagram (Socialinsider, Q3 2026, 67.5M posts / 579K brand accounts):** Carousels lead all formats at **0.50% engagement by followers** (and **0.55%** across full-year 2025), outperforming Reels (**0.48%**) and static single images (**0.35%**), even as platform-wide engagement contracted ~24% YoY.
- **LinkedIn (Socialinsider, March 2026, 2.45M posts; Buffer, March 2026, 52M+ posts):** Native PDF document carousels rank #1 at **7.00% engagement by impressions** (+14% YoY, vs **5.20%** platform average and **4.50%** plain text) and **21.77% median engagement by reach** in Buffer's cross-platform cohort.

Yet most AI-generated carousels fail in production for four structural reasons:
1. **Unconstrained image-model text:** Diffusion/autoregressive image generators misspell typography, hallucinate statistics, and drift visually between slides 1 and 10.
2. **Untrusted raw HTML generation:** Asking an LLM to write free-form HTML/CSS per slide produces inconsistent margins, clipped copy, broken WCAG contrast, misaligned panorama seams, and XSS/SSRF attack surfaces inside headless browsers.
3. **Host lock-in:** A workflow built only as a Claude skill fails in ChatGPT; a workflow built only as a Custom GPT Action fails in Claude Code, Cursor, OpenCode, Codex CLI, and Google Antigravity.
4. **Fabricated proof:** Marketing prompts routinely invent fake percentages, customer quotes, and unattributed benchmarks that destroy brand trust.

`omni-carousel-agent` solves all four problems through **strict separation of intelligence and deterministic execution**:
- **The Host LLM thinks:** Any agent (Claude Desktop, Claude Code, ChatGPT, Google Antigravity, OpenCode, Codex CLI, VS Code Copilot, Cursor, Windsurf, or custom Python/Node apps) plans the narrative, copy, and slide sequence guided by the `carousel-architect` playbook/skill.
- **The Core Engine validates & renders deterministically:** One canonical **Zod -> JSON Schema -> Pydantic / OpenAPI 3.1** contract (`CarouselSpec`) feeds a deterministic linter and layout engine that outputs pixel-accurate `1080x1350` PNG slides, seamless wide-canvas sliced panoramas, `1080x1350` multi-page LinkedIn PDFs, and complete attribution-tracked ZIP bundles.

---

## 2. Summary of Verified Additions & Corrections to Draft Blueprint

During Phase 1 verification (November 2026), every item marked *"verify at install"* in `docs/blueprint.md` was audited against current specifications and empirical studies:

| Topic | Draft Blueprint Assumption | Verified November 2026 Reality | Architectural Action Taken |
|---|---|---|---|
| **Instagram Engagement Benchmarks** | Cited 0.55% IG carousel engagement vs 0.52% Reels, 0.37% static | Confirmed for full-year 2025 (Socialinsider, 67.5M posts). In Q2–Q3 2026, quarterly rates tightened slightly to **0.50% Carousels vs 0.48% Reels vs 0.35% Images**, with Carousels retaining the #1 lead and leading reach rate (4.50% vs 4.10% Reels overall; Reels still lead discovery reach on <50K accounts). | Documented full metric definitions (`(likes+comments)/followers` vs `engagements/reach` vs `impressions`) in `01-carousel-engagement-benchmarks-2026.md` and exposed pacing rules as configurable linter options. |
| **LinkedIn PDF Benchmarks** | Recommended 5–10 pages, 4:5 at 1080x1350, no links in PDF | Confirmed empirically: Socialinsider (Mar 2026) reports **7.00% impression engagement** (#1 format, up from 6.10%); Buffer (Mar 2026) reports **21.77% reach median**. External links inside slides depress organic feed dwell signals and fail mobile tap UX. | Linter enforces URL-in-slide warnings on LinkedIn specs and exports clean 1080x1350 multi-page PDFs via `pdf-lib`. |
| **Anthropic Messages API Remote MCP** | Placeholder `betas=["<current MCP client beta>"]` | Current beta header is **`mcp-client-2025-11-20`** (`mcp-client-2025-04-04` is deprecated). Crucially, each entry in `mcp_servers` **must** also have a matching `{ "type": "mcp_toolset", "mcp_server_name": "<name>" }` entry in `tools`, or the API rejects the request. | Implemented exact `mcp-client-2025-11-20` + `mcp_toolset` helpers in both `sdks/python-sdk` and `sdks/node-sdk`, plus `connectors/generic/`. |
| **OpenAI Responses API Remote MCP** | `tools: [{type: "mcp", server_url, server_label}]` | Confirmed. Supports `headers: {"Authorization": "Bearer ..."}` and `require_approval: "never" \| "always"`. | Shipped helpers in `omni_carousel.tools_openai` and `sdks/node-sdk/src/openai.ts`. |
| **MCP TypeScript SDK** | `@modelcontextprotocol/sdk` stdio + Streamable HTTP | Confirmed `@modelcontextprotocol/sdk` v1.x (`McpServer`, `StdioServerTransport`, `StreamableHTTPServerTransport` implementing MCP `2025-11-25`). Legacy HTTP+SSE deprecated since `2025-03-26`. | Built `mcp-server/typescript` with `McpServer.registerTool`, `registerResource`, `registerPrompt`, supporting both stdio and stateful/stateless Streamable HTTP (`/mcp`). |
| **Python FastMCP** | `from fastmcp import FastMCP` | Two ecosystems exist in 2026: standalone `fastmcp` (`transport="http"`, `path="/mcp"`) and `mcp.server.fastmcp` (`transport="streamable-http"`). | Built `mcp-server/python` supporting standalone `fastmcp` cleanly with CLI subprocess delegation to `omni-carousel` so zero schema/render drift can occur. |
| **Google Antigravity Config** | `~/.gemini/config/mcp_config.json` or `.agents/mcp_config.json`; `serverUrl` | Confirmed: Antigravity **strictly requires `serverUrl`** for remote MCP (rejects `url` and `httpUrl`) and several 2026 builds ignore project-level MCP files in favor of global `~/.gemini/config/mcp_config.json` (or `~/.gemini/antigravity/mcp_config.json`). | Merge-safe installer writes global `~/.gemini/config/mcp_config.json` in user scope AND `.agents/` + `.agent` symlink in project scope, using `serverUrl` for remote entries. |
| **OpenCode & Codex CLI** | `opencode.json` (`mcp` key) & `~/.codex/config.toml` (`[mcp_servers.NAME]`) | Confirmed: OpenCode uses `"type": "local"` with `"command": ["npx", ...]` array and `{env:VAR}` interpolation; Codex CLI uses `env_vars = [...]` and `bearer_token_env_var = "OMNI_TOKEN"`, and reads `.agents/skills` + `AGENTS.md`. | Shipped validated configs, root `AGENTS.md` + `CLAUDE.md`, and full support in `omni-carousel-mcp setup`. |
| **Vercel AI SDK v5+** | Mentioned `inputSchema` | Confirmed: Vercel AI SDK v5+ replaced `parameters` with `inputSchema` (Zod) and optional `outputSchema` inside `tool({ description, inputSchema, execute })`. | Implemented `vercelTools()` in `sdks/node-sdk/src/vercel.ts` using native `inputSchema` Zod objects. |
| **Serverless / Airgapped Rendering** | Playwright Chromium only | Playwright requires a ~400 MB Chromium binary download, which fails in restricted containers, serverless functions, or airgapped CI. | Engineered a **dual-backend deterministic renderer**: Playwright HTML/Tailwind/GSAP/SVG when Chromium is available, plus a **zero-browser native Rust `@resvg/resvg-js` + `sharp` + `pdf-lib` engine** using bundled OFL `.ttf` fonts that produces pixel-exact 1080x1350 PNGs, sliced panoramas, and multi-page PDFs anywhere in ~40ms/slide! |

---

## 3. Research Corpus Index

| Document | Focus |
|---|---|
| [`01-carousel-engagement-benchmarks-2026.md`](./01-carousel-engagement-benchmarks-2026.md) | Empirical data synthesis across Socialinsider, Buffer, Metricool, Rival IQ, and Ordinal; Instagram vs LinkedIn format mechanics; slide-count curves; resurfacing algorithm behavior; A/B testing protocol. |
| [`02-viral-patterns-and-visual-psychology.md`](./02-viral-patterns-and-visual-psychology.md) | Cognitive psychology (Zeigarnik effect, dual-coding, visual momentum), full mathematical & layout specification of the 6 viral patterns and 11 slide templates, WCAG 2.1 contrast math, and 1080x1350 safe-area typography grid. |
| [`03-agent-ecosystem-and-mcp-compatibility-2026.md`](./03-agent-ecosystem-and-mcp-compatibility-2026.md) | Deep dive into MCP `2025-11-25`, Streamable HTTP vs stdio, 12+ AI host configurations, Anthropic/OpenAI native MCP APIs, Custom GPT OpenAPI 3.1 Actions, cross-agent `SKILL.md` discovery, and merge-safe installer design. |
| [`04-deterministic-rendering-and-security-threat-model.md`](./04-deterministic-rendering-and-security-threat-model.md) | Dual-backend rendering pipeline (Playwright + Resvg/Sharp/PDF-Lib), wide-canvas panorama seam geometry, threat modeling (XSS, SSRF, path traversal, DNS rebinding, stdio pollution), signed URL cryptography, and open-source font/asset licensing. |
