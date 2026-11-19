"""`omni-carousel-py` — a thin Python CLI over the SDK.

    omni-carousel-py doctor
    omni-carousel-py validate spec.json
    omni-carousel-py render spec.json --out ./carousels --theme editorial
    omni-carousel-py tools [--format anthropic|openai|mcp]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .runner import EngineNotFoundError, handle_tool_call, resolve_cli
from .tools import anthropic_tools, mcp_server_config, openai_tools, tool_input_schemas


def _load(path: str) -> dict:
    if path == "-":
        return json.load(sys.stdin)
    return json.loads(Path(path).read_text())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="omni-carousel-py", description=f"omni-carousel Python SDK {__version__}")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("doctor", help="Show the resolved engine CLI and environment")
    sub.add_parser("version", help="Print the SDK version")

    validate = sub.add_parser("validate", help="Validate and lint a CarouselSpec")
    validate.add_argument("spec")
    validate.add_argument("--json", action="store_true")

    render = sub.add_parser("render", help="Render a CarouselSpec")
    render.add_argument("spec")
    render.add_argument("--out")
    render.add_argument("--theme")
    render.add_argument("--formats")
    render.add_argument("--strict", action="store_true")
    render.add_argument("--json", action="store_true")

    tools_cmd = sub.add_parser("tools", help="Print tool definitions")
    tools_cmd.add_argument("--format", default="anthropic", choices=["anthropic", "openai", "mcp", "config"])

    args = parser.parse_args(argv)

    if args.command in (None, "version"):
        print(__version__)
        return 0

    if args.command == "doctor":
        try:
            print(f"sdk        {__version__}")
            print(f"engine     {' '.join(resolve_cli())}")
        except EngineNotFoundError as error:
            print(error)
            return 1
        result = handle_tool_call("list_themes", {})
        print(result.text[:600])
        return 0

    if args.command == "validate":
        result = handle_tool_call("validate_spec", {"spec": _load(args.spec)})
        if args.json:
            print(result.text)
        else:
            data = result.data or {}
            lint = (data.get("lint") or {})
            status = "PASS" if lint.get("ok") else "FAIL"
            print(f"{status} — {json.dumps(lint.get('metrics', {}))}")
            for issue in (lint.get("errors") or []) + (lint.get("warnings") or []):
                print(f"  {issue['severity']:5} {issue['code']} [{issue['path']}] {issue['message']}")
        return 0 if not result.is_error else 1

    if args.command == "render":
        result = handle_tool_call(
            "render_carousel",
            {
                "spec": _load(args.spec),
                "output_dir": args.out,
                "theme": args.theme,
                "formats": args.formats.split(",") if args.formats else None,
                "strict": args.strict,
            },
        )
        if args.json or result.is_error:
            print(result.text)
        else:
            data = result.data or {}
            print(f"Rendered {len(data.get('slides', []))} slides in {data.get('duration_ms')}ms via {data.get('renderer')}")
            for key, value in (data.get("files") or {}).items():
                print(f"  {key:9} {value}")
        return 0 if not result.is_error else 1

    if args.command == "tools":
        if args.format == "anthropic":
            print(json.dumps(anthropic_tools(), indent=2))
        elif args.format == "openai":
            print(json.dumps(openai_tools(), indent=2))
        elif args.format == "mcp":
            print(json.dumps(tool_input_schemas(), indent=2))
        else:
            print(json.dumps(mcp_server_config(), indent=2))
        return 0

    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
