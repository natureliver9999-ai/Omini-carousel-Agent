# omni-carousel-agent: High-Level Blueprint

Version 0.1 draft, 19 November 2026

A free, open-source, agent-agnostic AI carousel generator. It produces Instagram PNG slides (1080x1350) and LinkedIn multi-page PDFs, and plugs into every agent that accepts MCP servers, skills, or tool schemas.

Status of claims: platform statistics come from vendor and agency blogs and are directional. Connector formats marked "checked" were verified against public docs in November 2026. Everything else is marked "verify at install".

---

## 1. Product in one page

The repository does not contain an LLM. The host agent (Claude, ChatGPT, Antigravity, OpenCode and others) does the thinking. This repo supplies a playbook the agent can read and deterministic tools the agent can call: validate, render, fetch assets.

Design principles:

- **Agent-agnostic.** The same capabilities are reachable through a skill file, MCP over stdio, MCP over Streamable HTTP, a REST/OpenAPI facade, and SDK tool schemas.
- **One contract.** A JSON Carousel Spec is the only interface between agent and renderer. Every transport validates against the same schema.
- **Deterministic rendering.** Typed layout templates, bundled fonts, pinned dependencies, golden-image tests. The agent never injects raw HTML by default.
- **Local first, remote capable.** stdio is the default. HTTP and REST exist because some hosts (ChatGPT) cannot launch local processes.
- **Honest content.** The skill forbids invented statistics, quotes and testimonials.
- **Free and portable.** Playwright, Tailwind, GSAP, SVG, Google Fonts (OFL), Lucide (ISC). Unsplash, Pexels and QuickChart are optional free-tier hooks that degrade gracefully without keys.

---

## 2. Phase 1: research synthesis (2026)

### What the sources agree on

| Finding | Detail | Confidence |
|---|---|---|
| Carousels lead Instagram engagement | Reported 0.55% average engagement vs 0.52% Reels and 0.37% static (Socialinsider, April 2026, as cited by CreatorFlow). Saves are the strongest ranking signal in most 2026 guides. | Medium, vendor-reported |
| Slide count | 7-10 slides is the repeated sweet spot; under 4 barely beats a single image. Instagram allows up to 20. | Medium |
| Instagram resurfaces carousels | Unseen slides can be shown again to users who scrolled past. | Low-medium |
| LinkedIn format | A carousel is a document post: one multi-page PDF. 5-10 pages perform best; 4:5 at 1080x1350 recommended; put links in the caption, never inside the PDF. | Medium |
| Seamless carousels | One canvas of 1080 x N px is sliced into slides. A continuous element (line, road, horizon, gradient) crosses every seam. A 3-slide panorama beats the same image stretched over 7. | Medium |
| Visual direction | Bento grids work best at 6-9 tiles. Hand-drawn, scribbled, imperfect elements are rising as a reaction to polished AI visuals. | Medium |

Caveat: most figures come from marketing blogs with unstated methodology. The engine should expose them as editable defaults, and the skill should recommend A/B testing.

### Top 6 viral carousel patterns

| # | Pattern | Mechanic | Engine and design rule |
|---|---|---|---|
| 1 | Seamless panorama / follow-the-line | One wide canvas sliced across slides; a line, path or gradient crosses every seam. | Render one canvas 1080 x N and clip per slide. No text across a seam. Objects crossing a seam show at least 25% on each side. 3-5 slides per panorama. |
| 2 | Contrast / before-vs-after | Paired slides or a split frame that flips one variable: wrong vs right, old vs new, expectation vs reality. | Identical grid on both slides; only content and palette change. The linter treats the pair as one layout unit. |
| 3 | Layer-by-layer transformation | Same base artwork on consecutive slides; one layer is added per swipe. | Layered SVG with a visible-layer count per slide; same camera on every slide. The name is a synthesis of documented step-by-step formats. |
| 4 | Hold-and-scroll reveal | Slide N sets a tension; the answer is on slide N+1. An element is cropped at the right edge to cue the swipe. | Layout `reveal_hold` bleeds one element 8-15% off the right edge. The payoff slide must resolve the exact claim made before. The name is a synthesis. |
| 5 | Bento-grid data cards | 6-9 tiles of varied size, each holding one stat, claim or tip. | CSS `grid-template-areas` presets for 6, 7, 8, 9 tiles. One idea per tile, max 8 words. Charts via QuickChart in theme colors. |
| 6 | Anti-aesthetic / editorial scrapbook | Tape, torn paper, scribble underlines, slightly rotated cards, halftone and grain. Signals human-made. | Rotation limited to +/-1 to 3 degrees with a deterministic seed. Hand-drawn SVG accents. Best for opinion and story posts. |

