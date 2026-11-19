"""Runner tests: they exercise the real engine CLI when it is built."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from omni_carousel import handle_tool_call, resolve_cli
from omni_carousel.runner import EngineNotFoundError

REPO = Path(__file__).resolve().parents[3]
SPEC = REPO / "examples" / "specs" / "ig-contrast-myths.json"


def engine_available() -> bool:
    if not shutil.which("node"):
        return False
    return (REPO / "core-engine" / "dist" / "cli.js").is_file()


requires_engine = pytest.mark.skipif(not engine_available(), reason="engine not built (npm run build)")


def spec_payload() -> dict:
    return json.loads(SPEC.read_text())


def test_resolve_cli_finds_the_repo_build() -> None:
    if not requires_engine():
        pytest.skip("engine not built")
    assert resolve_cli()[-1].endswith("cli.js") or shutil.which("omni-carousel")


def test_unknown_tool_is_an_error_not_an_exception() -> None:
    result = handle_tool_call("nope", {})
    assert result.is_error is True
    assert "Unknown tool" in result.text


@requires_engine
def test_validate_spec_on_a_shipped_deck() -> None:
    result = handle_tool_call("validate_spec", {"spec": spec_payload()})
    assert result.is_error is False
    report = result.data["lint"]
    assert report["ok"] is True
    assert report["errors"] == []


@requires_engine
def test_validate_spec_catches_a_broken_deck() -> None:
    payload = spec_payload()
    payload["slides"] = payload["slides"][::-1]
    result = handle_tool_call("validate_spec", {"spec": payload})
    codes = {issue["code"] for issue in result.data["lint"]["errors"]}
    assert "FIRST_SLIDE_NOT_COVER" in codes


@requires_engine
def test_render_carousel_writes_a_bundle(tmp_path: Path) -> None:
    result = handle_tool_call(
        "render_carousel",
        {"spec": spec_payload(), "output_dir": str(tmp_path), "formats": ["png", "pdf"]},
    )
    assert result.is_error is False, result.text
    data = result.data
    assert data["renderer"] == "resvg"
    assert len(data["slides"]) >= 6
    pdf = Path(data["files"]["pdf"])
    assert pdf.is_file() and pdf.read_bytes().startswith(b"%PDF-")
    first = sorted((Path(data["dir"]) / "slides").glob("*.png"))[0]
    assert first.read_bytes()[16:20] == (1080).to_bytes(4, "big")


@requires_engine
def test_list_layouts_and_themes() -> None:
    layouts = handle_tool_call("list_layouts", {})
    themes = handle_tool_call("list_themes", {})
    assert len(layouts.data["layouts"]) == 12
    assert any(l["id"] == "generative" for l in layouts.data["layouts"])
    assert {theme["id"] for theme in themes.data["themes"]} >= {"editorial", "brutal-bento", "scrapbook"}


@requires_engine
def test_missing_engine_message_is_actionable() -> None:
    try:
        resolve_cli()
    except EngineNotFoundError as error:  # pragma: no cover - only on a broken checkout
        assert "OMNI_CAROUSEL_CLI" in str(error)


def test_cli_help_runs() -> None:
    proc = subprocess.run([sys.executable, "-m", "omni_carousel.cli", "--help"], capture_output=True, text=True, check=False)
    assert proc.returncode == 0
    assert "omni-carousel-py" in proc.stdout
