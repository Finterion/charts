import pytest

from finterion_charts import ChartSpec, Indicator
from finterion_charts.validator import validate_schema, validate_spec


def test_sample_mask_round_trips_as_a_column_reference():
    chart = ChartSpec().with_bars(
        time=[1, 2, 3], open=[1, 1, 1], high=[1, 1, 1],
        low=[1, 1, 1], close=[1, 1, 1],
    ).with_columns({
        "equity": [10000, None, 10100], "samples": [1, 0, 1],
    }).add_panel(Indicator.panel(
        id="equity", weight=2, values="equity", sample_mask="samples",
    )).to_dict()
    assert chart["panels"][0]["indicator"]["sampleMask"] == {"column": "samples"}
    assert chart["data"]["columns"]["equity"] == [10000, None, 10100]
    validate_schema(chart).raise_if_invalid()


def test_sample_mask_rejects_non_line_series():
    with pytest.raises(ValueError, match="only supported for line"):
        Indicator(values=[1], kind="area", sample_mask=[1]).to_dict()


@pytest.mark.parametrize("collapsible", [True, False])
def test_panel_collapse_eligibility_round_trips(collapsible):
    chart = ChartSpec().with_bars(
        time=[1], open=[1], high=[1], low=[1], close=[1],
    ).add_panel(Indicator.panel(
        id="equity", weight=2, values=[1000], collapsible=collapsible,
    )).to_dict()
    assert chart["panels"][0]["collapsible"] is collapsible
    validate_schema(chart).raise_if_invalid()
    chart["panels"][0]["collapsible"] = "yes"
    assert not validate_spec(chart).ok
    assert not validate_schema(chart).ok