### Retention backbone (applies to every pattern)

1. **Slide 1, hook.** One bold promise or tension. Visual contrast first, text second.
2. **Slides 2-8, body.** One idea per slide. Every slide carries a footer micro-hook (max 7 words) teasing the next slide.
3. **Slide 9, summary card.** A save-worthy recap, readable without the earlier slides.
4. **Slide 10, CTA.** One action only: save, comment a keyword, follow, or link in caption.

### Global visual rules

| Rule | Default |
|---|---|
| Canvas | 1080x1350 px (4:5). PNG for Instagram; PDF with 1080x1350 px pages for LinkedIn |
| Safe area | 72 px side margins; reserve the bottom 110 px for the footer micro-hook and progress marker |
| Type scale | Headline 84-120 px, body 40 px or larger, footer 28 px; maximum two typefaces |
| Contrast | WCAG AA minimum (4.5:1 body, 3:1 large text), computed from theme tokens |
| Alternation | No two adjacent slides share a layout unless they are a contrast pair or panorama span; alternate sparse and dense; at most 3 text-only slides in a row |
| Imagery | One focal subject per image; never bake text into generated images; every slide ships alt text |
| Motion | GSAP only seeks a timeline to a fixed progress before screenshot, so output is deterministic |

### Platform differences

| | Instagram | LinkedIn |
|---|---|---|
| Container | Up to 20 images in one post | One document post (PDF; PPTX/DOC also accepted) |
| Export | PNG per slide | Single multi-page PDF, same 1080x1350 pages |
| Slide count | 7-10 | 5-10 |
| Links | Not clickable in captions | Link in caption, never inside the PDF |
| Panorama | Native fit | Works as pages; verify page-edge rendering first |
| Tone | Visual-first, short copy | Argument-first, evidence-led, slightly longer body copy |

---

## 3. Architecture

```
AI HOSTS (the LLM lives here, not in this repo)
  Claude Desktop/Code | ChatGPT | Antigravity | OpenCode/Codex/VS Code | Cursor/Zed/Cline | Your app (SDK)
            |
ACCESS LAYER
  Skill (carousel-architect) | MCP stdio | MCP Streamable HTTP | REST + OpenAPI 3.1 | SDK tool schemas
            |
CORE ENGINE (TypeScript, Playwright): one implementation, one JSON contract
  Carousel Spec + linter | Layout templates (HTML, Tailwind, GSAP/SVG) | Renderer (PNG, PDF, ZIP) | Asset hooks
```

### Key decisions

| Decision | Choice | Why |
|---|---|---|
| Engine language | TypeScript on Node | Playwright is first-class there. The Python package calls the same engine through a CLI subprocess, so the two servers cannot drift. |
| Contract | Zod schema is the source; JSON Schema exported; Pydantic models generated | Both MCP servers, the OpenAPI file and the SDK tool definitions come from one schema. |
| Templates | Typed layout components; no raw HTML from the agent | Safer, because Playwright would otherwise render untrusted input, and visually consistent. |
| Panorama | Render one wide canvas, clip per slide | Guarantees seam alignment. |
| Remote delivery | `output_mode = path / url / inline` | Remote hosts cannot read the server's disk. `url` returns short-lived signed links; `inline` returns base64 for small previews. |
| Tool surface | Few coarse tools | Agents pick tools more reliably from a short list. |

---

## 4. Monorepo layout

