"""Tool definitions for Anthropic, OpenAI and MCP hosts.

Schemas are derived from the Pydantic models, so a field added to the contract
shows up in every SDK surface at once.
"""

from __future__ import annotations

from typing import Any

from .models import CarouselSpec, Chart

TOOL_DESCRIPTIONS: dict[str, str] = {
    "get_playbook": "Read the carousel craft rules for a platform (slide counts, copy limits, patterns, hooks). Always call before planning a deck.",
    "list_layouts": "List the 11 typed slide layouts with role, density and copy budget, plus valid icon names.",
    "list_themes": "List the bundled WCAG-audited themes with accents and measured contrast.",
    "validate_spec": "Validate and lint a CarouselSpec: retention backbone, copy budgets, clichés, alternation, panorama geometry, contrast, provenance.",
    "render_carousel": "Render a validated CarouselSpec to 1080x1350 PNG slides, a multi-page PDF, an HTML deck and a ZIP bundle with caption and provenance.",
    "preview_slide": "Render one slide of a deck as an image, without writing a full bundle.",
    "fetch_asset": "Fetch license-tracked stock photography or generate deterministic theme-native art offline. SSRF-guarded.",
    "make_chart": "Draw a bar, horizontal bar, line or donut chart from explicit numbers.",
    "make_diagram": "Render a Mermaid-style flow diagram as theme-aware SVG. Offline, no browser.",
}


def _spec_schema() -> dict[str, Any]:
    return CarouselSpec.model_json_schema(ref_template="#/$defs/{model}")


def _chart_schema() -> dict[str, Any]:
    return Chart.model_json_schema(ref_template="#/$defs/{model}")


def tool_input_schemas() -> dict[str, dict[str, Any]]:
    """MCP-style JSON Schemas keyed by tool name."""
    spec = _spec_schema()
    return {
        "get_playbook": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "enum": ["instagram", "linkedin", "hooks", "patterns", "layouts", "all"],
                    "description": "Which chapter to load.",
                }
            },
            "additionalProperties": False,
        },
        "list_layouts": {"type": "object", "properties": {}, "additionalProperties": False},
        "list_themes": {"type": "object", "properties": {}, "additionalProperties": False},
        "validate_spec": {
            "type": "object",
            "properties": {"spec": spec},
            "required": ["spec"],
            "additionalProperties": False,
        },
        "render_carousel": {
            "type": "object",
            "properties": {
                "spec": spec,
                "output_mode": {"type": "string", "enum": ["path", "url", "inline"], "default": "path"},
                "theme": {"type": "string"},
                "formats": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["png", "pdf", "zip", "html", "json", "caption"]},
                },
                "strict": {"type": "boolean"},
            },
            "required": ["spec"],
            "additionalProperties": False,
        },
        "preview_slide": {
            "type": "object",
            "properties": {
                "spec": spec,
                "slide_index": {"type": "integer", "minimum": 0},
                "theme": {"type": "string"},
            },
            "required": ["spec", "slide_index"],
            "additionalProperties": False,
        },
        "fetch_asset": {
            "type": "object",
            "properties": {
                "provider": {"type": "string", "enum": ["unsplash", "pexels", "pattern"]},
                "query": {"type": "string", "maxLength": 120},
                "width": {"type": "integer", "minimum": 200, "maximum": 2400},
                "height": {"type": "integer", "minimum": 200, "maximum": 2400},
                "accent": {"type": "string", "pattern": "^#[0-9a-fA-F]{3,8}$"},
                "background": {"type": "string", "pattern": "^#[0-9a-fA-F]{3,8}$"},
            },
            "additionalProperties": False,
        },
        "make_chart": {
            "type": "object",
            "properties": {
                "chart": _chart_schema(),
                "theme": {"type": "string"},
                "width": {"type": "integer", "minimum": 320, "maximum": 2000},
                "height": {"type": "integer", "minimum": 240, "maximum": 2000},
                "title": {"type": "string", "maxLength": 80},
            },
            "required": ["chart"],
            "additionalProperties": False,
        },
        "make_diagram": {
            "type": "object",
            "properties": {
                "source": {"type": "string", "minLength": 3, "maxLength": 4000},
                "theme": {"type": "string"},
                "direction": {"type": "string", "enum": ["TD", "LR"]},
                "title": {"type": "string", "maxLength": 80},
                "save": {"type": "boolean"},
            },
            "required": ["source"],
            "additionalProperties": False,
        },
    }


def anthropic_tools() -> list[dict[str, Any]]:
    """Anthropic Messages API tool definitions (`input_schema`)."""
    schemas = tool_input_schemas()
    return [
        {"name": name, "description": TOOL_DESCRIPTIONS[name], "input_schema": schemas[name]}
        for name in TOOL_DESCRIPTIONS
    ]


def openai_tools(strict: bool = False) -> list[dict[str, Any]]:
    """OpenAI Responses API function tools (flat shape)."""
    schemas = tool_input_schemas()
    tools = [
        {"type": "function", "name": name, "description": TOOL_DESCRIPTIONS[name], "parameters": schemas[name]}
        for name in TOOL_DESCRIPTIONS
    ]
    if strict:
        for tool in tools:
            tool["strict"] = True
    return tools


def openai_chat_tools(strict: bool = False) -> list[dict[str, Any]]:
    """Chat Completions shape (nested under `function`)."""
    return [
        {"type": "function", "function": {"name": tool["name"], "description": tool["description"],
                                          "parameters": tool["parameters"], **({"strict": True} if strict else {})}}
        for tool in openai_tools()
    ]


def anthropic_mcp_server(url: str, name: str = "omni-carousel", authorization_token: str | None = None,
                         allowed_tools: list[str] | None = None) -> dict[str, Any]:
    """Request fragment for Anthropic's native remote MCP connector.

    Beta ``mcp-client-2025-11-20`` requires the matching ``mcp_toolset`` entry in
    ``tools``; omitting it is a validation error. Returns everything you need.
    """
    toolset: dict[str, Any] = {"type": "mcp_toolset", "mcp_server_name": name}
    if allowed_tools:
        toolset["default_config"] = {"enabled": False, "allowed_tools": allowed_tools}
    server: dict[str, Any] = {"type": "url", "url": url, "name": name}
    if authorization_token:
        server["authorization_token"] = authorization_token
    return {"betas": ["mcp-client-2025-11-20"], "mcp_servers": [server], "tools": [toolset]}


def openai_mcp_tool(server_url: str, server_label: str = "omni_carousel",
                    authorization_token: str | None = None, require_approval: str = "never") -> dict[str, Any]:
    """OpenAI Responses API native remote MCP tool."""
    tool: dict[str, Any] = {
        "type": "mcp",
        "server_label": server_label,
        "server_url": server_url,
        "require_approval": require_approval,
    }
    if authorization_token:
        tool["headers"] = {"Authorization": f"Bearer {authorization_token}"}
    return tool


def mcp_server_config(mode: str = "stdio", url: str = "http://127.0.0.1:8765/mcp",
                      token: str | None = None, output_dir: str | None = None) -> dict[str, Any]:
    """Ready-to-paste `mcpServers` config for desktop hosts."""
    if mode == "http":
        entry: dict[str, Any] = {"url": url}
        if token:
            entry["headers"] = {"Authorization": f"Bearer {token}"}
    else:
        entry = {"command": "npx", "args": ["-y", "omni-carousel-mcp"]}
        if output_dir:
            entry["env"] = {"OMNI_OUTPUT_DIR": output_dir}
    return {"mcpServers": {"omni-carousel": entry}}
