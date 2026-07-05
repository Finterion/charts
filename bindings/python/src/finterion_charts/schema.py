"""JSON Schema port of `CHART_SPEC_SCHEMA` from `@finterion/charts-spec`.

This file is a 1:1 translation of `packages/spec/src/schema.ts`. Keep it in
sync. A round-trip test in the TS package emits the schema as JSON; the
matching Python test (`tests/test_schema_parity.py`) loads that JSON and asserts
deep equality with this dict.
"""

from __future__ import annotations

from typing import Any

SPEC_VERSION = 1

CHART_SPEC_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://charts.finterion.com/schema/chart-spec.v1.json",
    "title": "Finterion ChartSpec",
    "description": "A JSON-only declarative chart specification, version 1.",
    "type": "object",
    "required": ["version", "panels"],
    "additionalProperties": False,
    "properties": {
        "version": {"const": 1},
        "data": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "bars": {
                    "type": "object",
                    "required": ["time", "open", "high", "low", "close"],
                    "additionalProperties": False,
                    "properties": {
                        "time": {"type": "array", "items": {"type": "number"}},
                        "open": {"type": "array", "items": {"type": "number"}},
                        "high": {"type": "array", "items": {"type": "number"}},
                        "low": {"type": "array", "items": {"type": "number"}},
                        "close": {"type": "array", "items": {"type": "number"}},
                        "volume": {"type": "array", "items": {"type": "number"}},
                    },
                },
                "columns": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "array",
                        "items": {"type": ["number", "null"]},
                    },
                },
                "markers": {
                    "type": "array",
                    "items": {"$ref": "#/$defs/marker"},
                },
            },
        },
        "display": {"$ref": "#/$defs/display"},
        "panels": {
            "type": "array",
            "minItems": 1,
            "items": {"$ref": "#/$defs/panel"},
        },
    },
    "$defs": {
        "formatDirective": {
            "enum": [
                "pct0",
                "pct1",
                "pct2",
                "fixed0",
                "fixed1",
                "fixed2",
                "short-num",
                "iso-date",
            ]
        },
        "color": {"type": "string", "description": "Any CSS color string."},
        "marker": {
            "type": "object",
            "required": ["time", "side", "price"],
            "additionalProperties": False,
            "properties": {
                "time": {"type": "number"},
                "side": {"enum": ["buy", "sell"]},
                "price": {"type": "number"},
                "label": {"type": "string"},
            },
        },
        "display": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "theme": {
                    "enum": [
                        "tradingview-light",
                        "tradingview-dark",
                        "terminal-light",
                        "terminal-dark",
                        "finterion-light",
                        "finterion-dark",
                    ],
                },
                "background": {"$ref": "#/$defs/color"},
                "gridColor": {"$ref": "#/$defs/color"},
                "gridStyle": {"enum": ["none", "horizontal", "full"]},
                "panelGap": {"type": "number", "minimum": 0},
                "titleColor": {"$ref": "#/$defs/color"},
                "titleFontSize": {"type": "number", "minimum": 6},
                "titleSpace": {"type": "number", "minimum": 0},
                "showTimeAxis": {"type": "boolean"},
                "showLegend": {
                    "oneOf": [{"type": "boolean"}, {"const": "auto"}],
                },
                "initialZoom": {
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 100,
                },
                "timeFormat": {
                    "type": "string",
                    "minLength": 1,
                    "description": (
                        "Time-axis label format. Use 'duration' to render elapsed "
                        "durations (e.g. '6M', '1Y 3M') alongside alignByDuration; "
                        'otherwise a token template like "YYYY-MM", "MMM YYYY", '
                        '"DD/MM/YYYY".'
                    ),
                },
                "branding": {
                    "oneOf": [
                        {"type": "boolean"},
                        {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "text": {"type": "string"},
                                "svg": {"type": "string"},
                                "href": {"type": ["string", "null"]},
                                "position": {
                                    "enum": [
                                        "bottom-left",
                                        "bottom-right",
                                        "top-left",
                                        "top-right",
                                    ]
                                },
                                "opacity": {
                                    "type": "number",
                                    "minimum": 0,
                                    "maximum": 1,
                                },
                                "color": {"$ref": "#/$defs/color"},
                            },
                        },
                    ]
                },
            },
        },
        "valuesRef": {
            "oneOf": [
                {"type": "array", "items": {"type": ["number", "null"]}},
                {
                    "type": "object",
                    "required": ["column"],
                    "additionalProperties": False,
                    "properties": {"column": {"type": "string"}},
                },
            ]
        },
        "indicatorSeries": {
            "type": "object",
            "required": ["values", "kind", "color"],
            "additionalProperties": False,
            "properties": {
                "values": {"$ref": "#/$defs/valuesRef"},
                "kind": {"enum": ["line", "histogram", "area", "band"]},
                "color": {"$ref": "#/$defs/color"},
                "glow": {"$ref": "#/$defs/color"},
                "lineStyle": {"enum": ["solid", "dashed", "dotted"]},
                "colorNegative": {"$ref": "#/$defs/color"},
                "lowerValues": {"$ref": "#/$defs/valuesRef"},
                "refLines": {"type": "array", "items": {"type": "number"}},
                "yRange": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 2,
                    "maxItems": 2,
                },
                "id": {"type": "string", "minLength": 1},
                "label": {"type": "string"},
                "metric": {"type": "string"},
                "toggleable": {"type": "boolean"},
                "hidden": {"type": "boolean"},
            },
        },
        "panelBase": {
            "type": "object",
            "required": ["id", "kind", "weight"],
            "properties": {
                "id": {"type": "string", "minLength": 1},
                "weight": {"type": "number", "exclusiveMinimum": 0},
                "title": {"type": "string"},
                "titleColor": {"$ref": "#/$defs/color"},
            },
        },
        "panel": {
            "oneOf": [
                # price
                {
                    "allOf": [
                        {"$ref": "#/$defs/panelBase"},
                        {
                            "type": "object",
                            "required": ["kind"],
                            "properties": {
                                "kind": {"const": "price"},
                                "type": {"enum": ["candles", "line", "area"]},
                                "overlays": {
                                    "type": "array",
                                    "items": {"$ref": "#/$defs/indicatorSeries"},
                                },
                            },
                        },
                    ]
                },
                # indicator
                {
                    "allOf": [
                        {"$ref": "#/$defs/panelBase"},
                        {
                            "type": "object",
                            "required": ["kind", "indicator"],
                            "properties": {
                                "kind": {"const": "indicator"},
                                "indicator": {"$ref": "#/$defs/indicatorSeries"},
                                "overlays": {
                                    "type": "array",
                                    "items": {"$ref": "#/$defs/indicatorSeries"},
                                },
                            },
                        },
                    ]
                },
                # heatmap
                {
                    "allOf": [
                        {"$ref": "#/$defs/panelBase"},
                        {
                            "type": "object",
                            "required": ["kind", "rows", "cols", "values"],
                            "properties": {
                                "kind": {"const": "heatmap"},
                                "rows": {"type": "array", "items": {"type": "string"}},
                                "cols": {"type": "array", "items": {"type": "string"}},
                                "values": {
                                    "type": "array",
                                    "items": {
                                        "type": "array",
                                        "items": {"type": ["number", "null"]},
                                    },
                                },
                                "format": {"$ref": "#/$defs/formatDirective"},
                                "range": {"type": "number"},
                                "colorScale": {
                                    "type": "object",
                                    "required": ["neg", "mid", "pos"],
                                    "additionalProperties": False,
                                    "properties": {
                                        "neg": {"$ref": "#/$defs/color"},
                                        "mid": {"$ref": "#/$defs/color"},
                                        "pos": {"$ref": "#/$defs/color"},
                                    },
                                },
                                "xLabel": {"type": "string"},
                                "yLabel": {"type": "string"},
                            },
                        },
                    ]
                },
                # hbar
                {
                    "allOf": [
                        {"$ref": "#/$defs/panelBase"},
                        {
                            "type": "object",
                            "required": ["kind", "categories", "values"],
                            "properties": {
                                "kind": {"const": "hbar"},
                                "categories": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "values": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                },
                                "positiveColor": {"$ref": "#/$defs/color"},
                                "negativeColor": {"$ref": "#/$defs/color"},
                                "showMean": {"type": "boolean"},
                                "format": {"$ref": "#/$defs/formatDirective"},
                                "xLabel": {"type": "string"},
                                "yLabel": {"type": "string"},
                            },
                        },
                    ]
                },
                # histogram
                {
                    "allOf": [
                        {"$ref": "#/$defs/panelBase"},
                        {
                            "type": "object",
                            "required": ["kind", "values"],
                            "properties": {
                                "kind": {"const": "histogram"},
                                "values": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                },
                                "bins": {"type": "integer", "minimum": 1},
                                "color": {"$ref": "#/$defs/color"},
                                "showMean": {"type": "boolean"},
                                "formatX": {"$ref": "#/$defs/formatDirective"},
                                "xLabel": {"type": "string"},
                                "yLabel": {"type": "string"},
                            },
                        },
                    ]
                },
                # scatter
                {
                    "allOf": [
                        {"$ref": "#/$defs/panelBase"},
                        {
                            "type": "object",
                            "required": ["kind", "points"],
                            "properties": {
                                "kind": {"const": "scatter"},
                                "points": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "required": ["x", "y"],
                                        "additionalProperties": False,
                                        "properties": {
                                            "x": {"type": "number"},
                                            "y": {"type": "number"},
                                        },
                                    },
                                },
                                "pointColor": {"$ref": "#/$defs/color"},
                                "pointRadius": {
                                    "type": "number",
                                    "exclusiveMinimum": 0,
                                },
                                "identityLine": {"type": "boolean"},
                                "xRange": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                    "minItems": 2,
                                    "maxItems": 2,
                                },
                                "yRange": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                    "minItems": 2,
                                    "maxItems": 2,
                                },
                                "formatX": {"$ref": "#/$defs/formatDirective"},
                                "formatY": {"$ref": "#/$defs/formatDirective"},
                                "xLabel": {"type": "string"},
                                "yLabel": {"type": "string"},
                            },
                        },
                    ]
                },
            ]
        },
    },
}