```
omni-carousel-agent/
|-- README.md  LICENSE (MIT)  CHANGELOG.md  CONTRIBUTING.md
|-- package.json  pnpm-workspace.yaml  pyproject.toml  Makefile
|-- spec/
|   |-- carousel.schema.json        # exported from Zod; single source of truth
|   |-- themes/                     # editorial.json, brutal-bento.json, scrapbook.json
|   `-- playbook/                   # instagram.md, linkedin.md, hooks.md, patterns.md
|-- core-engine/                    # TypeScript
|   |-- src/
|   |   |-- schema.ts  lint.ts  render.ts  panorama.ts  pdf.ts  bundle.ts
|   |   |-- layouts/                # cover_hook, contrast_split, layer_stack, bento_grid,
|   |   |                           # reveal_hold, scrapbook, data_chart, steps, proof,
|   |   |                           # summary, cta
|   |   |-- assets/                 # fonts.ts, lucide.ts, unsplash.ts, pexels.ts,
|   |   |                           # quickchart.ts, mermaid.ts
|   |   `-- cli.ts                  # omni-carousel render | validate | setup
|   |-- fonts/                      # bundled OFL fonts for deterministic output
|   `-- test/                       # lint tests + golden-image tests
|-- mcp-server/
|   |-- typescript/                 # @modelcontextprotocol/sdk; stdio + Streamable HTTP
|   |-- python/                     # FastMCP; stdio + HTTP; calls engine CLI
|   `-- rest-facade/                # serves openapi.json for Custom GPT Actions
|-- skills/
|   `-- carousel-architect/
|       |-- SKILL.md
|       |-- references/             # hooks.md, layouts.md, platform-specs.md
|       `-- assets/                 # starter specs, caption templates
|-- sdks/
|   |-- python-sdk/                 # pip install omni-carousel
|   |   `-- omni_carousel/          # tools_anthropic.py, tools_openai.py, runner.py, cli.py
|   `-- node-sdk/                   # npm install omni-carousel
|       `-- src/                    # anthropic.ts, openai.ts, vercel.ts, runner.ts
|-- connectors/
|   |-- claude-desktop/             # claude_desktop_config.json, install.sh, install.ps1
|   |-- claude-code/                # .claude-plugin/plugin.json, .mcp.json, skills/
|   |-- chatgpt/                    # openapi.yaml (3.1), tunnel.sh, GPT-instructions.md
|   |-- antigravity/                # mcp_config.json, .agents/skills/ (+ .agent symlink)
|   |-- opencode/                   # opencode.json
|   |-- codex/  vscode/  generic/   # config.toml, .vscode/mcp.json, mcpServers.json
|   `-- setup/                      # merge-safe installer used by all of the above
|-- examples/                       # specs + rendered outputs for each pattern
`-- .github/workflows/              # lint, golden tests, MCP conformance, publish
```

---

## 5. The Carousel Spec and tool surface

```json
{
  "meta": { "platform": "instagram", "goal": "saves", "topic": "...", "locale": "en",
            "theme": "editorial", "handle": "@name", "pattern": "contrast" },
  "slides": [
    { "id": 1, "layout": "cover_hook", "headline": "...", "sub": "...",
      "footer_hook": "Slide 2: the mistake", "alt": "..." },
    { "id": 2, "layout": "contrast_split", "pair": "A", "left": {}, "right": {},
      "footer_hook": "..." },
    { "id": 3, "layout": "bento_grid", "tiles": [ { "span": "2x1", "text": "..." } ] },
    { "id": 9, "layout": "summary", "bullets": ["..."] },
    { "id": 10, "layout": "cta", "action": "save", "text": "..." }
  ],
  "panorama": { "from": 4, "to": 6, "asset": "asset://road-01" },
  "assets": { "road-01": { "source": "unsplash", "query": "empty road dusk" } },
  "caption": "...", "hashtags": ["..."]
}
```

| Tool | Purpose | Notes |
|---|---|---|
| `get_playbook(platform, goal)` | Returns patterns, hook formulas, pacing rules | Lets hosts without skill support (ChatGPT) load the same knowledge |
| `list_layouts` / `list_themes` | Valid layout ids and theme tokens | Prevents invalid specs |
| `validate_spec(spec)` | Lint: slide count, alternation, copy limits, contrast, seam safety, missing alt text | Returns errors and warnings with slide ids and suggested fixes |
| `render_carousel(spec, formats, output_mode)` | PNG per slide, PDF, ZIP with caption and alt text | Refuses to render when lint has errors |
| `preview_slide(spec, index)` | Single-slide PNG | Cheaper than a full render |
| `fetch_asset(provider, query)` | License-aware image fetch with cache and attribution record | Keys optional; SSRF-guarded |
| `make_chart` / `make_diagram` | QuickChart or Mermaid in theme colors | Offline fallback uses local Mermaid |

Resources: `carousel://playbook`, `carousel://schema.json`, `carousel://themes/{id}`. Prompt: `create_carousel(topic, platform, goal)`.

