"""Conformance tests for the FastMCP surface.

The Python server must expose the same nine tools, three resources and one prompt
as the TypeScript server — hosts should be able to switch transports, not contracts.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

pytest.importorskip("fastmcp")

from fastmcp import Client  # noqa: E402

from omni_carousel_mcp.server import create_carousel, mcp  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
ENGINE = REPO / "core-engine" / "dist" / "cli.js"

EXPECTED_TOOLS = {
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

needs_engine = pytest.mark.skipif(not (shutil.which("node") and ENGINE.is_file()), reason="engine CLI not built")


@pytest.mark.asyncio
async def test_exposes_the_nine_tools() -> None:
    async with Client(mcp) as client:
        tools = await client.list_tools()
    assert {tool.name for tool in tools} == EXPECTED_TOOLS


@pytest.mark.asyncio
async def test_every_tool_is_described() -> None:
    async with Client(mcp) as client:
        tools = await client.list_tools()
    for tool in tools:
        assert tool.description and len(tool.description) > 20
        assert (getattr(tool, "input_schema", None) or tool.inputSchema)["type"] == "object"


@pytest.mark.asyncio
async def test_resources_and_prompt() -> None:
    async with Client(mcp) as client:
        resources = await client.list_resources()
        templates = await client.list_resource_templates()
        prompts = await client.list_prompts()
    uris = {str(resource.uri) for resource in resources}
    assert "carousel://playbook" in uris
    assert "carousel://schema.json" in uris
    assert any("themes" in str(getattr(template, "uri_template", None) or template.uriTemplate) for template in templates)
    assert "create_carousel" in {prompt.name for prompt in prompts}


@pytest.mark.asyncio
@needs_engine
async def test_call_list_layouts() -> None:
    async with Client(mcp) as client:
        result = await client.call_tool("list_layouts", {})
    payload = json.loads(result.content[0].text)
    assert len(payload["layouts"]) == 11


@pytest.mark.asyncio
@needs_engine
async def test_call_validate_spec_reports_errors() -> None:
    spec = json.loads((REPO / "examples" / "specs" / "ig-contrast-myths.json").read_text())
    spec["slides"] = spec["slides"][::-1]
    async with Client(mcp) as client:
        result = await client.call_tool("validate_spec", {"spec": spec})
    assert "FIRST_SLIDE_NOT_COVER" in result.content[0].text


def test_prompt_lists_the_pipeline() -> None:
    text = create_carousel("retention loops", "instagram", "saves")
    for expected in ("get_playbook", "validate_spec", "render_carousel", "7-10 slides"):
        assert expected in text


@pytest.mark.asyncio
@needs_engine
async def test_schema_resource_is_valid_json() -> None:
    async with Client(mcp) as client:
        contents = await client.read_resource("carousel://schema.json")
    payload = json.loads(contents[0].text)
    assert "render_carousel" in payload


@pytest.mark.asyncio
@needs_engine
async def test_unknown_theme_resource_errors() -> None:
    async with Client(mcp) as client:
        with pytest.raises(Exception):
            await client.read_resource("carousel://themes/does-not-exist")
