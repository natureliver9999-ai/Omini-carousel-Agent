"""Typed models for the carousel contract.

These deliberately mirror ``spec/carousel.schema.json`` (which is generated from
the TypeScript Zod source). ``tests/test_schema_parity.py`` fails if the two drift,
so there is exactly one contract even across languages.
"""

from __future__ import annotations

from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

SPEC_VERSION = "1.0"

SlideLayout = Literal[
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
]

Platform = Literal["instagram", "linkedin", "generic"]
Goal = Literal["awareness", "saves", "authority", "leads", "community"]
CtaAction = Literal["save", "comment", "follow", "link_in_caption", "share"]
ChartKind = Literal["bar", "horizontal_bar", "line", "donut"]
BgToken = Literal["primary", "secondary", "surface", "elevated", "accent"]

HexColor = Annotated[str, Field(pattern=r"^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Panorama(_Model):
    span: int = Field(ge=2, le=6, description="Consecutive slides sharing one wide canvas.")
    index: Optional[int] = Field(default=None, ge=0)


class SlideBase(_Model):
    id: Optional[str] = Field(default=None, pattern=r"^[a-z0-9][a-z0-9-]{0,40}$")
    eyebrow: Optional[str] = Field(default=None, max_length=48)
    headline: str = Field(min_length=1, max_length=180)
    footer_hook: Optional[str] = Field(default=None, max_length=64)
    bg: Optional[BgToken] = None
    accent: Optional[bool] = None
    alt_text: Optional[str] = Field(default=None, max_length=280)
    notes: Optional[str] = Field(default=None, max_length=400)
    panorama: Optional[Panorama] = None


class CoverHookSlide(SlideBase):
    layout: Literal["cover_hook"]
    sub: Optional[str] = Field(default=None, max_length=180)
    badge: Optional[str] = Field(default=None, max_length=40)
    icon: Optional[str] = Field(default=None, max_length=40)
    kicker: Optional[str] = Field(default=None, max_length=60)


class ContrastSide(_Model):
    label: str = Field(min_length=1, max_length=40)
    text: Optional[str] = Field(default=None, max_length=220)
    items: Optional[list[Annotated[str, Field(max_length=90)]]] = Field(default=None, max_length=4)
    icon: Optional[str] = Field(default=None, max_length=40)


class ContrastSplitSlide(SlideBase):
    layout: Literal["contrast_split"]
    mode: Literal["split", "before", "after"] = "split"
    pair: Optional[str] = Field(default=None, pattern=r"^[a-z0-9-]{1,24}$")
    left: ContrastSide
    right: ContrastSide
    verdict: Optional[str] = Field(default=None, max_length=120)


class Layer(_Model):
    label: str = Field(min_length=1, max_length=60)
    detail: Optional[str] = Field(default=None, max_length=140)


class LayerStackSlide(SlideBase):
    layout: Literal["layer_stack"]
    layers: list[Layer] = Field(min_length=2, max_length=5)
    active_layers: Optional[int] = Field(default=None, ge=1, le=5)
    total_layers: Optional[int] = Field(default=None, ge=2, le=5)


class BentoTile(_Model):
    label: str = Field(min_length=1, max_length=40)
    value: Optional[str] = Field(default=None, max_length=16)
    text: Optional[str] = Field(default=None, max_length=80)
    span: Optional[Literal[1, 2]] = None
    accent: Optional[bool] = None
    icon: Optional[str] = Field(default=None, max_length=40)


class BentoGridSlide(SlideBase):
    layout: Literal["bento_grid"]
    tiles: list[BentoTile] = Field(min_length=4, max_length=9)


class RevealHoldSlide(SlideBase):
    layout: Literal["reveal_hold"]
    body: str = Field(min_length=1, max_length=360)
    teaser_label: str = Field(min_length=1, max_length=32)
    bleed_ratio: Optional[float] = Field(default=None, ge=0.05, le=0.2)


class ScrapbookSlide(SlideBase):
    layout: Literal["scrapbook"]
    note: str = Field(min_length=1, max_length=420)
    callout: Optional[str] = Field(default=None, max_length=120)
    sticker: Optional[str] = Field(default=None, max_length=24)
    underline_word: Optional[str] = Field(default=None, max_length=40)


class Chart(_Model):
    kind: ChartKind
    labels: list[Annotated[str, Field(max_length=24)]] = Field(min_length=2, max_length=8)
    values: list[float] = Field(min_length=2, max_length=8)
    unit: Optional[str] = Field(default=None, max_length=12)
    max: Optional[float] = Field(default=None, gt=0)
    highlight: Optional[int] = Field(default=None, ge=0)

    @field_validator("values")
    @classmethod
    def _lengths_match(cls, values, info):  # noqa: ANN001, ANN206
        labels = info.data.get("labels")
        if labels is not None and len(labels) != len(values):
            raise ValueError("chart.labels and chart.values must be the same length")
        return values


class DataChartSlide(SlideBase):
    layout: Literal["data_chart"]
    chart: Chart
    takeaway: Optional[str] = Field(default=None, max_length=140)
    source: str = Field(min_length=1, max_length=160)


class Step(_Model):
    title: str = Field(min_length=1, max_length=70)
    detail: Optional[str] = Field(default=None, max_length=180)


class StepsSlide(SlideBase):
    layout: Literal["steps"]
    steps: list[Step] = Field(min_length=2, max_length=5)
    emphasis: Optional[Literal["numbered", "checklist"]] = None


class ProofSlide(SlideBase):
    layout: Literal["proof"]
    metric_value: str = Field(min_length=1, max_length=16)
    metric_label: str = Field(min_length=1, max_length=60)
    finding: str = Field(min_length=1, max_length=400)
    source: str = Field(min_length=1, max_length=160)
    attribution: Optional[str] = Field(default=None, max_length=80)


class SummarySlide(SlideBase):
    layout: Literal["summary"]
    bullets: list[Annotated[str, Field(max_length=100)]] = Field(min_length=3, max_length=6)
    save_prompt: Optional[str] = Field(default=None, max_length=90)


class CtaSlide(SlideBase):
    layout: Literal["cta"]
    action: CtaAction
    keyword: Optional[str] = Field(default=None, max_length=24)
    text: str = Field(min_length=1, max_length=240)
    handle: Optional[str] = Field(default=None, max_length=40)


Slide = Annotated[
    Union[
        CoverHookSlide,
        ContrastSplitSlide,
        LayerStackSlide,
        BentoGridSlide,
        RevealHoldSlide,
        ScrapbookSlide,
        DataChartSlide,
        StepsSlide,
        ProofSlide,
        SummarySlide,
        CtaSlide,
    ],
    Field(discriminator="layout"),
]


class Brand(_Model):
    name: str = Field(min_length=1, max_length=48)
    handle: Optional[str] = Field(default=None, max_length=40)
    website: Optional[str] = Field(default=None, max_length=90)
    accent_override: Optional[HexColor] = None
    mark: Optional[str] = Field(default=None, max_length=4)


class Caption(_Model):
    text: str = Field(max_length=3200)
    hashtags: Optional[list[Annotated[str, Field(max_length=40)]]] = Field(default=None, max_length=30)
    first_comment: Optional[str] = Field(default=None, max_length=600)


class Meta(_Model):
    author: Optional[str] = Field(default=None, max_length=80)
    language: str = Field(default="en", min_length=2, max_length=12)
    sources: Optional[list[Annotated[str, Field(max_length=200)]]] = Field(default=None, max_length=30)
    notes: Optional[str] = Field(default=None, max_length=600)
    created_at: Optional[str] = None


class ThemeOverride(_Model):
    colors: Optional[dict[str, HexColor]] = None
    typography: Optional[dict[str, float]] = None
    radii: Optional[dict[str, float]] = None


class CarouselSpec(_Model):
    version: Literal["1.0"] = SPEC_VERSION
    id: Optional[str] = Field(default=None, pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")
    title: Optional[str] = Field(default=None, max_length=140)
    platform: Platform
    goal: Goal = "saves"
    theme: str = "editorial"
    theme_override: Optional[ThemeOverride] = None
    brand: Optional[Brand] = None
    caption: Optional[Caption] = None
    cta_link: Optional[str] = Field(default=None, max_length=200)
    slides: list[Slide] = Field(min_length=2, max_length=20)
    meta: Meta = Field(default_factory=Meta)

    def to_payload(self) -> dict:
        """JSON-ready dict with None values stripped, matching the TS shape."""
        return self.model_dump(mode="json", exclude_none=True)


def parse_spec(data: dict) -> CarouselSpec:
    """Validates a raw dict, raising a readable error on failure."""
    return CarouselSpec.model_validate(data)


__all__ = [
    "SPEC_VERSION",
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
    "Slide",
    "Brand",
    "Caption",
    "Meta",
    "CarouselSpec",
    "parse_spec",
]
