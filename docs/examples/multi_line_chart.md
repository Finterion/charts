# Multi-Line Chart — Date-Aligned

Overlay several equity curves (or any other time-series) in a single panel on
a shared **calendar** axis. Each curve stays anchored to its true start and
end dates; regions before or after a curve's history are left blank.

For the elapsed-duration variant that stacks every curve at `t = 0`, see
[multi_line_chart_duration_aligned.md](multi_line_chart_duration_aligned.md).

## When to use this

- Timing matters — you want to see how strategies behaved through the same
  market event (a specific drawdown, an earnings week, a regime shift).
- Curves overlap in time and the calendar overlap is itself informative.
- You want tooltips and axis ticks to show real dates.

## How it works

Because the renderer is index-based, every overlay must share the same axis.
Build a single OHLC bar buffer spanning `[min(startTime), max(endTime)]` at
the common bar interval, then splat each curve into its calendar-aligned
slice, left- and right-padding the rest with `NaN`. The renderer draws each
line only where its data exists.

## Data

Each curve carries its absolute UTC start timestamp plus a per-bar equity
series (values start at `1.0`, one bar per trading day):

```ts
interface AlgoCurve {
  id: string;
  label: string;
  color: string;
  startTime: number;    // absolute UTC ms of the first bar
  values: Float32Array; // per-bar equity
}
```

## React

```tsx
import { useMemo } from 'react';
import { Chart } from '@finterion/charts-react';
import type { IndicatorSeries, OHLC, PanelSpec } from '@finterion/charts-core';

const DAY_MS = 86_400_000;

// Your curves — real backtest output, all with different date ranges.
const curves: AlgoCurve[] = MY_ALGO_CURVES;

/** Build a shared calendar axis and NaN-pad each curve into its slice. */
function alignByDate(curves: AlgoCurve[]): { bars: OHLC[]; padded: Float32Array[] } {
  if (curves.length === 0) return { bars: [], padded: [] };
  let globalStart = Infinity;
  let globalEnd = -Infinity;
  for (const c of curves) {
    if (c.startTime < globalStart) globalStart = c.startTime;
    const end = c.startTime + (c.values.length - 1) * DAY_MS;
    if (end > globalEnd) globalEnd = end;
  }
  const n = Math.round((globalEnd - globalStart) / DAY_MS) + 1;
  const bars: OHLC[] = new Array(n);
  for (let i = 0; i < n; i++) {
    bars[i] = { time: globalStart + i * DAY_MS, open: 1, high: 1, low: 1, close: 1 };
  }
  const padded = curves.map((c) => {
    const out = new Float32Array(n);
    out.fill(NaN);
    const offset = Math.round((c.startTime - globalStart) / DAY_MS);
    for (let i = 0; i < c.values.length; i++) out[offset + i] = c.values[i]!;
    return out;
  });
  return { bars, padded };
}

export function EquityOverlayDate() {
  const { bars, panels } = useMemo(() => {
    const { bars, padded } = alignByDate(curves);

    const series: IndicatorSeries[] = curves.map((c, i) => ({
      id: c.id,
      label: c.label,
      values: padded[i]!,
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
      // Real calendar ticks — "Jan 2023", "Jul 2023", ...
      timeFormat="MMM YYYY"
      initialFit="all"
      style={{ width: '100%', height: 420 }}
    />
  );
}
```

## Python

```python
from finterion_charts import ChartSpec, Indicator

DAY_MS = 86_400_000

# curves: list of dicts {id, label, color, values, start_time_ms}
global_start = min(c["start_time_ms"] for c in curves)
global_end   = max(
    c["start_time_ms"] + (len(c["values"]) - 1) * DAY_MS
    for c in curves
)
n = int(round((global_end - global_start) / DAY_MS)) + 1
time = [global_start + i * DAY_MS for i in range(n)]

def pad(c):
    out = [None] * n
    offset = int(round((c["start_time_ms"] - global_start) / DAY_MS))
    for i, v in enumerate(c["values"]):
        out[offset + i] = float(v)
    return out

first, *rest = curves
spec = (
    ChartSpec(theme="finterion-light", time_format="MMM YYYY")
    .with_bars(
        time=time,
        open=[1.0] * n, high=[1.0] * n, low=[1.0] * n, close=[1.0] * n,
    )
    .add_panel(Indicator.panel(
        id="equity", weight=1, title=f"{len(curves)} Strategies",
        values=pad(first),
        color=first["color"], label=first["label"],
        ref_lines=[1.0],
        overlays=[
            Indicator(
                id=c["id"], label=c["label"], values=pad(c),
                kind="line", color=c["color"],
            )
            for c in rest
        ],
    ))
)

spec.display()  # Jupyter / VS Code notebook
# spec.show()   # plain Python script — opens in browser
```

## Notes

- The bar buffer's `time` axis is the union of all curve date ranges. Sparse
  overlap (e.g. one 2019 curve alongside one 2024 curve) produces a wide,
  mostly-empty chart — that is the intended visual signal.
- `NaN` values are skipped by the line renderer; they do not draw a gap
  segment or a zero baseline.
- All curves must share a common bar interval. If your backtests ran at
  different cadences, resample to a common one before padding.
- Prefer this view when the story is *"how did each strategy behave in
  2022?"* Prefer duration-aligned when the story is
  *"how do the strategies compare, period?"*
