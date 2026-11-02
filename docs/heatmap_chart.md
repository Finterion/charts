# Heatmap Chart

Heatmaps display a two-dimensional matrix as colored cells. They are useful for
monthly returns, correlation matrices, risk tables, and other data where both
axes are categorical.

A heatmap is self-contained, so it does not need OHLC data. Define:

- `rows`: labels shown on the y-axis, from top to bottom.
- `cols`: labels shown on the x-axis, from left to right.
- `values`: one array per row and one value per column.
- `null`/`None`: an empty cell.

The examples below render monthly returns. Values are decimal returns, so
`0.034` means `3.4%`.

## React

Pass a `kind: 'heatmap'` panel to `Chart`. The panel's `format` and
`colorScale` options are functions in the direct React API.

```tsx
import { Chart } from '@finterion/charts-react';
import type { PanelSpec } from '@finterion/charts-core';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const panels: PanelSpec[] = [
  {
    id: 'monthly-returns',
    kind: 'heatmap',
    title: 'Monthly returns',
    weight: 1,
    heatmap: {
      rows: ['2025', '2024', '2023'],
      cols: months,
      values: [
        [0.021, -0.014, 0.032, 0.008, null, null],
        [0.046, 0.011, -0.027, 0.019, 0.025, -0.006],
        [-0.018, 0.029, 0.014, -0.009, 0.037, 0.022],
      ],
      format: (value) => `${(value * 100).toFixed(1)}%`,
      range: 0.05,
      xLabel: 'Month',
      yLabel: 'Year',
    },
  },
];

export function MonthlyReturnsHeatmap() {
  return (
    <Chart
      panels={panels}
      theme="finterion-dark"
      style={{ width: '100%', height: 320 }}
    />
  );
}
```

`range` sets the symmetric color domain. In this example, `-0.05` and `0.05`
receive the strongest endpoint colors. Omit it to derive the range from the
largest absolute value in the matrix.

To customize the colors, provide a function that receives a normalized value
where `-1` is the negative endpoint, `0` is the midpoint, and `1` is the
positive endpoint:

```tsx
heatmap: {
  rows,
  cols,
  values,
  colorScale: (value) => {
    const intensity = Math.min(1, Math.abs(value));
    const channel = Math.round(255 * intensity);
    return value < 0
      ? `rgb(${channel}, 0, 0)`
      : `rgb(0, ${channel}, 0)`;
  },
}
```

## Python

Use `Heatmap` with `ChartSpec`. Python specs are JSON-serializable, so
formatting uses a named directive and custom colors use a three-color tuple.

```python
from finterion_charts import ChartSpec, Heatmap

months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]

spec = (
    ChartSpec(theme="finterion-dark")
    .add_panel(
        Heatmap(
            id="monthly-returns",
            title="Monthly returns",
            weight=1,
            rows=["2025", "2024", "2023"],
            cols=months,
            values=[
                [0.021, -0.014, 0.032, 0.008, None, None],
                [0.046, 0.011, -0.027, 0.019, 0.025, -0.006],
                [-0.018, 0.029, 0.014, -0.009, 0.037, 0.022],
            ],
            format="pct1",
            range=0.05,
            color_scale=("#b42318", "#f7f7f2", "#067647"),
            x_label="Month",
            y_label="Year",
        )
    )
)

# Jupyter or a VS Code notebook:
spec.display()

# A regular Python script can open the chart in the default browser:
# spec.show()
```

The available format directives are `pct0`, `pct1`, `pct2`, `fixed0`,
`fixed1`, `fixed2`, `short-num`, and `iso-date`. For example, `pct1` renders
`0.034` as `3.4%`. The three `color_scale` entries are the negative endpoint,
midpoint, and positive endpoint.

## Building the Matrix

When source data arrives as records, convert it to the rectangular matrix
expected by the panel. This Python example places records into year rows and
month columns:

```python
records = [
    {"year": 2024, "month": 1, "return": 0.046},
    {"year": 2024, "month": 2, "return": 0.011},
    {"year": 2023, "month": 1, "return": -0.018},
]

years = sorted({record["year"] for record in records}, reverse=True)
year_index = {year: index for index, year in enumerate(years)}
values = [[None] * 12 for _ in years]

for record in records:
    row = year_index[record["year"]]
    column = record["month"] - 1
    values[row][column] = record["return"]
```

Use the same approach in React: establish the ordered row and column labels,
initialize a rectangular array with `null`, then place each record at its row
and column index.

## Data Requirements

- `values.length` should equal `rows.length`.
- Each nested values array should have one entry for every column.
- Use finite numbers for rendered cells and `null`/`None` for missing cells.
- Choose a fixed `range` when multiple heatmaps must use comparable colors.
- Give the chart an explicit height; the canvas fills its container.
