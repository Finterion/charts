from copy import deepcopy

import pytest

from finterion_charts import ChartSpec, Indicator, validate_schema, validate_spec


def decision():
    return {
        "id": "e1", "time": 1700000000, "panelId": "z", "value": -2,
        "action": "entry", "direction": "long",
        "card": {
            "title": "Entry rejected", "status": "rejected", "score": 7, "minimumScore": 12,
            "groups": [{
                "id": "signal", "title": "Raw evidence",
                "rules": [{
                    "id": "r1", "label": "Z score", "matched": False, "value": -2,
                    "points": 7, "timeframe": "1h", "description": "Below threshold",
                }],
            }],
        },
    }


def chart():
    return (
        ChartSpec()
        .with_bars(time=[1700000000], open=[1], high=[1], low=[1], close=[1])
        .add_panel(Indicator.panel(id="z", weight=1, values=[-2]))
    )


def test_decision_builder_roundtrip_and_strict_schema():
    spec = chart()
    item = decision()
    assert spec.add_decision(item) is spec
    assert spec.to_dict()["data"]["decisions"] == [item]
    assert '"minimumScore":12' in spec.to_json().replace(" ", "")
    assert validate_spec(spec.to_dict()).ok
    pytest.importorskip("jsonschema")
    assert validate_schema(spec.to_dict()).ok


def test_optional_scores_extensible_status_and_no_decisions():
    assert "decisions" not in chart().to_dict()["data"]
    item = decision()
    item["card"] = {"title": "Pending", "status": "a_future_status", "groups": []}
    assert chart().add_decision(item).validate() is not None


@pytest.mark.parametrize("signal_type", ["scale_in", "scale_out", "stop_loss", "take_profit"])
@pytest.mark.parametrize("event_type", ["trigger", "fill"])
def test_protective_and_scaling_classifications(signal_type, event_type):
    item = {**decision(), "signalType": signal_type, "eventType": event_type}
    spec = chart().add_decision(item).to_dict()
    assert validate_spec(spec).ok
    assert validate_schema(spec).ok
    for field in ("signalType", "eventType"):
        invalid = deepcopy(spec)
        invalid["data"]["decisions"][0][field] = "typo"
        assert not validate_spec(invalid).ok
        assert not validate_schema(invalid).ok


def test_inspector_attributes_round_trip_and_validate_consistently():
    item = decision()
    item["card"].update(
        reason=None, strength=.4, position="Long - 1 open entries / limit 3",
        qualification="All group thresholds",
    )
    group = item["card"]["groups"][0]
    group.update(minimumScore=1, minimumMatches=1, aggregation="max")
    group["rules"][0].update(weight=-2, required=True)
    spec = chart().add_decision(item).to_dict()
    assert validate_spec(spec).ok
    assert validate_schema(spec).ok
    assert spec["data"]["decisions"][0]["card"] == item["card"]
    for container, key, invalid in (
        (item["card"], "strength", 1.1),
        (group, "minimumMatches", .5),
        (group, "aggregation", "invented"),
        (group["rules"][0], "required", "yes"),
        (item["card"], "reason", False),
    ):
        original = container[key]
        container[key] = invalid
        malformed = chart().add_decision(item).to_dict()
        assert not validate_spec(malformed).ok
        assert not validate_schema(malformed).ok
        container[key] = original


def test_recorded_group_maxima_and_total_survive_strict_schema():
    item = decision()
    item["card"]["maximumScore"] = 4
    item["card"]["groups"][0].update(score=3, maximumScore=3)
    spec = chart().add_decision(item).to_dict()
    assert validate_spec(spec).ok
    assert validate_schema(spec).ok
    item["card"]["maximumScore"] = -1
    assert not validate_spec(chart().add_decision(item).to_dict()).ok
    assert not validate_schema(chart().add_decision(item).to_dict()).ok
    item["card"]["maximumScore"] = 4
    item["card"]["groups"][0]["maximumScore"] = -1
    assert not validate_spec(chart().add_decision(item).to_dict()).ok
    assert not validate_schema(chart().add_decision(item).to_dict()).ok