---

## 6. Skill: carousel-architect (outline)

`SKILL.md` uses the cross-agent Agent Skills layout: YAML frontmatter with a trigger-rich description (carousel, LinkedIn document post, Instagram swipe post, social slide deck), then workflow instructions, with longer material in `references/`.

### Workflow the skill enforces

1. **Intake.** Ask only what is missing: platform, goal, audience, topic, proof assets.
2. **Pick a pattern.** Do not mix more than two patterns in one deck.
3. **Plan** 8-10 slides using the retention backbone; write the spec, not prose.
4. **`validate_spec`.** Fix every error, review warnings.
5. **`render_carousel`.** Inspect previews for seams, overflow and contrast.
6. **Deliver** files, caption, alt text, and one A/B hook variant.

### Pattern selection

| Goal | Lead pattern | Supporting pattern |
|---|---|---|
| Saves | Bento-grid summary | Layer-by-layer transformation |
| Shares | Contrast / before-vs-after | Hold-and-scroll reveal |
| Authority / follows | Editorial scrapbook | Listicle backbone |
| Dwell time and story | Seamless panorama | Hold-and-scroll reveal |
| B2B leads (LinkedIn) | Contrast plus bento data card | CTA with comment keyword |

### Copywriting limits (the linter also checks these)

| Element | Limit |
|---|---|
| Hook headline | 12 words or fewer. Formulas: contrarian claim, number plus outcome plus timeframe, before/after tension, mistake callout, open question |
| Body slide | One idea; 25 words target, 40 maximum |
| Footer micro-hook | 7 words or fewer; must tease the next slide's actual content |
| Summary card | 6 bullets or fewer, 8 words each |
| CTA | Exactly one action |
| Numbers and quotes | Only user-supplied or cited. Never invent statistics, testimonials or names |
| Voice | Plain, specific, grade 7-8 reading level; ban openers like "In today's fast-paced world" |

### Layout and visual generation rules

- Never repeat a layout on adjacent slides, except contrast pairs and panorama spans.
- Alternate sparse and dense slides; at least one non-text visual in every two slides; no more than three text-only slides in a row.
- Panorama spans share one background asset and never place text on a seam.
- Use theme tokens only (colors, radii, type scale), never free-form hex values.
- Generate charts and diagrams with `make_chart` / `make_diagram` in theme colors.
- Do not reproduce copyrighted characters, brand logos or real people's likenesses unless the user supplies licensed assets.
- Final QA: seams aligned, no text under 36 px, contrast passes, every slide has alt text, footer hooks present, one CTA.

---

## 7. Connector compatibility matrix

Two facts shape the design: ChatGPT connects to remote HTTPS servers only (no stdio), and Antigravity uses `.agents/` (plural) for project config.

| Agent | Transport | Config location and key | Status |
|---|---|---|---|
| Claude Desktop | stdio (config file); remote via Settings, custom connector | `claude_desktop_config.json`, `mcpServers.{name}.command/args/env` | Standard format; verify path per OS |
| Claude Code | stdio or http | `claude mcp add --transport http NAME URL`; project `.mcp.json`; or plugin with `.claude-plugin/plugin.json`, `skills/`, `.mcp.json` | Checked |
| Claude.ai custom connector | Streamable HTTP | Settings, Connectors, add custom connector with HTTPS URL | Plan and org policy apply; verify |
| ChatGPT (developer mode) | Streamable HTTP or SSE, HTTPS only | Settings, Apps and Connectors, Advanced, Developer mode, Create; paste URL; auth none, key or OAuth | Checked; paid plans, web; toggle location has moved in 2026 |
| ChatGPT Custom GPT Actions | REST | OpenAPI 3.1 schema pasted in GPT builder | Needs the REST facade |
| OpenAI Responses API | Remote MCP tool | `tools: [{type: "mcp", server_url, server_label}]` | Verify against current API docs |
| Anthropic Messages API | Remote MCP (url) | `mcp_servers: [{type: "url", url, name}]` | Verify beta header against current docs |
| Google Antigravity IDE and CLI | stdio or remote | `~/.gemini/config/mcp_config.json` or `.agents/mcp_config.json`; remote key is `serverUrl`; skills in `.agents/skills/` or `~/.gemini/config/skills/` | Checked; no top-level timeout, no JSON comments; env passing reported unreliable |
| OpenCode | local or remote | `opencode.json` (project or `~/.config/opencode/`): `mcp.{name}` with `type` local or remote | Checked |
| OpenAI Codex CLI | stdio or url | `~/.codex/config.toml`, `[mcp_servers.NAME]` | Checked |
| VS Code / Copilot | stdio or http | `.vscode/mcp.json` with a `servers` object | Checked |
| Cursor, Windsurf, Zed, Cline, LibreChat | stdio or Streamable HTTP | Generic `mcpServers` JSON (LibreChat uses YAML with `type: streamable-http`) | Verify path at install |

