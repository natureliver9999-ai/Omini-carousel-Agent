"""omni-carousel — Python SDK.

    from omni_carousel import CarouselSpec, anthropic_tools, handle_tool_call

    tools = anthropic_tools()
    result = handle_tool_call("validate_spec", {"spec": spec.model_dump(exclude_none=True)})
"""

from __future__ import annotations

from .models import (
    BentoGridSlide,
    BentoTile,
    Brand,
    Caption,
    CarouselSpec,
    Chart,
    ChartKind,
    ContrastSide,
    ContrastSplitSlide,
    CoverHookSlide,
    CtaAction,
    CtaSlide,
    DataChartSlide,
    Goal,
    Layer,
    LayerStackSlide,
    Meta,
    Panorama,
    Platform,
    ProofSlide,
    RevealHoldSlide,
    ScrapbookSlide,
    Slide,
    SlideLayout,
    Step,
    StepsSlide,
    SummarySlide,
    parse_spec,
)
from .runner import (
    EngineNotFoundError,
    RunResult,
    handle_tool_call,
    render_carousel,
    resolve_cli,
    validate_spec,
)
from .tools import (
    TOOL_DESCRIPTIONS,
    anthropic_mcp_server,
    anthropic_tools,
    mcp_server_config,
    openai_chat_tools,
    openai_mcp_tool,
    openai_tools,
    tool_input_schemas,
)

__version__ = "0.1.0"

__all__ = [
    "__version__",
    # models
    "CarouselSpec",
    "Slide",
    "SlideLayout",
    "Platform",
    "Goal",
    "CtaAction",
    "ChartKind",
    "Panorama",
    "CoverHookSlide",
    "ContrastSide",
    "ContrastSplitSlide",
    "Layer",
    "LayerStackSlide",
    "BentoTile",
    "BentoGridSlide",
    "RevealHoldSlide",
    "ScrapbookSlide",
    "Chart",
    "DataChartSlide",
    "Step",
    "StepsSlide",
    "ProofSlide",
    "SummarySlide",
    "CtaSlide",
    "Brand",
    "Caption",
    "Meta",
    "parse_spec",
    # runner
    "RunResult",
    "EngineNotFoundError",
    "resolve_cli",
    "handle_tool_call",
    "validate_spec",
    "render_carousel",
    # tools
    "TOOL_DESCRIPTIONS",
    "tool_input_schemas",
    "anthropic_tools",
    "openai_tools",
    "openai_chat_tools",
    "anthropic_mcp_server",
    "openai_mcp_tool",
    "mcp_server_config",
]