def test_visual_rule_capacity_roundtrip_and_validation():
    item = decision()
    rule = item["card"]["groups"][0]["rules"][0]
    rule["maximumPoints"] = 3
    spec = chart().add_decision(item).to_dict()
    assert validate_spec(spec).ok
    assert validate_schema(spec).ok
    assert spec["data"]["decisions"][0]["card"]["groups"][0]["rules"][0]["maximumPoints"] == 3
    for invalid in (-1, float("inf"), True):
        rule["maximumPoints"] = invalid
        assert not validate_spec(chart().add_decision(item).to_dict()).ok
    rule["maximumPoints"] = -1
    assert not validate_schema(chart().add_decision(item).to_dict()).ok


def test_reference_line_can_omit_hover_value_without_hiding_line():
    line = Indicator(values=[-2], label="Threshold", show_hover_value=False)
    spec = chart()
    spec.panels[0].overlays = [line]
    data = spec.to_dict()
    overlay = data["panels"][0]["overlays"][0]
    assert overlay["showHoverValue"] is False
    assert "hidden" not in overlay
    assert validate_spec(data).ok
    assert validate_schema(data).ok


def test_chart_min_height_roundtrips_and_validates_independent_scroll_layout():
    spec = chart()
    spec.display.chart_min_height = 1600
    assert spec.to_dict()["display"]["chartMinHeight"] == 1600
    assert validate_spec(spec.to_dict()).ok
    assert validate_schema(spec.to_dict()).ok
    assert ChartSpec(chart_min_height=1200).display.chart_min_height == 1200
    spec.display.chart_min_height = -1
    assert not validate_spec(spec.to_dict()).ok


def test_inline_chart_delegates_fullscreen_without_relaxing_script_sandbox():
    html = chart().display_in_jupyter()._repr_html_()
    assert 'allow="fullscreen" allowfullscreen' in html
    assert 'sandbox="allow-scripts"' in html


def test_multiple_cards_at_same_time_keep_independent_selector_labels():
    first, second = decision(), decision()
    first["label"] = "Long entry"
    second.update(id="e2", label="Short exit")
    spec = chart().add_decision(first).add_decision(second).to_dict()
    assert len(spec["data"]["decisions"]) == 2
    assert validate_spec(spec).ok
    assert validate_schema(spec).ok
    second["label"] = ""
    assert not validate_spec(chart().add_decision(second).to_dict()).ok

@pytest.mark.parametrize("key,value", [
    ("time", True), ("time", float("nan")), ("value", None),
    ("action", "buy"), ("direction", "up"), ("panelId", "missing"),
    ("card", None), ("id", ""),
])
def test_invalid_decision_fields(key, value):
    item = decision()
    item[key] = value
    assert not validate_spec(chart().add_decision(item).to_dict()).ok


def test_nested_evidence_duplicate_ids_and_non_json_data():
    item = decision()
    item["card"]["groups"][0]["rules"][0]["matched"] = "true"
    spec = chart().add_decision(item).to_dict()
    assert any("matched" in error for error in validate_spec(spec).errors)
    spec["data"]["decisions"] = [decision(), deepcopy(decision())]
    assert any("duplicated" in error for error in validate_spec(spec).errors)
    spec["data"]["decisions"] = [decision()]
    spec["data"]["decisions"][0]["card"]["callback"] = lambda: None
    assert not validate_spec(spec).ok


@pytest.mark.parametrize("matched", [True, False, None])
def test_explicit_group_outcome_roundtrips_without_inferring_rule_results(matched):
    item = decision()
    item["card"]["groups"][0]["matched"] = matched
    spec = chart().add_decision(item).to_dict()
    assert validate_spec(spec).ok
    assert spec["data"]["decisions"][0]["card"]["groups"][0]["matched"] is matched
    pytest.importorskip("jsonschema")
    assert validate_schema(spec).ok


def test_invalid_group_outcome_is_rejected():
    item = decision()
    item["card"]["groups"][0]["matched"] = "yes"
    errors = validate_spec(chart().add_decision(item).to_dict()).errors
    assert any("groups[0].matched" in error for error in errors)
