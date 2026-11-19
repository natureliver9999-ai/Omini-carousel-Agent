# omni-carousel-mcp (Python / FastMCP)

A FastMCP server that exposes the same nine tools, three resources and one prompt
as the TypeScript server. It does **not** re-implement rendering: every call is
delegated to the engine CLI through `omni-carousel`'s runner, so both servers
cannot drift.

```bash
pip install omni-carousel-mcp
npm i -g @omni-carousel/engine     # or build this repo and set OMNI_CAROUSEL_CLI
```

## stdio (Claude Desktop, Claude Code, Cursor, Codex, …)

```json
{
  "mcpServers": {
    "omni-carousel": {
      "command": "omni-carousel-mcp-py",
      "args": ["--transport", "stdio"]
    }
  }
}
```

## Streamable HTTP

```bash
omni-carousel-mcp-py --transport http --host 127.0.0.1 --port 8765 --path /mcp
```

Binds loopback by default. The server is a thin wrapper, so put authentication in
front of it (tunnel, reverse proxy, or `connectors/chatgpt/tunnel.sh`) before
exposing it — the TypeScript HTTP server has the built-in token/origin policy, this
one trusts its network boundary.

## Surface

| Kind | Name |
| --- | --- |
| tools | `get_playbook`, `list_layouts`, `list_themes`, `validate_spec`, `render_carousel`, `preview_slide`, `fetch_asset`, `make_chart`, `make_diagram` |
| resources | `carousel://playbook`, `carousel://schema.json`, `carousel://themes/{id}` |
| prompt | `create_carousel(topic, platform, goal)` |

`render_carousel` returns the artifact directory, file map and lint report;
`validate_spec` returns the lint report and never throws on an invalid deck — the
report says `ok: false` and lists errors with JSON paths.

## Compatibility

Works with the standalone `fastmcp` package (transport `http`) and falls back to
`mcp.server.fastmcp` from the official SDK (transport `streamable-http`) if that is
what your environment provides.

```bash
omni-carousel-mcp-py --doctor     # flavor, resolved engine path, tool list
pytest mcp-server/python          # 8 conformance tests
```
