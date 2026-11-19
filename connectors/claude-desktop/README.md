# Claude Desktop

Two ways in: a local stdio server (recommended — renders on your machine) or a remote HTTPS connector (needed on web/Teams). See [`../../docs/research/03-agent-ecosystem-and-mcp-compatibility-2026.md`](../../docs/research/03-agent-ecosystem-and-mcp-compatibility-2026.md) §2.

## 1. Local stdio (one command)

```bash
npx omni-carousel-mcp setup --client claude-desktop --scope user
```

That merge-safely upserts this entry into `claude_desktop_config.json`:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "omni-carousel": {
      "command": "npx",
      "args": ["-y", "omni-carousel-mcp"],
      "env": {
        "OMNI_OUTPUT_DIR": "/Users/you/carousels",
        "UNSPLASH_ACCESS_KEY": "optional"
      }
    }
  }
}
```

Restart Claude Desktop. The tools appear under the 🔌 menu; ask for *"a 9-slide Instagram carousel about X"*.

> **GUI PATH gotcha:** apps launched from Finder/Dock do not inherit your shell `PATH`, so `npx` may not resolve. If the server shows as failed, replace `"command": "npx"` with the absolute path from `which npx`.

## 2. Remote connector (web / Teams)

```bash
# on a machine with a public HTTPS URL
omni-carousel-mcp --http --host 0.0.0.0 --port 8765 \
  --token "$OMNI_AUTH_TOKEN" --public-url https://carousel.example.com
```

Then in Claude: **Settings → Connectors → Add custom connector** → `https://carousel.example.com/mcp` → add the bearer token header if your plan exposes header fields. Remote connectors cannot read your disk, so ask for `output_mode: "url"` (the model will, because the server instructions say so).

## Verify

```bash
npx omni-carousel-mcp --version
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' | npx omni-carousel-mcp
```

You should get a JSON `result` with `serverInfo.name == "omni-carousel"` on stdout and nothing else.
