# Contributing to `omni-carousel-agent`

Thank you for helping make `omni-carousel-agent` fast, honest, deterministic, and portable across every AI host.

## Core Invariants

1. **One Contract:** All spec changes start in `core-engine/src/schema.ts` (Zod), then regenerate `spec/carousel.schema.json` (`npm run export:schema`) and verify Python Pydantic models (`pytest`).
2. **Deterministic Output:** Layouts must never call `Math.random()`, `Date.now()` inside visual geometry, or fetch unpinned external CDNs during default renders. Use deterministic seeded PRNGs for organic textures (such as `scrapbook`).
3. **WCAG AA Minimum:** Every theme in `spec/themes/` must pass `>= 4.5:1` contrast for body/footer copy and `>= 3.0:1` for display headlines (`>= 36px`).
4. **stdio Hygiene:** Never use `console.log()` or `print()` to stdout inside MCP server code paths; route logs strictly to `stderr`.
5. **Honest Content:** Never ship starter examples or prompt templates containing fabricated statistics, unverified quotes, or fake testimonials.

## Development Workflow

```bash
npm install                 # JS workspaces
npm run build               # tsc + theme/playbook sync + schema export
npm run export:schema       # regenerate spec/carousel.schema.json from Zod

npm test                       # engine + MCP server + SDK (72 tests)
pytest sdks/python-sdk         # Python models, tools, runner (32)
pytest mcp-server/python       # FastMCP conformance (8)

node scripts/check-parity.mjs        # cross-language contract check
node scripts/validate-connectors.mjs # 13 connector configs + OpenAPI sync
node scripts/smoke-connectors.mjs    # installer merge/idempotency/uninstall
npm run render:examples             # re-render examples/rendered
```

Golden images: `core-engine/test/golden/slides.json` holds sha256 hashes for a
reference deck. If a layout change moves pixels on purpose, re-bless with
`npm run golden` and say so in the PR — a silent hash change is a red flag.

## Pull Request Checklist

- [ ] Schema changes exported via `npm run export:schema`
- [ ] All TypeScript tests (`npm test`) and Python tests (`pytest sdks/python-sdk mcp-server/python`) pass
- [ ] `node scripts/check-parity.mjs` passes (layouts, tool names, copy budgets, theme sync)
- [ ] New layouts include a copy budget in `core-engine/src/lint.ts`, a row in `spec/playbook/layouts.md`, an entry in `LAYOUT_META`, and an example that uses them
- [ ] Connector changes preserve merge-safety and idempotency (`node scripts/smoke-connectors.mjs`)
- [ ] Golden hashes re-blessed deliberately, or unchanged
