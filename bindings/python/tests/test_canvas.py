import html
import json
import re

import pytest

from finterion_charts import ChartCanvas, ChartSpec, Indicator, decode_spec, encode_spec


def chart():
    return (
        ChartSpec()
        .with_bars(time=[1, 2], open=[1, 1], high=[2, 2], low=[0, 0], close=[1, 1])
        .add_panel(Indicator.panel(id="z", weight=1, values=[-2, 1]))
    )


@pytest.mark.parametrize("layout", ["single", "grid"])
@pytest.mark.parametrize("selector", ["dropdown", "tabs", "multiselect", "checkboxes"])
def test_canvas_contract(layout, selector):
    first, second = chart(), chart()
    canvas = ChartCanvas(
        "Symbols", {"BTC/EUR": first, "ETH/EUR": second},
        layout=layout, selector={"type": selector, "label": "Symbol"},
        selected=["ETH/EUR"], chart_height=600,
    )
    spec = canvas.to_dict()
    assert spec["kind"] == "canvas"
    assert spec["charts"]["BTC/EUR"] == first.to_dict()
    assert spec["selected"] == ["ETH/EUR"]
    assert spec["chartHeight"] == 600
    assert decode_spec(encode_spec(spec)) == spec


@pytest.mark.parametrize("kwargs", [
    {"title": ""}, {"charts": {}}, {"charts": {"": chart()}},
    {"charts": {"x": 1}}, {"layout": "rows"}, {"columns": 0},
    {"columns": True}, {"chart_height": -1}, {"layout_toggle": 1},
    {"selector": {"type": "bad"}}, {"selector": {"type": "tabs", "extra": "bad"}},
    {"selected": ["missing"]}, {"selected": ["BTC", "BTC"]},
])
def test_invalid_canvas(kwargs):
    with pytest.raises((ValueError, TypeError)):
        ChartCanvas(**({"title": "Charts", "charts": {"BTC": chart()}} | kwargs))


def test_inline_canvas_uses_one_self_contained_iframe():
    canvas = ChartCanvas('Symbols </script><script>alert("x")</script>', {"BTC": chart(), "ETH": chart()})
    output = canvas.display_in_jupyter(height=800)._repr_html_()
    assert output.count("<iframe ") == 1
    srcdoc = html.unescape(re.search(r'srcdoc="([^"]+)"', output)[1])
    assert '"kind":"canvas"' in srcdoc
    assert "<\\/script>" in srcdoc
    assert "height:800px" in output
    assert json.loads(json.dumps(canvas.to_dict()))["charts"]["ETH"] == chart().to_dict()


def test_mutated_chart_is_revalidated_before_display():
    canvas = ChartCanvas("Symbols", {"BTC": chart()})
    canvas.columns = -1
    with pytest.raises(ValueError, match="columns"):
        canvas.display_in_jupyter()


def test_url_mode_encodes_the_whole_canvas():
    canvas = ChartCanvas("Symbols", {"BTC": chart(), "ETH": chart()})
    iframe = canvas.display_in_jupyter(mode="url", base="https://example.test/embed")
    assert decode_spec(iframe.src.split("#spec=", 1)[1]) == canvas.to_dict()


def test_display_helpers_accept_canvas_objects():
    from finterion_charts.display import display_inline, display_spec

    canvas = ChartCanvas("Symbols", {"BTC": chart()})
    assert '"kind":"canvas"' in html.unescape(display_inline(canvas)._repr_html_())
    iframe = display_spec(canvas, base="https://example.test/embed")
    assert decode_spec(iframe.src.split("#spec=", 1)[1]) == canvas.to_dict()
