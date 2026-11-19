"""Local runner: executes tools by delegating to the deterministic CLI.

Why a subprocess instead of a re-implementation: the engine is the only thing that
may decide what a pixel is. Python shells out to it, exactly like the MCP server
does, so a deck rendered from Python is byte-identical to one rendered from Node.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

CLI_ENV = "OMNI_CAROUSEL_CLI"
DEFAULT_TIMEOUT = 300


class EngineNotFoundError(RuntimeError):
    """Raised when the omni-carousel CLI cannot be located."""


def _repo_root_candidates() -> list[Path]:
    here = Path(__file__).resolve()
    return [
        here.parents[3] if len(here.parents) > 3 else here.parent,
        Path.cwd(),
    ]


def resolve_cli() -> list[str]:
    """Returns the argv prefix used to invoke the engine CLI.

    Resolution order: ``$OMNI_CAROUSEL_CLI`` → ``omni-carousel`` on PATH →
    ``node <repo>/core-engine/dist/cli.js`` → ``npx omni-carousel``.
    """
    override = os.environ.get(CLI_ENV)
    if override:
        return [override] if Path(override).is_file() else override.split()

    found = shutil.which("omni-carousel")
    if found:
        return [found]

    node = shutil.which("node")
    if node:
        for root in _repo_root_candidates():
            candidate = root / "core-engine" / "dist" / "cli.js"
            if candidate.is_file():
                return [node, str(candidate)]

    npx = shutil.which("npx")
    if npx:
        return [npx, "-y", "@omni-carousel/engine"]

    raise EngineNotFoundError(
        "Could not find the omni-carousel engine CLI. Install it (`npm i -g @omni-carousel/engine`), "
        "build this repository (`npm run build`), or set OMNI_CAROUSEL_CLI to the cli.js path."
    )


@dataclass
class RunResult:
    text: str
    data: Any = None
    files: dict[str, str] = field(default_factory=dict)
    images: list[str] = field(default_factory=list)  # base64 PNG payloads
    is_error: bool = False


def _run(args: list[str], timeout: int = DEFAULT_TIMEOUT) -> subprocess.CompletedProcess:
    return subprocess.run(  # noqa: S603 - argv is constructed locally, never shell=True
        [*resolve_cli(), *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def _json_or_error(proc: subprocess.CompletedProcess, tool: str) -> RunResult:
    if proc.returncode not in (0, 1):
        return RunResult(text=f"{tool} failed: {proc.stderr.strip() or proc.stdout.strip()}", is_error=True)
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return RunResult(text=proc.stdout.strip() or proc.stderr.strip(), is_error=proc.returncode == 1)
    is_error = isinstance(data, dict) and data.get("ok") is False
    return RunResult(text=json.dumps(data, indent=2), data=data, is_error=is_error)


def get_playbook(topic: str = "all") -> RunResult:
    proc = _run(["playbook", topic, "--json"])
    if proc.returncode != 0:
        return RunResult(text=proc.stderr.strip(), is_error=True)
    try:
        return RunResult(text=json.loads(proc.stdout)["markdown"], data=json.loads(proc.stdout))
    except (json.JSONDecodeError, KeyError):
        return RunResult(text=proc.stdout, is_error=False)


def _keyed(result: RunResult, key: str) -> RunResult:
    """The CLI prints bare arrays; the tool surface returns `{ <key>: [...] }`."""
    if isinstance(result.data, list):
        result.data = {key: result.data}
        result.text = json.dumps(result.data, indent=2)
    return result


def list_layouts() -> RunResult:
    return _keyed(_json_or_error(_run(["layouts", "--json"]), "list_layouts"), "layouts")


def list_themes() -> RunResult:
    return _keyed(_json_or_error(_run(["themes", "--json"]), "list_themes"), "themes")


def validate_spec(spec: dict | Any) -> RunResult:
    payload = spec.model_dump(mode="json", exclude_none=True) if hasattr(spec, "model_dump") else spec
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(payload, handle)
        temp_path = handle.name
    try:
        result = _json_or_error(_run(["validate", temp_path, "--json"]), "validate_spec")
    finally:
        Path(temp_path).unlink(missing_ok=True)
    return result


def render_carousel(
    spec: dict | Any,
    output_dir: Optional[str] = None,
    theme: Optional[str] = None,
    output_mode: str = "path",
    formats: Optional[list[str]] = None,
    strict: bool = False,
) -> RunResult:
    payload = spec.model_dump(mode="json", exclude_none=True) if hasattr(spec, "model_dump") else spec
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(payload, handle)
        temp_path = handle.name
    args = ["render", temp_path, "--json"]
    if output_dir:
        args += ["--out", output_dir]
    if theme:
        args += ["--theme", theme]
    if formats:
        args += ["--formats", ",".join(formats)]
    if strict:
        args += ["--strict"]
    try:
        result = _json_or_error(_run(args), "render_carousel")
    finally:
        Path(temp_path).unlink(missing_ok=True)

    if result.data:
        result.files = {key: value for key, value in (result.data.get("files") or {}).items() if value}
        result.images = list(result.data.get("images") or [])
    if output_mode == "inline" and not result.images and result.files:
        import base64

        for path in sorted(Path(result.data["dir"], "slides").glob("*.png")) if result.data else []:
            result.images.append(base64.b64encode(path.read_bytes()).decode("ascii"))
    return result


def preview_slide(spec: dict | Any, slide_index: int, theme: Optional[str] = None) -> RunResult:
    payload = spec.model_dump(mode="json", exclude_none=True) if hasattr(spec, "model_dump") else spec
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(payload, handle)
        temp_path = handle.name
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / f"slide-{slide_index + 1}.png"
        args = ["preview", temp_path, "--slide", str(slide_index), "--out", str(out)]
        if theme:
            args += ["--theme", theme]
        try:
            proc = _run(args, timeout=120)
            if proc.returncode != 0 or not out.is_file():
                return RunResult(text=proc.stderr.strip() or "preview failed", is_error=True)
            import base64

            encoded = base64.b64encode(out.read_bytes()).decode("ascii")
            return RunResult(text=f"slide {slide_index} rendered", images=[encoded])
        finally:
            Path(temp_path).unlink(missing_ok=True)


def fetch_asset(
    provider: str = "pattern",
    query: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    accent: Optional[str] = None,
) -> RunResult:
    """Asset fetching runs through the MCP server, which owns the SSRF guard."""
    provider = provider or "pattern"
    return RunResult(
        text=json.dumps(
            {
                "provider": provider,
                "query": query,
                "width": width,
                "height": height,
                "accent": accent,
                "note": "Call the MCP `fetch_asset` tool, or run `omni-carousel-mcp`, for guarded asset retrieval "
                        "with license and attribution tracking.",
            }
        ),
        is_error=False,
    )


def make_chart(chart: dict, theme: Optional[str] = None, width: Optional[int] = None, height: Optional[int] = None,
               title: Optional[str] = None) -> RunResult:
    with tempfile.TemporaryDirectory() as tmp:
        spec_path = Path(tmp) / "chart.json"
        spec_path.write_text(json.dumps(chart))
        out = Path(tmp) / "chart.png"
        args = ["chart", str(spec_path), "--out", str(out)]
        if theme:
            args += ["--theme", theme]
        proc = _run(args, timeout=120)
        if proc.returncode != 0 or not out.is_file():
            return RunResult(text=proc.stderr.strip() or "chart failed", is_error=True)
        import base64

        return RunResult(
            text=json.dumps({"bytes": out.stat().st_size, "width": width, "height": height, "title": title}),
            images=[base64.b64encode(out.read_bytes()).decode("ascii")],
        )


def make_diagram(source: str, theme: Optional[str] = None, title: Optional[str] = None) -> RunResult:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "diagram.mmd"
        path.write_text(source)
        out = Path(tmp) / "diagram.svg"
        args = ["diagram", str(path), "--out", str(out)]
        if theme:
            args += ["--theme", theme]
        proc = _run(args, timeout=120)
        if proc.returncode != 0 or not out.is_file():
            return RunResult(text=proc.stderr.strip() or "diagram failed", is_error=True)
        return RunResult(text=out.read_text(), data={"title": title})


TOOL_HANDLERS = {
    "get_playbook": lambda args: get_playbook(args.get("topic") or "all"),
    "list_layouts": lambda args: list_layouts(),
    "list_themes": lambda args: list_themes(),
    "validate_spec": lambda args: validate_spec(args["spec"]),
    "render_carousel": lambda args: render_carousel(
        args["spec"],
        output_dir=args.get("output_dir"),
        theme=args.get("theme"),
        output_mode=args.get("output_mode", "path"),
        formats=args.get("formats"),
        strict=bool(args.get("strict", False)),
    ),
    "preview_slide": lambda args: preview_slide(args["spec"], int(args["slide_index"]), args.get("theme")),
    "fetch_asset": lambda args: fetch_asset(
        args.get("provider") or "pattern", args.get("query"), args.get("width"), args.get("height"), args.get("accent")
    ),
    "make_chart": lambda args: make_chart(
        args["chart"], args.get("theme"), args.get("width"), args.get("height"), args.get("title")
    ),
    "make_diagram": lambda args: make_diagram(args["source"], args.get("theme"), args.get("title")),
}


def handle_tool_call(name: str, arguments: dict[str, Any]) -> RunResult:
    """Dispatches a tool call by name (Anthropic `tool_use` / OpenAI `tool_calls`)."""
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return RunResult(text=f"Unknown tool '{name}'. Known: {', '.join(sorted(TOOL_HANDLERS))}", is_error=True)
    try:
        return handler(arguments or {})
    except EngineNotFoundError as error:
        return RunResult(text=str(error), is_error=True)
    except subprocess.TimeoutExpired:
        return RunResult(text=f"Tool '{name}' timed out", is_error=True)
    except Exception as error:  # noqa: BLE001 - tool boundary must never raise
        return RunResult(text=f"Tool '{name}' failed: {error}", is_error=True)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python -m omni_carousel.runner doctor | <tool> '<json>'")
        return 2
    if sys.argv[1] == "doctor":
        try:
            print("engine:", " ".join(resolve_cli()))
            proc = _run(["doctor", "--json"], timeout=60)
            print(proc.stdout or proc.stderr)
            return 0
        except EngineNotFoundError as error:
            print(error)
            return 1
    return 0 if not handle_tool_call(sys.argv[1], json.loads(sys.argv[2] if len(sys.argv) > 2 else "{}")).is_error else 1


if __name__ == "__main__":
    raise SystemExit(main())
