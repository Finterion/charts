# Multi-Line Chart Example

This example demonstrates how to create a multi-line chart using Finterion Charts.

```python
from finterion_charts import ChartSpec, Indicator

spec = (
    ChartSpec(theme="finterion-dark", background="#131722", grid="horizontal")
    .add_panel(Indicator.panel(
        id="multi-line", weight=3, title="Multi-Line Chart",
        values={"line1": line1_data, "line2": line2_data, "line3": line3_data},
        colors={"line1": "#a3ff12", "line2": "#12a3ff", "line3": "#ff12a3"},
    ))
)

spec.validate()
spec.to_json("multi_line_chart.json")
url = spec.embed_url()
```