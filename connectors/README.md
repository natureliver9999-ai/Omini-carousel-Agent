# Connectors

One engine, twelve host integrations, zero divergent behaviour. Every folder here was verified against the host's 2026 documentation — see [`../docs/research/03-agent-ecosystem-and-mcp-compatibility-2026.md`](../docs/research/03-agent-ecosystem-and-mcp-compatibility-2026.md).

## The one command

```bash
npx omni-carousel-setup --client <id> [--scope user|project] [--mode stdio|http] [--dry-run] [--uninstall]
npx omni-carousel-setup --list
```

Guarantees: **timestamped backup** before every write, sibling servers preserved, **idempotent** (running twice changes nothing), `--uninstall` removes only the `omni-carousel` key.

## Matrix

| Host | Folder | Transport | Config location | Special handling |
|---|---|---|---|---|
| Claude Desktop | [`claude-desktop/`](./claude-desktop/) | stdio | `claude_desktop_config.json` | GUI PATH caveat documented |
| Claude Code | [`claude-code/`](./claude-code/) | stdio · http | `.mcp.json` / `~/.claude.json` | Links `.claude/skills/` |
| ChatGPT (Developer Mode) | [`chatgpt/`](./chatgpt/) | Streamable HTTP | UI-managed | Public HTTPS only; `tunnel.sh` provided |
| ChatGPT (Custom GPT) | [`chatgpt/`](./chatgpt/) | REST OpenAPI 3.1 | GPT editor | `openapi.yaml` + bearer auth |
| Google Antigravity | [`antigravity/`](./antigravity/) | stdio · http | `~/.gemini/config/mcp_config.json` | **`serverUrl` only**, strict JSON |
| OpenCode | [`opencode/`](./opencode/) | local · remote | `opencode.json` | `command` is one array; `mcp` key |
| OpenAI Codex CLI | [`codex/`](./codex/) | stdio · http | `~/.codex/config.toml` | TOML tables; `bearer_token_env_var` |
| VS Code / Copilot | [`vscode/`](./vscode/) | stdio · http | `.vscode/mcp.json` | `servers` key + `type` |
| Cursor | [`generic/`](./generic/) | stdio · http | `.cursor/mcp.json` | `mcpServers` |
| Windsurf | [`generic/`](./generic/) | stdio · http | `~/.codeium/windsurf/mcp_config.json` | `serverUrl` for remote |
| Zed | [`generic/`](./generic/) | stdio | `~/.config/zed/settings.json` | `context_servers` |
| LibreChat | [`generic/`](./generic/) | streamable-http | `librechat.yaml` | YAML snippet |
| Anything else | [`generic/`](./generic/) | stdio | — | `mcpServers.json` |

## Remote deployment

```bash
omni-carousel-mcp --http --host 0.0.0.0 --port 8765 \
  --token "$OMNI_AUTH_TOKEN" --public-url https://carousel.example.com
```

- `/mcp` — Streamable HTTP (stateless: no session pinning)
- `/files/:artifactId/...` — HMAC-signed, expiring artifact delivery
- `/healthz` — liveness

The server **refuses to bind a non-loopback interface without a token**.

## SDK-native integrations

Cloud APIs can skip MCP entirely and call the tools natively. Both SDKs ship ready-made tool definitions and a runner:

- [`../sdks/python-sdk/`](../sdks/python-sdk) — `omni_carousel.anthropic_tools()`, `openai_tools()`, `vercel`-equivalent
- [`../sdks/node-sdk/`](../sdks/node-sdk) — `anthropicTools`, `openaiTools`, `vercelTools`, `mcpServerConfig`

Anthropic Messages API remote MCP needs **both** `mcp_servers` and a matching `mcp_toolset` in `tools` (beta `mcp-client-2025-11-20`); the SDK helpers do that for you.
