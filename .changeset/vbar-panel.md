---
"@finterion/charts-core": minor
"@finterion/charts-react": minor
"@finterion/charts-spec": minor
---

Add `vbar` panel — vertical categorical bar chart

`vbar` is the vertical counterpart to `hbar`: categorical **x**-axis, value
**y**-axis, same option shape (`categories`, `values`, `positiveColor`,
`negativeColor`, `showMean`, `format`, `xLabel`, `yLabel`).

The y-range picks itself intelligently based on the data:
- Mixed-sign values → symmetric around zero (matches `hbar`'s signed-returns look).
- All-positive or all-negative values → tight around min/max, so count / magnitude
  series fill the plot instead of wasting half of it below zero.

```ts
{
  id: 'monthly-pnl', kind: 'vbar', weight: 1, title: 'Monthly P&L',
  vbar: {
    categories: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    values: [0.03, -0.01, 0.05, 0.02, -0.02, 0.04, 0.01, 0.03, -0.03, 0.02, 0.05, 0.04],
    showMean: true,
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
}
```

`showMean: true` draws a dashed horizontal mean line with a `mean X` label.
Fully JSON-round-trippable via `@finterion/charts-spec` (matching
`VBarPanelSpec` + JSON Schema branch).
