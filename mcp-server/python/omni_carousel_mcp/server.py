"""FastMCP wrapper around the shared engine.

Design choice: this server does **not** re-implement rendering. Every tool call is
delegated to the `omni-carousel` CLI through ``omni_carousel.runner``, so the
Python and TypeScript servers cannot drift — they are two doors into one engine.

Compatibility: works with the standalone ``fastmcp`` package (``transport="http"``)
and with the official ``mcp`` SDK's bundled FastMCP (``transport="streamable-http"``).
"""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Optional

try:  # standalone FastMCP (preferred in 2026)
    from fastmcp import FastMCP

    _FASTMCP_FLAVOR = "fastmcp"
except ImportError:  # official mcp SDK fallback
    from mcp.server.fastmcp import FastMCP  # type: ignore[no-redef]

    _FASTMCP_FLAVOR = "mcp"

from omni_carousel import TOOL_DESCRIPTIONS, __version__ as sdk_version, handle_tool_call, resolve_cli
from omni_carousel.tools import tool_input_schemas

INSTRUCTIONS = """Omni Carousel turns a topic into a publish-ready carousel: 1080x1350 Instagram PNG slides,
a multi-page LinkedIn PDF, seamless panorama spans, a captioned HTML deck and a ZIP bundle with provenance.

Workflow:
1. get_playbook(topic) — read the rules for the target platform.
2. Plan a CarouselSpec: 7-10 slides for Instagram, 5-10 pages for LinkedIn; cover_hook first, cta last.
3. validate_spec(spec) — fix every error before rendering.
4. render_carousel(spec) — return the slides and the caption.

Never invent statistics, quotes or case studies. proof and data_chart slides require a named source."""

try:
    mcp = FastMCP("omni-carousel", version="0.1.0", instructions=INSTRUCTIONS)
except TypeError:  # older FastMCP builds do not accept `version`
    mcp = FastMCP("omni-carousel", instructions=INSTRUCTIONS)


def _dispatch(name: str, arguments: dict[str, Any]) -> str:
    result = handle_tool_call(name, arguments)
    if result.is_error:
        raise RuntimeError(result.text)
    return result.text


@mcp.tool(name="get_playbook", description=TOOL_DESCRIPTIONS["get_playbook"])
def get_playbook(topic: str = "all") -> str:
    """Read the carousel craft rules.

    Args:
        topic: instagram | linkedin | hooks | patterns | layouts | all
    """
    return _dispatch("get_playbook", {"topic": topic})


@mcp.tool(name="list_layouts", description=TOOL_DESCRIPTIONS["list_layouts"])
def list_layouts() -> str:
    """List the 11 typed slide layouts with role, density, copy budget and icon names."""
    return _dispatch("list_layouts", {})


@mcp.tool(name="list_themes", description=TOOL_DESCRIPTIONS["list_themes"])
def list_themes() -> str:
    """List the bundled WCAG-audited themes and their accent colours."""
    return _dispatch("list_themes", {})


@mcp.tool(name="validate_spec", description=TOOL_DESCRIPTIONS["validate_spec"])
def validate_spec(spec: dict[str, Any]) -> str:
    """Validate and lint a CarouselSpec before rendering.

    Args:
        spec: the CarouselSpec object (see carousel://schema.json)
    """
    return _dispatch("validate_spec", {"spec": spec})


@mcp.tool(name="render_carousel", description=TOOL_DESCRIPTIONS["render_carousel"])
def render_carousel(
    spec: dict[str, Any],
    output_mode: str = "path",
    theme: Optional[str] = None,
    formats: Optional[list[str]] = None,
    strict: bool = False,
) -> str:
    """Render a validated CarouselSpec to slides, PDF, HTML deck and ZIP bundle.

    Args:
        spec: the CarouselSpec object
        output_mode: path | url | inline
        theme: optional theme id override
        formats: subset of png,pdf,zip,html,json,caption
        strict: refuse to render when the linter reports errors
    """
    return _dispatch(
        "render_carousel",
        {"spec": spec, "output_mode": output_mode, "theme": theme, "formats": formats, "strict": strict},
    )


@mcp.tool(name="preview_slide", description=TOOL_DESCRIPTIONS["preview_slide"])
def preview_slide(spec: dict[str, Any], slide_index: int, theme: Optional[str] = None) -> str:
    """Render a single slide as a PNG (path returned).

    Args:
        spec: the CarouselSpec object
        slide_index: 0-based index
        theme: optional theme override
    """
    return _dispatch("preview_slide", {"spec": spec, "slide_index": slide_index, "theme": theme})