### One-click setup behaviour

```
npx omni-carousel-mcp setup --client claude-desktop|claude-code|antigravity|opencode|codex|vscode|all [--scope user|project] [--dry-run] [--uninstall]
```

- Detects the OS-specific config path, writes a timestamped backup, and merges into the existing `mcpServers` object. It never overwrites other servers.
- Idempotent: running twice leaves one entry. `--uninstall` removes only the omni-carousel entry.
- For Antigravity it writes `.agents/skills/` and a `.agent` symlink; keep whichever your build reads.
- For ChatGPT it cannot configure the app. It starts the HTTP server, opens a tunnel (cloudflared or ngrok), prints the URL and the UI steps, and emits the OpenAPI file for GPT Actions.

---

## 8. SDKs

| Package | Contents | Frameworks |
|---|---|---|
| `pip install omni-carousel` | `anthropic_tools()` and `openai_tools()` return native tool definitions generated from the schema; `handle_tool_call(name, args)` runs the engine locally; `omni-carousel` CLI (render, validate, setup) | `anthropic` SDK (tools / `input_schema`), `openai` SDK (Responses API function tools) |
| `npm install omni-carousel` | `anthropicTools`, `openaiTools`, `vercelTools` plus runner; same CLI | `@anthropic-ai/sdk`, `openai`, Vercel AI SDK (v5+ uses `inputSchema`) |

Both SDKs also expose `mcp_server_config()` so an app can attach the remote MCP server instead of running tools in-process. Check that the name `omni-carousel` is free on PyPI and npm before publishing.

---

## 9. Security, licensing, quality

| Area | Control |
|---|---|
| Rendering untrusted input | Escape all text; no raw HTML or script from specs unless `--unsafe-html`; Playwright runs with a network allowlist |
| HTTP transport | Bind 127.0.0.1 by default; bearer token required when bound elsewhere; Host and Origin validation; HTTPS via tunnel or reverse proxy |
| File access | Outputs confined to `OMNI_OUTPUT_DIR`; path-traversal guard; signed, expiring URLs for `output_mode=url` |
| Asset fetch | SSRF guard (block private ranges), size and type limits, attribution stored in the bundle |
| stdio hygiene | Never write logs to stdout in stdio mode; use stderr |
| Licences | Repo MIT or Apache-2.0. Google Fonts (OFL) and Lucide (ISC) bundled with notices. Unsplash and Pexels used through their APIs with attribution rules respected |
| Dependencies | Pin exact versions; choose releases at least two weeks old; commit lockfiles |
| Tests | Schema and lint unit tests; golden-image diffs per layout and theme; MCP Inspector smoke tests; CI job that starts each connector config against the server |

---

## 10. Build plan

| Phase | Deliverable | Exit criterion |
|---|---|---|
| 0. Contract | Zod schema, JSON Schema export, 3 themes, playbook markdown | Hand-written spec validates |
| 1. Engine | 11 layouts, PNG/PDF/ZIP, panorama slicing, linter | Golden tests pass; panorama seams are pixel-exact |
| 2. MCP | TypeScript stdio server, then Python FastMCP wrapper | Both pass the same Inspector script |
| 3. Remote | Streamable HTTP, auth, signed URLs, REST facade, OpenAPI 3.1 | ChatGPT developer-mode connector renders a deck through a tunnel |
| 4. Skill and connectors | SKILL.md, Claude plugin, Antigravity and OpenCode configs, merge-safe installer | Fresh machine to first carousel in under 5 minutes on each host |
| 5. SDKs and release | Python and Node packages, docs, examples, CI publish | Tagged v0.1.0 on PyPI and npm |

