"""Tool definitions are the public API of the SDK — they get their own tests."""

from __future__ import annotations

import json

from omni_carousel import (
    anthropic_mcp_server,
    anthropic_tools,
    mcp_server_config,
    openai_chat_tools,
    openai_mcp_tool,
    openai_tools,
    tool_input_schemas,
)

EXPECTED = {
    "get_playbook",
    "list_layouts",
    "list_themes",
    "validate_spec",
    "render_carousel",
    "preview_slide",
    "fetch_asset",
    "make_chart",
    "make_diagram",
}


def test_all_nine_tools_exist() -> None:
    assert {tool["name"] for tool in anthropic_tools()} == EXPECTED
    assert {schema for schema in tool_input_schemas()} == EXPECTED


def test_anthropic_shape() -> None:
    for tool in anthropic_tools():
        assert set(tool) == {"name", "description", "input_schema"}
        assert tool["input_schema"]["type"] == "object"
        assert len(tool["description"]) > 20


def test_openai_shapes() -> None:
    responses = openai_tools()
    assert all(tool["type"] == "function" and "parameters" in tool for tool in responses)
    chat = openai_chat_tools()
    assert all("function" in tool and "name" in tool["function"] for tool in chat)
    assert openai_tools(strict=True)[0]["strict"] is True


def test_schemas_are_json_serialisable() -> None:
    blob = json.dumps(tool_input_schemas())
    assert '"render_carousel"' in blob
    assert "output_mode" in blob


def test_render_spec_schema_requires_a_spec() -> None:
    schema = tool_input_schemas()["render_carousel"]
    assert "spec" in schema["required"]
    assert schema["additionalProperties"] is False


def test_anthropic_native_mcp_requires_a_toolset() -> None:
    fragment = anthropic_mcp_server("https://example.com/mcp", authorization_token="secret")
    assert fragment["betas"] == ["mcp-client-2025-11-20"]
    assert fragment["mcp_servers"][0]["url"] == "https://example.com/mcp"
    assert fragment["mcp_servers"][0]["authorization_token"] == "secret"
    # The API rejects a server without a matching mcp_toolset entry.
    assert fragment["tools"][0]["type"] == "mcp_toolset"
    assert fragment["tools"][0]["mcp_server_name"] == "omni-carousel"


def test_openai_native_mcp_tool() -> None:
    tool = openai_mcp_tool("https://example.com/mcp", authorization_token="secret")
    assert tool["type"] == "mcp"
    assert tool["server_url"] == "https://example.com/mcp"
    assert tool["require_approval"] == "never"
    assert tool["headers"]["Authorization"] == "Bearer secret"


def test_mcp_server_config_variants() -> None:
    stdio = mcp_server_config()
    assert stdio["mcpServers"]["omni-carousel"]["command"] == "npx"
    http = mcp_server_config(mode="http", url="https://example.com/mcp", token="t")
    assert http["mcpServers"]["omni-carousel"]["headers"]["Authorization"] == "Bearer t"
