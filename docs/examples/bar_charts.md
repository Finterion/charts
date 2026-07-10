# Bar Charts

Categorical bar charts in either orientation. Both variants use the same
options — pick `hbar` when you want long category labels running down the
left side, and `vbar` when time (months, quarters, years) reads more
naturally left-to-right.

- `hbar` — categorical **y**-axis, value **x**-axis. Symmetric around zero.
- `vbar` — categorical **x**-axis, value **y**-axis. Symmetric around zero
  for mixed-sign data, tight around min/max for all-positive data.

Both accept `positiveColor`, `negativeColor`, `showMean`, a `format` value
formatter, and optional `xLabel` / `yLabel` axis titles.

## Data

Ten years of annual returns, plus twelve months of all-positive bookings:

```json
{
  "yearly": {
    "categories": ["2015","2016","2017","2018","2019","2020","2021","2022","2023","2024"],
    "values":     [ 0.087, 0.184, 0.213,-0.216, 0.337, 0.295,-0.022, 0.113, 0.544,-0.029]
  },
  "monthly": {
    "categories": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    "values":     [ 120, 180,  95, 210, 260, 145, 190, 175, 240, 205, 155, 220]
  }
}
```

## React

```tsx
import { Chart } from '@finterion/charts-react';
import type { PanelSpec } from '@finterion/charts-core';

// Horizontal bars — great for signed yearly returns where the category
// labels (years) fit naturally down the y-axis.
const yearly: PanelSpec = {
  id: 'yearly-returns',
  kind: 'hbar',
  weight: 1,
  title: 'Yearly Returns',
  hbar: {
    categories: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
    values:     [ 0.087, 0.184, 0.213,-0.216, 0.337, 0.295,-0.022, 0.113, 0.544,-0.029],
    showMean: true,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    positiveColor: '#1a7f37',
    negativeColor: '#cf222e',
  },
};

// Vertical bars — great for time-ordered categories (months, quarters).
// All-positive data automatically fills the plot with a tight y-range.
const monthly: PanelSpec = {
  id: 'monthly-bookings',
  kind: 'vbar',
  weight: 1,
  title: 'Monthly Bookings',
  vbar: {
    categories: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    values:     [ 120, 180,  95, 210, 260, 145, 190, 175, 240, 205, 155, 220],
    showMean: true,
    format: (v) => v.toFixed(0),
  },
};

export function BarCharts() {
  return (
    <>
      <Chart panels={[yearly]}  style={{ width: '100%', height: 320 }} />
      <Chart panels={[monthly]} style={{ width: '100%', height: 320 }} />
    </>
  );
}
```

## Python

```python
from finterion_charts import ChartSpec, HBar, VBar

years   = ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024']
returns = [ 0.087, 0.184, 0.213, -0.216, 0.337, 0.295, -0.022, 0.113, 0.544, -0.029]

months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
bookings = [ 120, 180, 95, 210, 260, 145, 190, 175, 240, 205, 155, 220]

# Horizontal bars — signed yearly returns.
yearly_spec = (
    ChartSpec()
    .add_panel(HBar(
        id='yearly-returns',
        weight=1,
        title='Yearly Returns',
        categories=years,
        values=returns,
        show_mean=True,
        format='pct1',
        positive_color='#1a7f37',
        negative_color='#cf222e',
    ))
)

# Vertical bars — all-positive monthly bookings.
monthly_spec = (
    ChartSpec()
    .add_panel(VBar(
        id='monthly-bookings',
        weight=1,
        title='Monthly Bookings',
        categories=months,
        values=bookings,
        show_mean=True,
        format='fixed0',
    ))
)

yearly_spec.display_in_jupyter()
monthly_spec.display_in_jupyter()
# spec.show()  # plain Python — opens the chart in a browser
```

## Notes

- Categories and values arrays must be the same length.
- `hbar` is always drawn symmetric around `x = 0`, matching the classic
  "signed returns" tearsheet look.
- `vbar` switches between symmetric-around-zero and tight-around-min/max
  automatically based on the data:
  - mixed-sign values → symmetric range (positive/negative colouring shows)
  - all-positive or all-negative values → tight range, so the plot isn't
    half empty for count- or magnitude-style series.
- Use `showMean: true` to draw a dashed mean line (vertical on `hbar`,
  horizontal on `vbar`) with a small `mean X` label.
