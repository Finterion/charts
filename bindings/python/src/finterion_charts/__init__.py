"""Python binding for Finterion Charts.

This package mirrors the JSON `ChartSpec` contract from `@finterion/charts-spec`.
It does not render charts — it produces JSON that the browser-side engine
(`@finterion/charts-core`) consumes.
"""

from .builder import (
    AlignedCurves,
    Branding,
    ChartSpec,
    Display,
    HBar,
    Heatmap,
    Histogram,
    Indicator,
    LineStyle,
    LineStyleName,
    Marker,
    Price,
    Scatter,
    SeriesType,
    SeriesTypeName,
    Theme,
    ThemeName,
    align_by_duration,
)
from .capabilities import ChartCapabilities, get_chart_capabilities
from .codec import decode_spec, encode_spec
from .schema import CHART_SPEC_SCHEMA, SPEC_VERSION
from .validator import ValidationResult, validate_schema, validate_spec

__all__ = [
    "CHART_SPEC_SCHEMA",
    "AlignedCurves",
    "Branding",
    "ChartCapabilities",
    "ChartSpec",
    "Display",
    "HBar",
    "Heatmap",
    "Histogram",
    "Indicator",
    "LineStyle",
    "LineStyleName",
    "Marker",
    "Price",
    "Scatter",
    "SeriesType",
    "SeriesTypeName",
    "SPEC_VERSION",
    "Theme",
    "ThemeName",
    "ValidationResult",
    "align_by_duration",
    "decode_spec",
    "encode_spec",
    "get_chart_capabilities",
    "validate_schema",
    "validate_spec",
]

__version__ = "1.0.0"
