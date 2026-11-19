# Generic hosts (Cursor, Windsurf, Zed, LibreChat, anything else)

Every host below runs the same server; only the container key changes.

| Host | File | Container key | Remote key | Notes |
|---|---|---|---|---|
| Cursor | `.cursor/mcp.json` · `~/.cursor/mcp.json` | `mcpServers` | `url` | Reads `AGENTS.md` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | **`serverUrl`** | Remote key differs |
| Zed | `~/.config/zed/settings.json` | `context_servers` | — | stdio only, nested `command` object |
| LibreChat | `librechat.yaml` | `mcpServers` (YAML) | `url` | `type: streamable-http` |
| Any other MCP client | see [`mcpServers.json`](./mcpServers.json) | `mcpServers` | `url` | — |

## Cursor

```bash
npx omni-carousel-setup --client cursor --scope project
```

```json
{ "mcpServers": { "omni-carousel": { "command": "npx", "args": ["-y", "omni-carousel-mcp"] } } }
```

## Windsurf

```bash
npx omni-carousel-setup --client windsurf
```

```json
{
  "mcpServers": {
    "omni-carousel": {
      "serverUrl": "https://carousel.example.com/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

## Zed

```bash
npx omni-carousel-setup --client zed
```

```json
{
  "context_servers": {
    "omni-carousel": {
      "command": { "path": "npx", "args": ["-y", "omni-carousel-mcp"] }
    }
  }
}
```

## LibreChat (`librechat.yaml`)

```yaml
mcpServers:
  omni-carousel:
    type: streamable-http
    url: https://carousel.example.com/mcp
    headers:
      Authorization: "Bearer ${OMNI_AUTH_TOKEN}"
```

## Manual stdio, any host

```bash
npx -y omni-carousel-mcp
```

Speaks MCP `2025-11-25` over stdio. Diagnostics go to **stderr** only; stdout carries JSON-RPC frames and nothing else.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Server "failed to start" | `npx` not on the GUI app's PATH | Use `which npx` output as `command` |
| Connects, no tools | Wrong container key (`servers` vs `mcpServers`) | Check the table above |
| Remote never connects on Windsurf/Antigravity | `url` instead of `serverUrl` | Use `serverUrl` |
| Works locally, not remotely | Remote host cannot read your disk | Request `output_mode: "url"` |
