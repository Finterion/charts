"""Tests for the ergonomic builder API.

These assert that the builder produces dicts matching the JSON ``ChartSpec``
shape from `@finterion/charts-spec` and that they pass strict JSON Schema
validation.
"""

from __future__ import annotations

import math

import pytest

from finterion_charts import (
    ChartSpec,
    Display,
    HBar,
    Heatmap,
    Histogram,
    Indicator,
    Marker,
    Price,
    Scatter,
    align_by_duration,
    get_chart_capabilities,
    validate_schema,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _ohlc(n: int = 10):
    time = [float(i) for i in range(n)]
    o = [10.0 + i for i in range(n)]
    h = [v + 0.5 for v in o]
    lo = [v - 0.5 for v in o]
    c = [v + 0.1 for v in o]
    v = [100.0 * (i + 1) for i in range(n)]
    return time, o, h, lo, c, v


# ─────────────────────────────────────────────────────────────────────────────
# Builder shape
# ─────────────────────────────────────────────────────────────────────────────


def test_chartspec_minimal_price_panel():
    t, o, h, lo, c, _ = _ohlc()
    spec = (
        ChartSpec(theme="finterion-dark")
        .with_bars(time=t, open=o, high=h, low=lo, close=c)
        .add_panel(Price(id="price", weight=1, type="candles"))
    )
    d = spec.to_dict()
    assert d["version"] == 1
    assert d["display"] == {"theme": "finterion-dark"}
    assert d["data"]["bars"]["time"] == t
    assert d["panels"][0] == {
        "id": "price",
        "kind": "price",
        "weight": 1.0,
        "type": "candles",
    }


def test_chartspec_with_columns_and_indicator_panel():
    t, o, h, lo, c, _ = _ohlc(8)
    rsi = [50.0 + i for i in range(8)]
    spec = (
        ChartSpec(theme="finterion-dark", grid="horizontal")
        .with_bars(time=t, open=o, high=h, low=lo, close=c)
        .with_column("rsi14", rsi)
        .add_panel(Price(id="price", weight=3, title="AAPL"))
        .add_panel(
            Indicator.panel(
                id="rsi", weight=1, title="RSI 14",
                values="rsi14", color="#a3ff12",
                ref_lines=[30, 70], y_range=(0, 100),
            )
        )
    )
    d = spec.to_dict()
    assert d["data"]["columns"]["rsi14"] == rsi
    rsi_panel = d["panels"][1]
    assert rsi_panel["kind"] == "indicator"
    assert rsi_panel["indicator"]["values"] == {"column": "rsi14"}
    assert rsi_panel["indicator"]["refLines"] == [30.0, 70.0]
    assert rsi_panel["indicator"]["yRange"] == [0.0, 100.0]


def test_overlays_with_column_refs_and_markers():
    t, o, h, lo, c, _ = _ohlc(6)
    st_up = [11.0, 11.5, math.nan, math.nan, 13.0, 13.5]
    st_dn = [math.nan, math.nan, 12.0, 12.5, math.nan, math.nan]
    spec = (
        ChartSpec()
        .with_bars(time=t, open=o, high=h, low=lo, close=c)
        .with_column("st_up", st_up)
        .with_column("st_dn", st_dn)
        .add_panel(
            Price(
                id="price", weight=3, type="candles",
                overlays=[
                    Indicator.line(values="st_up", color="#00ffa3"),
                    Indicator.line(values="st_dn", color="#ff3d6e"),
                ],
            )
        )
        .add_marker(Marker(time=t[1], side="buy", price=lo[1], label="B"))
        .add_marker(Marker(time=t[3], side="sell", price=h[3], label="S"))
    )
    d = spec.to_dict()
    # NaN must be serialised as null (so the spec stays JSON-safe).
    assert d["data"]["columns"]["st_up"][2] is None
    assert d["data"]["columns"]["st_dn"][0] is None
    assert d["panels"][0]["overlays"][0]["values"] == {"column": "st_up"}
    assert len(d["data"]["markers"]) == 2
    assert d["data"]["markers"][0]["side"] == "buy"


def test_validate_strict_passes_for_full_spec():
    pytest.importorskip("jsonschema")
    t, o, h, lo, c, _ = _ohlc(6)
    spec = (
        ChartSpec(theme="finterion-dark", background="#131722")
        .with_bars(time=t, open=o, high=h, low=lo, close=c)
        .with_column("rsi14", [50.0, 51, 52, 53, 54, 55])
        .add_panel(Price(id="price", weight=3, type="candles"))
        .add_panel(
            Indicator.panel(
                id="rsi", weight=1, values="rsi14", color="#a3ff12",
                ref_lines=[30, 70], y_range=(0, 100),
            )
        )
    )
    spec.validate(strict=True)


def test_self_contained_panels_compile_without_bars():
    spec = (
        ChartSpec()
        .add_panel(
            Heatmap(
                id="h", weight=1, rows=["A", "B"], cols=["X", "Y"],
                values=[[0.1, -0.2], [0.3, None]], format="pct1",
            )
        )
        .add_panel(
            HBar(id="b", weight=1, categories=["a", "b"], values=[0.1, -0.2])
        )
        .add_panel(Histogram(id="d", weight=1, values=[1.0, 2.0, 3.0], bins=4))
        .add_panel(Scatter(id="s", weight=1, points=[(0.0, 0.1), (1.0, 0.2)]))
    )
    spec.validate()


def test_chartspec_requires_at_least_one_panel():
    with pytest.raises(ValueError, match="at least one panel"):
        ChartSpec().to_dict()


def test_indicator_panel_requires_indicator():
    from finterion_charts.builder import IndicatorPanel

    with pytest.raises(ValueError, match="requires an indicator"):
        IndicatorPanel(id="x", weight=1).to_dict()


def test_with_bars_rejects_mismatched_lengths():
    with pytest.raises(ValueError, match="inconsistent lengths"):
        ChartSpec().with_bars(
            time=[1, 2, 3],
            open=[1, 2],
            high=[1, 2, 3],
            low=[1, 2, 3],
            close=[1, 2, 3],
        )


def test_to_json_and_embed_url_round_trip():
    t, o, h, lo, c, _ = _ohlc(4)
    spec = (
        ChartSpec()
        .with_bars(time=t, open=o, high=h, low=lo, close=c)
        .add_panel(Price(id="price", weight=1, type="candles"))
    )
    text = spec.to_json()
    assert text.startswith('{"version":1')
    url = spec.embed_url()
    assert url.startswith("https://charts.finterion.com/embed/#spec=")


def test_get_chart_capabilities_matches_ts_keys():
    caps = get_chart_capabilities().to_dict()
    assert caps["version"] == 1
    assert "price" in caps["panelKinds"]
    assert "line" in caps["indicatorKinds"]
    assert "candles" in caps["seriesTypes"]
    assert "pct1" in caps["formatDirectives"]
    assert "finterion-dark" in caps["themes"]


# ─────────────────────────────────────────────────────────────────────────────
# Display.time_format + align_by_duration
# ─────────────────────────────────────────────────────────────────────────────


def test_display_time_format_emits_camelcase_field():
    d = Display(time_format="duration").to_dict()
    assert d == {"timeFormat": "duration"}

    d = Display(theme="finterion-light", time_format="MMM YYYY").to_dict()
    assert d["timeFormat"] == "MMM YYYY"


def test_display_time_format_rejects_empty_string():
    with pytest.raises(ValueError):
        Display(time_format="").to_dict()


def test_display_time_format_is_valid_in_spec():
    spec = (
        ChartSpec(theme="finterion-light", time_format="duration")
        .add_panel(Histogram(id="h", weight=1, values=[1.0, 2.0, 3.0]))
    )
    # Strict schema validation must accept the new field.
    d = spec.to_dict()
    res = validate_schema(d)
    assert res.ok, res.errors
    assert d["display"]["timeFormat"] == "duration"


def test_align_by_duration_empty_input():
    out = align_by_duration([])
    assert out.time == []
    assert out.values == []
    assert out.bar_interval_ms == 86_400_000.0


def test_align_by_duration_longest_curve_sets_axis_length():
    out = align_by_duration(
        [
            {"values": [1.0, 2.0, 3.0]},
            {"values": [1.0, 2.0, 3.0, 4.0, 5.0]},
            {"values": [1.0, 2.0]},
        ],
        bar_interval_ms=1000,
    )
    assert len(out.time) == 5
    assert out.time == [0.0, 1000.0, 2000.0, 3000.0, 4000.0]
    assert out.bar_interval_ms == 1000.0


def test_align_by_duration_right_pads_with_none():
    out = align_by_duration(
        [{"values": [1.0, 2.0, 3.0, 4.0]}, {"values": [10.0, 20.0]}],
        bar_interval_ms=1000,
    )
    assert out.values[0] == [1.0, 2.0, 3.0, 4.0]
    a, b, c, d = out.values[1]
    assert a == 10.0
    assert b == 20.0
    assert c is None
    assert d is None


def test_align_by_duration_infers_spacing_from_longest():
    out = align_by_duration(
        [
            {"values": [1.0, 2.0, 3.0], "times": [0, 500, 1000]},
            {
                "values": [1.0, 2.0, 3.0, 4.0, 5.0],
                "times": [0, 1000, 2000, 3000, 4000],
            },
        ]
    )
    assert out.bar_interval_ms == 1000.0
    assert out.time == [0.0, 1000.0, 2000.0, 3000.0, 4000.0]


def test_align_by_duration_defaults_to_one_day_when_no_times():
    out = align_by_duration([{"values": [1.0, 2.0, 3.0]}])
    assert out.bar_interval_ms == 86_400_000.0
    assert out.time[1] == 86_400_000.0


def test_align_by_duration_preserves_input_order():
    out = align_by_duration(
        [
            {"values": [1.0]},
            {"values": [1.0, 2.0, 3.0]},
            {"values": [1.0, 2.0]},
        ],
        bar_interval_ms=1,
    )
    assert len(out.values) == 3
    assert out.values[0][0] == 1.0
    assert out.values[1][2] == 3.0
    assert out.values[2][1] == 2.0


def test_align_by_duration_rejects_non_dict_input():
    with pytest.raises(TypeError):
        align_by_duration([[1, 2, 3]])  # type: ignore[list-item]


def test_align_by_duration_nan_becomes_none():
    out = align_by_duration(
        [{"values": [1.0, float("nan"), 3.0]}], bar_interval_ms=1
    )
    assert out.values[0][0] == 1.0
    assert out.values[0][1] is None
    assert out.values[0][2] == 3.0
