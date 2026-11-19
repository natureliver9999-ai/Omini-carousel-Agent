# omni-carousel-mcp (TypeScript)

The reference MCP server: stdio for desktop hosts, Streamable HTTP for hosted
agents, both backed by the in-process engine.

```bash
npm i -g omni-carousel-mcp
omni-carousel-mcp            # stdio
omni-carousel-mcp --http     # Streamable HTTP on 127.0.0.1:8765/mcp
```

## Tools

| Tool | Purpose |
| --- | --- |
| `get_playbook` | platform rules: slide counts, copy limits, hooks, patterns |
| `list_layouts` | the 11 layouts with role, density and copy budget |
| `list_themes` | bundled WCAG-audited themes |
| `validate_spec` | schema + retention/copy/contrast/provenance lint |
| `render_carousel` | PNG slides, PDF, HTML deck, ZIP, caption — `output_mode: path \| url \| inline` |
| `preview_slide` | one slide as an image |
| `fetch_asset` | license-tracked stock photo or offline generated art (SSRF-guarded) |
| `make_chart` | bar / horizontal bar / line / donut from explicit numbers |
| `make_diagram` | Mermaid-style flow diagram as theme-aware SVG |

Resources: `carousel://playbook`, `carousel://schema.json`, `carousel://themes/{id}`.
Prompt: `create_carousel(topic, platform, goal)`.

## HTTP mode security

The server refuses to bind a non-loopback interface without credentials:

```bash
OMNI_TOKEN=$(openssl rand -hex 24) omni-carousel-mcp --http --host 0.0.0.0
```

- `OMNI_TOKEN` → `Authorization: Bearer <token>` required (constant-time compare).
- `OMNI_ALLOWED_ORIGINS` → optional browser origin allowlist for the REST facade.
- `OMNI_ALLOW_UNAUTHENTICATED=1` → explicit opt-out, for a private tunnel only.
- Host header is validated against loopback/allowlist to blunt DNS-rebinding.
- Artifact URLs are HMAC-signed with `OMNI_SIGNING_SECRET`, default TTL 1 h.

`render_carousel` with `output_mode: "url"` returns signed links
(`/files/<artifactId>/<path>?exp=…&sig=…`); tampering with either the path or the
expiry invalidates the signature, and the tests cover both.

## Tests

```bash
npx vitest run --root mcp-server/typescript
```

26 tests: the nine-tool contract, resource/prompt wiring, in-memory client calls,
signed-URL tamper and expiry, path traversal and symlink escape.
