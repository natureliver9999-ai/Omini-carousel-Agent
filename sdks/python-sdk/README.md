# omni-carousel (Python SDK)

Typed models, agent tool definitions and a runner that shells out to the same
deterministic engine the TypeScript stack uses. A deck rendered from Python is
byte-identical to one rendered from Node — the tests assert it.

```bash
pip install omni-carousel
```

The SDK needs the engine CLI. Either install it
(`npm i -g @omni-carousel/engine`), build this repo (`npm run build`, which puts
`core-engine/dist/cli.js` in place), or point at it explicitly:

```bash
export OMNI_CAROUSEL_CLI=/path/to/core-engine/dist/cli.js
```

## Models

```python
from omni_carousel import CarouselSpec, CoverHookSlide, CtaSlide, parse_spec

spec = CarouselSpec.model_validate(json.load(open("examples/specs/ig-contrast-myths.json")))
print(len(spec.slides), spec.slides[0].layout)   # 6 cover_hook
```

`extra="forbid"` everywhere: a typo like `font_size` fails loudly instead of being
silently dropped. Every model is a 1:1 mirror of `spec/carousel.schema.json`, and
`tests/test_models.py` fails the build if the two drift.

## Tool definitions

```python
from omni_carousel import anthropic_tools, openai_tools, openai_chat_tools

anthropic_tools()      # [{"name", "description", "input_schema"}, ...]
openai_tools()         # [{ "type": "function", "name", "parameters" }, ...]
openai_chat_tools()    # [{ "type": "function", "function": {...} }, ...]
```

Nine tools: `get_playbook`, `list_layouts`, `list_themes`, `validate_spec`,
`render_carousel`, `preview_slide`, `fetch_asset`, `make_chart`, `make_diagram`.

## Running a tool

```python
from omni_carousel import handle_tool_call

result = handle_tool_call("validate_spec", {"spec": spec.to_payload()})
print(result.data["lint"]["ok"])

rendered = handle_tool_call("render_carousel", {
    "spec": spec.to_payload(),
    "output_dir": "./carousels",
    "formats": ["png", "pdf"],
})
print(rendered.data["files"]["pdf"])
```

`handle_tool_call` never raises: failures come back as `RunResult(is_error=True, text=...)`
so an agent loop can feed them straight back to the model.

## Native remote MCP

```python
from omni_carousel import anthropic_mcp_server, openai_mcp_tool

fragment = anthropic_mcp_server("https://your-host/mcp", authorization_token="...")
# fragment["tools"] contains the required mcp_toolset — the API rejects the server without it

remote = openai_mcp_tool("https://your-host/mcp")   # {"type": "mcp", "server_url": ...}
```

## CLI

```bash
omni-carousel-py doctor
omni-carousel-py validate examples/specs/ig-contrast-myths.json
omni-carousel-py render examples/specs/ig-contrast-myths.json --out ./carousels --formats png,pdf
omni-carousel-py tools --format anthropic > tools.json
```

## Tests

```bash
pytest sdks/python-sdk          # 30+ tests, engine-backed ones skip if not built
```
