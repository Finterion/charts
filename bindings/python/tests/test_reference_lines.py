import pytest

from finterion_charts import ChartSpec, Indicator
from finterion_charts.validator import validate_schema


def test_reference_colors_round_trip_through_builder_and_schema():
    chart = ChartSpec().add_panel(Indicator.panel(
        id="z", weight=1, values=[-2, None, 2],
        ref_lines=[-2, 0, 2],
        ref_line_colors=["#16a34a", "#64748b", "#dc2626"],
    )).to_dict()
    series = chart["panels"][0]["indicator"]
    assert series["refLineColors"] == ["#16a34a", "#64748b", "#dc2626"]
    assert series["refLines"] == [-2, 0, 2]
    assert series["values"] == [-2, None, 2]
    validate_schema(chart).raise_if_invalid()


@pytest.mark.parametrize("lines,colors", [
    (None, ["#fff"]), ([-2, 0, 2], ["#fff"]),
    ([-2, 0, 2], ["#fff", "", "#fff"]),
])
def test_invalid_reference_colors_are_rejected(lines, colors):
    with pytest.raises(ValueError, match="one color per reference line"):
        Indicator(values=[1], ref_lines=lines, ref_line_colors=colors).to_dict()


def test_existing_positional_indicator_arguments_keep_their_meaning():
    indicator = Indicator([1], "line", "#fff", None, None, None, None, [0], (-2, 2))
    assert indicator.to_dict()["yRange"] == [-2, 2]
