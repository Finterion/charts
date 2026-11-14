from finterion_charts import ChartSpec, IndicatorOutput, Price
from finterion_charts.validator import validate_schema


def test_outputs_round_trip_without_changing_positional_panel_arguments():
    chart = ChartSpec().with_columns({"trend": [None, 0, 1]}).add_panel(
        Price("trend", 1, "SuperTrend", outputs=[
            IndicatorOutput("raw", "SuperTrend", [None, 12345.123456789, 12346]),
            IndicatorOutput("trend", "Trend classification", "trend"),
        ])
    ).to_dict()
    outputs = chart["panels"][0]["outputs"]
    assert outputs[0]["values"] == [None, 12345.123456789, 12346]
    assert outputs[1]["values"] == {"column": "trend"}
    assert chart["panels"][0]["title"] == "SuperTrend"
    validate_schema(chart).raise_if_invalid()


def test_output_source_timestamps_preserve_milliseconds_and_gaps():
    chart = ChartSpec().with_columns({"source": [1583712000000, None]}).add_panel(
        Price("daily", 1, "Daily", output_source_time="source",
              output_available_at=[1583798400000, None])
    ).to_dict()
    assert chart["panels"][0]["outputSourceTime"] == {"column": "source"}
    assert chart["panels"][0]["outputAvailableAt"] == [1583798400000, None]
    validate_schema(chart).raise_if_invalid()
