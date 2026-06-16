"""Tests for the cheap and strict validators."""

from __future__ import annotations

import pytest

from finterion_charts import validate_schema, validate_spec


def _minimal_spec() -> dict:
    return {
        "version": 1,
        "data": {
            "bars": {
                "time": [1.0, 2.0, 3.0],
                "open": [10.0, 11.0, 12.0],
                "high": [11.0, 12.0, 13.0],
                "low": [9.5, 10.5, 11.5],
                "close": [10.5, 11.5, 12.5],
            }
        },
        "panels": [
            {"id": "price", "kind": "price", "weight": 1, "type": "candles"}
        ],
    }


def test_validate_spec_accepts_minimal():
    res = validate_spec(_minimal_spec())
    assert res.ok, res.errors


def test_validate_spec_rejects_wrong_version():
    spec = _minimal_spec()
    spec["version"] = 2
    res = validate_spec(spec)
    assert not res.ok
    assert any("version" in e for e in res.errors)


def test_validate_spec_rejects_duplicate_panel_ids():
    spec = _minimal_spec()
    spec["panels"].append(
        {"id": "price", "kind": "indicator", "weight": 1,
         "indicator": {"values": [1, 2, 3], "kind": "line", "color": "#fff"}}
    )
    res = validate_spec(spec)
    assert not res.ok
    assert any("duplicated" in e for e in res.errors)


def test_validate_spec_requires_bars_for_price_panel():
    spec = _minimal_spec()
    spec["data"] = {}
    res = validate_spec(spec)
    assert not res.ok
    assert any("data.bars" in e for e in res.errors)


def test_validate_spec_does_not_require_bars_for_self_contained_panels():
    spec = {
        "version": 1,
        "panels": [
            {
                "id": "h",
                "kind": "histogram",
                "weight": 1,
                "values": [1.0, 2.0, 3.0, 4.0],
            }
        ],
    }
    res = validate_spec(spec)
    assert res.ok, res.errors


def test_validate_spec_rejects_negative_weight():
    spec = _minimal_spec()
    spec["panels"][0]["weight"] = -1
    res = validate_spec(spec)
    assert not res.ok


def test_validate_spec_rejects_unknown_kind():
    spec = _minimal_spec()
    spec["panels"][0]["kind"] = "unknown"
    res = validate_spec(spec)
    assert not res.ok


# ---- strict (jsonschema) -----------------------------------------------------


def test_validate_schema_accepts_minimal():
    pytest.importorskip("jsonschema")
    res = validate_schema(_minimal_spec())
    assert res.ok, res.errors


def test_validate_schema_rejects_extra_top_level_field():
    pytest.importorskip("jsonschema")
    spec = _minimal_spec()
    spec["unexpected"] = True
    res = validate_schema(spec)
    assert not res.ok


def test_validate_schema_rejects_bad_format_directive():
    pytest.importorskip("jsonschema")
    spec = {
        "version": 1,
        "panels": [
            {
                "id": "h", "kind": "histogram", "weight": 1,
                "values": [1, 2, 3],
                "formatX": "not-a-real-directive",
            }
        ],
    }
    res = validate_schema(spec)
    assert not res.ok


def test_raise_if_invalid_raises():
    res = validate_spec({"version": 1, "panels": "nope"})
    with pytest.raises(ValueError):
        res.raise_if_invalid()
