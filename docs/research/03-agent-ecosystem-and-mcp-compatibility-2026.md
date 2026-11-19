# Research Report 03: 2026 Agent Ecosystem, MCP Transports & Connector Compatibility

**Last Updated:** 19 November 2026  
**Scope:** Verified protocol mechanics and configuration schemas across 14 AI hosts, CLIs, IDEs, and cloud SDKs.

---

## 1. Protocol Landscape in Late 2026

An "agent-agnostic" tool layer in November 2026 must bridge **five distinct integration surfaces**, because no single protocol covers every host:

1. **Cross-Agent Skill Packages (`SKILL.md`):** Markdown instruction bundles with YAML frontmatter read directly into context by Claude Code, Claude Desktop, OpenCode, OpenAI Codex CLI, Google Antigravity, Cursor, and Cline. Zero runtime process required for planning knowledge, paired with MCP/CLI for deterministic execution.
2. **MCP over `stdio`:** Standard JSON-RPC 2.0 over stdin/stdout (`@modelcontextprotocol/sdk` / `FastMCP`). Default for local desktop apps and terminal coding agents. **Strict rule:** `stdout` is reserved 100% for JSON-RPC frames; any diagnostic log written to `stdout` corrupts the session.
3. **MCP over `Streamable HTTP` (`/mcp`):** Introduced in MCP `2025-03-26` and standardized in `2025-11-25` (replacing deprecated dual-endpoint HTTP+SSE). Single `/mcp` endpoint accepting `POST` (JSON-RPC requests) and optional `GET`/`DELETE` with `Mcp-Session-Id` and `MCP-Protocol-Version` headers. Required for ChatGPT Developer Mode, Claude.ai web connectors, Anthropic Messages API, and OpenAI Responses API.
4. **REST + OpenAPI 3.1.0 Facade (`/v1/*`):** Required for **ChatGPT Custom GPT Actions**, Zapier/Make webhooks, and non-MCP enterprise orchestrators.
5. **In-Process Native SDK Tool Schemas:** Direct function-calling tool definitions for `@anthropic-ai/sdk`, `openai` (Responses & Chat Completions APIs), Vercel AI SDK v5+ (`tool({ inputSchema })`), and Python `anthropic` / `openai` packages.

---

## 2. Verified Host Compatibility Matrix (November 2026)

| Host / Platform | Supported Transports | Exact Config Location(s) | Config Schema & Verified 2026 Quirks |
|---|---|---|---|
| **Claude Desktop** | `stdio` (config); `Streamable HTTP` (UI Settings -> Connectors) | macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`<br>Win: `%APPDATA%\Claude\claude_desktop_config.json`<br>Linux: `~/.config/Claude/claude_desktop_config.json` | Top-level `mcpServers.<name>: { command, args, env }`. Does not expand shell `$PATH` reliably on macOS GUI launch—pass explicit env overrides when needed. |
| **Claude Code (CLI & IDE)** | `stdio`, `Streamable HTTP`, Native Plugin + Skills | User: `~/.claude.json`<br>Project: `.mcp.json`<br>Plugin: `.claude-plugin/plugin.json` + `skills/` | `claude mcp add --transport http omni-carousel http://127.0.0.1:8765/mcp` or stdio. Scope precedence: `local > project > user` (winner replaces entry wholesale). Auto-discovers `skills/carousel-architect/SKILL.md` and `CLAUDE.md`. |
| **Claude.ai (Web / Teams)** | `Streamable HTTP` (HTTPS required) | Settings -> Connectors -> Add Custom Connector | Requires public HTTPS URL. Some org tiers omit custom request-header UI; supports OAuth or signed query/bearer auth. |
| **ChatGPT (Developer Mode)** | `Streamable HTTP` (HTTPS only; **no local stdio**) | Settings -> Apps & Connectors -> Advanced -> Developer Mode -> Create | Paid plans (Plus/Pro/Team/Enterprise). Requires HTTPS endpoint (via Cloudflare Tunnel, ngrok, or cloud deploy). Remote hosts cannot read server disk -> **must use `output_mode="url"` or `"inline"`**. |
| **ChatGPT Custom GPT Actions** | **REST OpenAPI 3.1.0** (not MCP) | GPT Builder -> Configure -> Actions -> Import Schema | Imports `openapi.yaml` (3.1.0). Every endpoint needs an explicit `operationId` (`getPlaybook`, `validateSpec`, `renderCarousel`, etc.) and returns signed download URLs. |
| **Google Antigravity (IDE & CLI)** | `stdio`, `Streamable HTTP` | Global: `~/.gemini/config/mcp_config.json` (also `~/.gemini/antigravity/mcp_config.json`)<br>Project: `.agents/mcp_config.json`<br>Skills: `~/.gemini/config/skills/` & `.agents/skills/` | **Verified Critical Quirks:**<br>1. Remote MCP **strictly requires `serverUrl`** (`url` and `httpUrl` are rejected!).<br>2. Several 2026 Antigravity builds ignore project-level MCP configs—always register in `~/.gemini/config/mcp_config.json` for user scope.<br>3. Strict JSON parser: **no comments, no trailing commas, no top-level `timeout` key**.<br>4. Project skills use `.agents/skills/` (plural); shipping `.agent` symlink covers legacy preview builds. |
| **OpenCode** | `local` (stdio) or `remote` (HTTP) + Native Skills | Project: `opencode.json` or `.opencode/opencode.json`<br>Global: `~/.config/opencode/opencode.json` | Uses top-level `"mcp"` key (NOT `mcpServers`!):<br>`"type": "local"`, `"command": ["npx", "-y", "omni-carousel-mcp"]` (single array, not `command`+`args`), `"environment": { "OMNI_OUTPUT_DIR": "./carousels" }`.<br>Remote uses `"type": "remote"`, `"url": "..."`, `"headers": { "Authorization": "Bearer {env:OMNI_TOKEN}" }`. Auto-reads `AGENTS.md` and `.claude/skills/`. |
| **OpenAI Codex CLI** | `stdio` or `Streamable HTTP` + Skills | User: `~/.codex/config.toml`<br>Project: `.codex/config.toml` (trusted projects) | TOML table `[mcp_servers.omni-carousel]` with `command = "npx"`, `args = ["-y", "omni-carousel-mcp"]`, `env_vars = ["OMNI_OUTPUT_DIR"]`. Remote uses `url = "..."` and `bearer_token_env_var = "OMNI_TOKEN"`. Reads `AGENTS.md` and `.agents/skills/` (note: symlink directory, not symlinked `SKILL.md` file). |
| **VS Code / GitHub Copilot** | `stdio` or `http` | Workspace: `.vscode/mcp.json`<br>User: `%APPDATA%\Code\User\mcp.json` / `~/.config/Code/User/mcp.json` | Uses top-level **`"servers"`** key (NOT `mcpServers`): `{ "servers": { "omni-carousel": { "type": "stdio", "command": "npx", "args": [...] } } }`. |
| **Cursor** | `stdio` or `Streamable HTTP` | Project: `.cursor/mcp.json`<br>Global: `~/.cursor/mcp.json` | Standard `mcpServers` JSON; remote uses `"url": "https://.../mcp"`. Reads `AGENTS.md`. |
| **Windsurf** | `stdio` or `Streamable HTTP` | `~/.codeium/windsurf/mcp_config.json` | Uses `mcpServers`; like Antigravity, remote entries use `serverUrl`. |
| **Zed** | `stdio` | `~/.config/zed/settings.json` | Uses `"context_servers": { "omni-carousel": { "command": { "path": "npx", "args": [...] } } }`. |
| **LibreChat** | `stdio` or `streamable-http` | `librechat.yaml` | YAML block `mcpServers.omni-carousel` with `type: streamable-http` and `url: ...`. |

