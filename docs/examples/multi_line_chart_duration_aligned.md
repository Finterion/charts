# Multi-Line Chart — Duration-Aligned

Overlay several equity curves (or any other time-series) in a single panel,
aligned by **elapsed duration** rather than by calendar date. Every curve
starts at `0` on the x-axis and extends as far as its own history goes. This
is the natural way to compare backtests that ran over different date ranges.

For the calendar-aligned variant that keeps each curve at its true start date,
see [multi_line_chart.md](multi_line_chart.md).

## When to use this

- Comparing backtest results with different start/end dates.
- Ranking strategies by shape (drawdown recovery, CAGR curve) rather than by
  absolute timing.
- Any A/B/C comparison where the calendar is not the shared axis.

## How it works

`alignByDuration(curves)` builds a synthetic time axis that is `max(length)`
bars long, spaced by a single bar interval (inferred from the longest curve's
`times[]`, or overridden via `barIntervalMs`). Every curve is right-padded
with `NaN` up to that length, so the renderer draws each series from `0`
outward and simply stops when its data runs out.

Pair it with `timeFormat: 'duration'` so the axis ticks and tooltip render as
`3M`, `1Y`, `1Y 6M` instead of epoch dates like `1970-04-01`.

## Data

Each curve is an equity series (values start at `1.0`) with its own length —
between roughly 9 months and 3 years of daily bars. The absolute start dates
are irrelevant in this view.

```ts
interface AlgoCurve {
  id: string;
  label: string;
  color: string;
  values: Float32Array; // per-bar equity, starts at 1.0
}
```

## React

```tsx
import { useMemo } from 'react';
import { Chart } from '@finterion/charts-react';
import {
  alignByDuration,
  type IndicatorSeries,
  type OHLC,
  type PanelSpec,
} from '@finterion/charts-core';

const DAY_MS = 86_400_000;

// Your curves — real backtest output, all with different lengths.
const curves: AlgoCurve[] = MY_ALGO_CURVES;

export function EquityOverlayDuration() {
  const { bars, panels } = useMemo(() => {
    // 1) Align every curve to a shared synthetic elapsed-ms axis.
    //    Shorter curves are right-padded with NaN — the renderer skips gaps.
    const aligned = alignByDuration(
      curves.map((c) => ({ values: c.values })),
      { barIntervalMs: DAY_MS },
    );

    // 2) Wrap the elapsed axis in flat OHLC bars for the engine.
    const bars: OHLC[] = new Array(aligned.time.length);
    for (let i = 0; i < aligned.time.length; i++) {
      bars[i] = { time: aligned.time[i]!, open: 1, high: 1, low: 1, close: 1 };
    }

    // 3) One indicator per curve, sharing the same panel.
    const series: IndicatorSeries[] = curves.map((c, i) => ({
      id: c.id,
      label: c.label,
      values: aligned.values[i]!,
      kind: 'line',
      color: c.color,
    }));
    const [first, ...rest] = series;

    const panels: PanelSpec[] = [
      {
        id: 'equity',
        kind: 'indicator',
        weight: 1,
        title: `${curves.length} Strategies`,
        indicator: { ...first!, refLines: [1.0] },
        overlays: rest,
      },
    ];
    return { bars, panels };
  }, []);

  return (
    <Chart
      data={bars}
      panels={panels}
      theme="finterion-light"
      // Renders ticks and tooltip as "3M", "1Y", "1Y 6M" instead of dates.
      timeFormat="duration"
      initialFit="all"
      style={{ width: '100%', height: 420 }}
    />
  );
}
```

## Python

```python
from finterion_charts import ChartSpec, Display, Indicator, align_by_duration

# curves: list of dicts {id, label, color, values}
#   `values` may be a list, numpy array, or pandas Series.
aligned = align_by_duration(curves, bar_interval_ms=86_400_000)
n = len(aligned.time)

first, *rest = curves
spec = (
    ChartSpec(theme="finterion-light", time_format="duration")
    .with_bars(
        time=aligned.time,
        open=[1.0] * n, high=[1.0] * n, low=[1.0] * n, close=[1.0] * n,
    )
    .add_panel(Indicator.panel(
        id="equity", weight=1, title=f"{len(curves)} Strategies",
        values=aligned.values[0],
        color=first["color"], label=first["label"],
        ref_lines=[1.0],
        overlays=[
            Indicator(
                id=c["id"], label=c["label"],
                values=aligned.values[i + 1],
                kind="line", color=c["color"],
            )
            for i, c in enumerate(rest)
        ],
    ))
)

spec.display()  # Jupyter / VS Code notebook
# spec.show()   # plain Python script — opens in browser
```

If you have timestamps and want the helper to infer bar spacing automatically,
pass them alongside the values and drop `bar_interval_ms`:

```python
aligned = align_by_duration([
    {"values": c["values"], "times": c["timestamps"]}
    for c in curves
])
```

## Notes

- The renderer is **index-based**: every curve must share the same sample
  spacing. Resample mixed frequencies (e.g. daily + hourly) into a common
  cadence before calling `alignByDuration`.
- Padding uses `NaN` by default. Override with `{ padValue: 0 }` if your
  downstream analysis needs zeros instead — the renderer will still draw
  a flat line for the padded region.
- The `timeFormat: 'duration'` preset accepts a raw millisecond delta and
  produces compact labels: `0`, `1h`, `1d`, `1M`, `1Y 3M`, `6M 5d`.
