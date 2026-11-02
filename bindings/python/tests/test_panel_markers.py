import pytest

from finterion_charts import ChartSpec, Indicator, Marker


def test_panel_targeted_circle_marker_round_trips_and_validates():
    pytest.importorskip("jsonschema")
    spec = (
        ChartSpec()
        .with_bars(
            time=[1, 2, 3], open=[1, 1, 1], high=[1, 1, 1],
            low=[1, 1, 1], close=[1, 1, 1],
        )
        .add_panel(Indicator.panel(
            id="z_score", weight=1, values=[0, -2, -3],
        ))
        .add_marker(Marker(
            time=2, side="buy", price=-2, panel_id="z_score", shape="circle",
        ))
    )
    assert spec.to_dict()["data"]["markers"] == [{
        "time": 2.0, "side": "buy", "price": -2.0,
        "panelId": "z_score", "shape": "circle",
    }]
    spec.validate(strict=True)


def test_legacy_marker_serialization_is_unchanged():
    assert Marker(time=1, side="buy", price=100, label="B").to_dict() == {
        "time": 1.0, "side": "buy", "price": 100.0, "label": "B",
    }


@pytest.mark.parametrize("shape", ["plus", "minus"])
def test_scale_sign_markers_round_trip_and_validate(shape):
    spec = (
        ChartSpec()
        .with_bars(time=[1], open=[1], high=[1], low=[1], close=[1])
        .add_panel(Indicator.panel(id="z", weight=1, values=[-2]))
        .add_marker(Marker(time=1, side="buy", price=-2, panel_id="z", shape=shape))
    )
    assert spec.to_dict()["data"]["markers"][0]["shape"] == shape
    spec.validate(strict=True)
