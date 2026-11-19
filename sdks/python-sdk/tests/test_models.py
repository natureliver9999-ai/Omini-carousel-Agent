"""The Pydantic contract must accept exactly what the Zod contract accepts."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from omni_carousel import CarouselSpec, parse_spec
from omni_carousel import models

REPO = Path(__file__).resolve().parents[3]
EXAMPLES = REPO / "examples" / "specs"


def test_examples_exist() -> None:
    assert len(list(EXAMPLES.glob("*.json"))) >= 7


@pytest.mark.parametrize("path", sorted(EXAMPLES.glob("*.json")), ids=lambda p: p.stem)
def test_every_shipped_spec_parses(path: Path) -> None:
    spec = parse_spec(json.loads(path.read_text()))
    assert isinstance(spec, CarouselSpec)
    assert 2 <= len(spec.slides) <= 20
    assert spec.slides[0].layout == "cover_hook"
    assert spec.slides[-1].layout == "cta"


def test_round_trip_is_lossless() -> None:
    raw = json.loads((EXAMPLES / "ig-contrast-myths.json").read_text())
    spec = parse_spec(raw)
    again = CarouselSpec.model_validate(spec.to_payload())
    assert again.to_payload() == spec.to_payload()


def test_unknown_layout_is_rejected() -> None:
    with pytest.raises(ValidationError):
        CarouselSpec.model_validate(
            {
                "version": "1.0",
                "platform": "instagram",
                "slides": [{"layout": "marquee", "headline": "nope"}, {"layout": "cta", "headline": "x", "text": "y", "action": "save"}],
            }
        )


def test_extra_fields_are_rejected() -> None:
    with pytest.raises(ValidationError):
        CarouselSpec.model_validate(
            {
                "version": "1.0",
                "platform": "instagram",
                "slides": [{"layout": "cover_hook", "headline": "Hi", "font_size": 92}],
            }
        )


def test_single_slide_deck_is_rejected() -> None:
    with pytest.raises(ValidationError):
        CarouselSpec.model_validate(
            {"version": "1.0", "platform": "instagram", "slides": [{"layout": "cover_hook", "headline": "Only one"}]}
        )


def test_layout_union_covers_every_documented_layout() -> None:
    documented = {
        "cover_hook",
        "contrast_split",
        "layer_stack",
        "bento_grid",
        "reveal_hold",
        "scrapbook",
        "data_chart",
        "steps",
        "proof",
        "summary",
        "cta",
    }
    assert set(models.SlideLayout.__args__) == documented


def test_schema_matches_the_engine_json_schema() -> None:
    engine = json.loads((REPO / "spec" / "carousel.schema.json").read_text())
    variants = engine["definitions"]["CarouselSpec"]["properties"]["slides"]["items"]["anyOf"]
    engine_layouts = {variant["properties"]["layout"]["const"] for variant in variants}
    assert engine_layouts == set(models.SlideLayout.__args__)


def test_bad_hex_accent_is_rejected() -> None:
    with pytest.raises(ValidationError):
        CarouselSpec.model_validate(
            {
                "version": "1.0",
                "platform": "instagram",
                "brand": {"name": "X", "accent_override": "rebeccapurple"},
                "slides": [{"layout": "cover_hook", "headline": "Hi"}, {"layout": "cta", "headline": "Bye", "text": "t", "action": "save"}],
            }
        )


def test_chart_lengths_must_match() -> None:
    with pytest.raises(ValidationError):
        CarouselSpec.model_validate(
            {
                "version": "1.0",
                "platform": "instagram",
                "slides": [
                    {"layout": "cover_hook", "headline": "Hi"},
                    {
                        "layout": "data_chart",
                        "headline": "Chart",
                        "chart": {"kind": "bar", "labels": ["a", "b"], "values": [1.0]},
                        "source": "Socialinsider 2026",
                    },
                    {"layout": "cta", "headline": "Bye", "text": "t", "action": "save"},
                ],
            }
        )
