import json

import pytest

from finterion_charts import (
    Boxplot, ChartSpec, Donut, get_chart_capabilities, validate_schema, validate_spec,
)


def test_distribution_builders_round_trip_and_validate_without_bars():
    spec = (
        ChartSpec(theme="finterion-light")
        .add_panel(Donut(
            id="assets", weight=1, categories=["BTC", "ETH"], values=[3, 1],
            colors=["#f7931a", "#627eea"], inner_radius=0.6,
            center_label="TRADES", show_total=True, format="fixed0",
        ))
        .add_panel(Boxplot(
            id="returns", weight=1, categories=["Vector", "Event"], values=[[0.1, -0.2], [0.3]],
            colors=["#f7931a", "#627eea"], show_points=True, format="pct1",
        ))
    ).validate()
    data = json.loads(json.dumps(spec.to_dict(), allow_nan=False))
    assert data["panels"][0]["innerRadius"] == 0.6
    assert data["panels"][1]["values"] == [[0.1, -0.2], [0.3]]
    assert data["panels"][1]["showPoints"] is True
    assert validate_schema(data).ok
    assert {"donut", "boxplot"} <= set(get_chart_capabilities().panel_kinds)


@pytest.mark.parametrize("panel", [
    Donut(id="empty", weight=1), Donut(id="zero", weight=1, categories=["BTC"], values=[0]),
    Boxplot(id="empty", weight=1),
    Boxplot(id="groups", weight=1, categories=["empty", "one"], values=[[], [1]]),
])
def test_empty_and_singleton_distributions(panel):
    spec = ChartSpec().add_panel(panel).validate().to_dict()
    assert validate_schema(spec).ok


@pytest.mark.parametrize("panel", [
    {"kind": "donut", "categories": ["BTC"], "values": [-1]},
    {"kind": "donut", "categories": ["BTC"], "values": [float("inf")]},
    {"kind": "donut", "categories": ["BTC"], "values": [1], "innerRadius": 1},
    {"kind": "donut", "categories": ["BTC"], "values": [1], "showTotal": 1},
    {"kind": "boxplot", "categories": ["BTC"], "values": [[float("nan")]]},
    {"kind": "boxplot", "categories": ["BTC"], "values": [1]},
    {"kind": "boxplot", "categories": ["BTC"], "values": []},
    {"kind": "boxplot", "categories": ["BTC"], "values": [[1]], "colors": []},
    {"kind": "boxplot", "categories": ["BTC"], "values": [[1]], "format": "bad"},
])
def test_distribution_validator_rejects_invalid_data(panel):
    spec = {"version": 1, "panels": [{"id": "test", "weight": 1, **panel}]}
    result = validate_spec(spec)
    assert not result.ok
    assert any(error.startswith("panels[0].") for error in result.errors)


@pytest.mark.parametrize("panel", [
    Donut(id="negative", weight=1, categories=["BTC"], values=[-1]),
    Donut(id="mismatch", weight=1, categories=["BTC"], values=[]),
    Boxplot(id="nonfinite", weight=1, categories=["BTC"], values=[[float("inf")]]),
])
def test_distribution_builders_reject_invalid_data(panel):
    with pytest.raises(ValueError):
        panel.to_dict()