---

## 11. Risks and corrections to the original brief

- **Antigravity path.** Public docs show `.agents/` and `~/.gemini/config/`, not `.agent/`. The installer ships both.
- **ChatGPT and local servers.** ChatGPT cannot launch stdio servers. A "local MCP bridge" means a tunnel to the local HTTP server (or OpenAI's secure tunnel client).
- **Custom GPT Actions are REST, not MCP.** They need the OpenAPI facade.
- **Named trends.** "Hold-and-scroll reveal" and "layer-by-layer transformation" did not appear as established terms in the sources; they are patterns built from documented reveal and step-by-step formats.
- **Statistics.** Engagement numbers are directional. Ship them as editable defaults and instrument A/B testing.
- **Protocol drift.** MCP transports and client config formats changed repeatedly in 2025-2026. Keep connector tests in CI so a client update breaks a build, not a user.

---

## Appendix A: Python FastMCP server skeleton

The engine call is a subprocess to the shared TypeScript CLI so the Python and TypeScript servers behave identically. The TypeScript server registers the same tool names with `@modelcontextprotocol/sdk` and imports the engine directly; pin the SDK version and confirm the registration API against it when implementing.

```python
# mcp-server/python/omni_carousel_mcp/server.py
import argparse, json, subprocess
from fastmcp import FastMCP
from omni_carousel.models import CarouselSpec     # generated from spec/carousel.schema.json
from omni_carousel.playbook import load_playbook

mcp = FastMCP("omni-carousel")


def run_engine(cmd: str, spec: CarouselSpec, **opts) -> dict:
    proc = subprocess.run(
        ["omni-carousel", cmd, "--json", "--stdin", *[f"--{k}={v}" for k, v in opts.items()]],
        input=spec.model_dump_json(), capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        return {"ok": False, "error": proc.stderr[-2000:]}   # stderr only; never print to stdout
    return json.loads(proc.stdout)


@mcp.tool()
def get_playbook(platform: str = "instagram", goal: str = "saves") -> str:
    """Return hook formulas, pacing and layout rules for a platform and goal."""
    return load_playbook(platform, goal)


@mcp.tool()
def validate_spec(spec: CarouselSpec) -> dict:
    """Lint a carousel spec: slide count, layout alternation, copy limits, contrast, seam safety."""
    return run_engine("validate", spec)


@mcp.tool()
def render_carousel(spec: CarouselSpec, formats: list[str] | None = None,
                    output_mode: str = "path") -> dict:
    """Render 1080x1350 PNG slides and/or a multi-page PDF. Refuses if lint reports errors."""
    lint = run_engine("validate", spec)
    if lint.get("errors"):
        return {"ok": False, "lint": lint}
    return run_engine("render", spec, formats=",".join(formats or ["png", "pdf"]), output=output_mode)


@mcp.resource("carousel://schema.json")
def schema() -> str:
    return CarouselSpec.schema_json()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--http", action="store_true", help="serve Streamable HTTP instead of stdio")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    if a.http:
        mcp.run(transport="http", host=a.host, port=a.port, path="/mcp")   # http://HOST:PORT/mcp
    else:
        mcp.run()                                                           # stdio


if __name__ == "__main__":
    main()
```

---

## Appendix B: Connector templates

### Claude Desktop (`claude_desktop_config.json`, stdio)

```json
{ "mcpServers": { "omni-carousel": {
    "command": "npx", "args": ["-y", "omni-carousel-mcp"],
    "env": { "OMNI_OUTPUT_DIR": "/absolute/path/to/carousels" } } } }
```

### Claude Code: CLI, project `.mcp.json`, plugin

```bash
claude mcp add omni-carousel -- npx -y omni-carousel-mcp
claude mcp add --transport http omni-carousel http://127.0.0.1:8765/mcp
```

```json
{ "mcpServers": { "omni-carousel": { "type": "http", "url": "http://127.0.0.1:8765/mcp" } } }
```

`.claude-plugin/plugin.json` (skills in `skills/carousel-architect/SKILL.md` are auto-discovered):

```json
{ "name": "omni-carousel", "version": "0.1.0",
  "description": "Generate viral Instagram and LinkedIn carousels",
  "license": "MIT" }
```

### Google Antigravity (`.agents/mcp_config.json` or `~/.gemini/config/mcp_config.json`)

```json
{ "mcpServers": {
    "omni-carousel": { "command": "npx", "args": ["-y", "omni-carousel-mcp"] },
    "omni-carousel-remote": { "serverUrl": "https://YOUR-HOST/mcp" } } }
```

### OpenCode (`opencode.json`)

```json
{ "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "omni-carousel": { "type": "local", "command": ["npx", "-y", "omni-carousel-mcp"],
                       "enabled": true, "environment": { "OMNI_OUTPUT_DIR": "./carousels" } },
    "omni-carousel-remote": { "type": "remote", "url": "https://YOUR-HOST/mcp", "enabled": false,
                              "headers": { "Authorization": "Bearer {env:OMNI_TOKEN}" } } } }
```

### OpenAI Codex CLI (`~/.codex/config.toml`)

```toml
[mcp_servers.omni-carousel]
command = "npx"
args = ["-y", "omni-carousel-mcp"]
```

### VS Code (`.vscode/mcp.json`)

```json
{ "servers": { "omni-carousel": { "command": "npx", "args": ["-y", "omni-carousel-mcp"] } } }
```

### ChatGPT: developer mode connector, Responses API, Custom GPT Action

```bash
# 1) Start the remote server and a tunnel (ChatGPT needs a public HTTPS URL)
omni-carousel-mcp --http --port 8765 &
cloudflared tunnel --url http://127.0.0.1:8765
# 2) ChatGPT: Settings > Apps and Connectors > Advanced > Developer mode > Create
#    URL: https://YOUR-TUNNEL/mcp   Auth: API key or OAuth
```

```python
# Responses API
client.responses.create(
    model="...", input="Make a 9-slide LinkedIn carousel on ...",
    tools=[{"type": "mcp", "server_label": "omni_carousel",
            "server_url": "https://YOUR-TUNNEL/mcp", "require_approval": "never"}])
```

```yaml
# Custom GPT Action: openapi.yaml
openapi: 3.1.0
info: { title: Omni Carousel API, version: 0.1.0 }
servers: [ { url: "https://YOUR-TUNNEL" } ]
paths:
  /v1/playbook: { get:  { operationId: getPlaybook } }
  /v1/validate: { post: { operationId: validateSpec } }
  /v1/render:   { post: { operationId: renderCarousel } }   # returns signed file URLs
```

### Anthropic Messages API (remote MCP)

```python
client.beta.messages.create(
    model="...", max_tokens=2000, messages=[...],
    mcp_servers=[{"type": "url", "url": "https://YOUR-HOST/mcp", "name": "omni-carousel"}],
    betas=["<current MCP client beta>"])   # confirm the beta identifier in current docs
```

---

## Appendix C: Sources consulted (November 2026)

- Instagram benchmarks: creatorflow.so (content formats guide; carousel posts guide), socialinsider.io/blog/instagram-carousel, blog.mean.ceo carousel statistics
- Seamless and panorama carousels: krumzi.com/blog/seamless-instagram-carousel, postplanify.com/blog/instagram-carousel-guide, zaps-design.pages.dev seamless guide
- LinkedIn document posts: oktopost.com LinkedIn carousel PDF best practices, postory.io LinkedIn carousels guide, posteverywhere.ai LinkedIn carousel data
- Design trends: theplusaddons.com web design trends 2026, theedigital.com web design trends 2026
- MCP and FastMCP transports: gofastmcp.com/deployment/http, fastmcp-ts.docs.prefect.io
- Agent configs: notes.systemoverlord.com Agent-Configs, dev.to/gde Antigravity MCP and skills, docs.summerengine.com Antigravity, opencode.ai/docs/mcp-servers, skillselion.com Claude Code plugin structure
- ChatGPT connectors: coworker.ai/blog/chatgpt-mcp, skillsplayground.com ChatGPT custom connectors