@mcp.tool(name="fetch_asset", description=TOOL_DESCRIPTIONS["fetch_asset"])
def fetch_asset(
    provider: str = "pattern",
    query: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    accent: Optional[str] = None,
) -> str:
    """Fetch a license-tracked asset (or generated art when no key is configured).

    Args:
        provider: unsplash | pexels | pattern
        query: search term or generation seed
        width: desired width
        height: desired height
        accent: hex accent for generated art
    """
    return _dispatch(
        "fetch_asset",
        {"provider": provider, "query": query, "width": width, "height": height, "accent": accent},
    )


@mcp.tool(name="make_chart", description=TOOL_DESCRIPTIONS["make_chart"])
def make_chart(
    chart: dict[str, Any],
    theme: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    title: Optional[str] = None,
) -> str:
    """Draw a chart from explicit numbers.

    Args:
        chart: { kind, labels[], values[], unit?, max?, highlight? }
        theme: optional theme id
        width: output width in px
        height: output height in px
        title: optional chart title
    """
    return _dispatch(
        "make_chart", {"chart": chart, "theme": theme, "width": width, "height": height, "title": title}
    )


@mcp.tool(name="make_diagram", description=TOOL_DESCRIPTIONS["make_diagram"])
def make_diagram(source: str, theme: Optional[str] = None, direction: str = "LR", title: Optional[str] = None) -> str:
    """Render a Mermaid-style diagram as SVG.

    Args:
        source: Mermaid-like source, e.g. "flowchart LR\\nA[Intent] --> B[Spec]"
        theme: optional theme id
        direction: LR | TD
        title: optional diagram title
    """
    return _dispatch(
        "make_diagram", {"source": source, "theme": theme, "direction": direction, "title": title}
    )


@mcp.resource("carousel://playbook", mime_type="text/markdown")
def playbook_resource() -> str:
    """The full carousel playbook as markdown."""
    return _dispatch("get_playbook", {"topic": "all"})


@mcp.resource("carousel://schema.json", mime_type="application/schema+json")
def schema_resource() -> str:
    """JSON Schema for every tool input (and therefore for CarouselSpec)."""
    return json.dumps(tool_input_schemas(), indent=2)


@mcp.resource("carousel://themes/{theme_id}", mime_type="application/json")
def theme_resource(theme_id: str) -> str:
    """One theme's tokens, as JSON."""
    themes = json.loads(_dispatch("list_themes", {}))
    for theme in themes.get("themes", []):
        if theme.get("id") == theme_id:
            return json.dumps(theme, indent=2)
    raise ValueError(f"Unknown theme '{theme_id}'. Available: {[t.get('id') for t in themes.get('themes', [])]}")


@mcp.prompt(name="create_carousel", description="Draft, validate and render a carousel for a topic.")
def create_carousel(topic: str, platform: str = "instagram", goal: str = "saves") -> str:
    """Prompt template that walks the model through the pipeline."""
    return (
        f"Create a {platform} carousel about: {topic}\n"
        f"Primary goal: {goal}.\n\n"
        "Process:\n"
        f'1. Call get_playbook(topic="{platform}") and follow it exactly.\n'
        "2. Draft a CarouselSpec: cover_hook first, cta last, "
        f"{'7-10 slides' if platform == 'instagram' else '5-10 pages'}.\n"
        "3. Call validate_spec and fix every error. Do not render with errors outstanding.\n"
        "4. Call render_carousel, then present the slides and the caption verbatim.\n\n"
        "Hard rules: no invented statistics or quotes; proof and data_chart slides need a named source; one CTA only."
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="omni-carousel-mcp-py",
        description=f"FastMCP server for omni-carousel {sdk_version} ({_FASTMCP_FLAVOR} flavor)",
    )
    parser.add_argument("--transport", default="stdio", choices=["stdio", "http", "sse"])
    parser.add_argument("--host", default=os.environ.get("OMNI_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("OMNI_PORT", "8765")))
    parser.add_argument("--path", default="/mcp")
    parser.add_argument("--version", action="store_true")
    parser.add_argument("--doctor", action="store_true")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)

    if args.version:
        print(f"omni-carousel-mcp (python) {sdk_version} · flavor={_FASTMCP_FLAVOR}")
        return 0

    if args.doctor:
        print(f"flavor   {_FASTMCP_FLAVOR}")
        print(f"engine   {' '.join(resolve_cli())}")
        print(f"tools    {', '.join(sorted(TOOL_DESCRIPTIONS))}")
        return 0

    if args.transport == "stdio":
        mcp.run(transport="stdio")
        return 0

    transport = "http" if _FASTMCP_FLAVOR == "fastmcp" else "streamable-http"
    try:
        mcp.run(transport=transport, host=args.host, port=args.port, path=args.path)  # type: ignore[call-arg]
    except TypeError:
        # Some builds do not accept `path`; fall back to host/port only.
        mcp.run(transport=transport, host=args.host, port=args.port)  # type: ignore[call-arg]
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