---

## 3. Cloud Model API Native MCP Connectors (Verified November 2026)

### 3.1 Anthropic Messages API (`mcp-client-2025-11-20`)
Anthropic deprecated the April 2025 beta header (`mcp-client-2025-04-04`) in favor of **`mcp-client-2025-11-20`**. Under `mcp-client-2025-11-20`, declaring `mcp_servers` alone causes a validation error unless `tools` also includes a matching `mcp_toolset` reference:

```python
response = client.beta.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=4096,
    messages=[{"role": "user", "content": "Create an 8-slide LinkedIn carousel on API idempotency."}],
    mcp_servers=[
        {
            "type": "url",
            "url": "https://carousel.example.com/mcp",
            "name": "omni-carousel",
            "authorization_token": os.environ["OMNI_TOKEN"],
        }
    ],
    tools=[
        {
            "type": "mcp_toolset",
            "mcp_server_name": "omni-carousel",
        }
    ],
    betas=["mcp-client-2025-11-20"],
)
```

### 3.2 OpenAI Responses API (`type: "mcp"`)
```python
response = client.responses.create(
    model="gpt-4.1",
    input="Make a 9-slide Instagram carousel on cognitive biases in pricing.",
    tools=[
        {
            "type": "mcp",
            "server_label": "omni_carousel",
            "server_url": "https://carousel.example.com/mcp",
            "headers": {"Authorization": f"Bearer {os.environ['OMNI_TOKEN']}"},
            "require_approval": "never",
        }
    ],
)
```

### 3.3 Vercel AI SDK v5+ (`inputSchema`)
Vercel AI SDK 5+ replaced `parameters` with `inputSchema` (and optional `outputSchema`):
```typescript
import { tool } from "ai";
import { CarouselSpecSchema } from "@omni-carousel/engine";

export const validateCarouselTool = tool({
  description: "Validate and lint a CarouselSpec JSON object.",
  inputSchema: CarouselSpecSchema,
  execute: async (spec) => lintSpec(spec),
});
```

---

## 4. Merge-Safe Installer Design Principles (`connectors/setup`)

Because developers frequently run 3–8 MCP servers simultaneously (GitHub, Supabase, Playwright, Linear, Filesystem), a naive installer that overwrites `claude_desktop_config.json` or `~/.codex/config.toml` destroys user workflows. Our installer enforces five invariants:

1. **Timestamped Backup First:** Before mutating any existing file `F`, write `F.bak.<ISO-timestamp>` with identical file permissions.
2. **Surgical Key Merge:** Parse existing JSON or TOML, ensure the client's specific container key (`mcpServers`, `mcp`, `servers`, or `[mcp_servers.omni-carousel]`) exists, and upsert **only** the `omni-carousel` entry while preserving every sibling server and unrelated top-level setting.
3. **Strict Idempotency:** Running `setup` twice produces zero duplicate keys and leaves identical normalized output.
4. **Clean `--uninstall`:** Deletes only the `omni-carousel` key (and skill symlinks created by us), leaving sibling servers untouched.
5. **Dry-Run Diff (`--dry-run`):** Prints exact target paths and JSON/TOML diffs without touching the filesystem.
