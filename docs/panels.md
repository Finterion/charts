# Panel kinds

A chart is a vertical stack of panels. Each panel has a `kind` that decides
how it renders. There are two families:

- **Time-indexed** panels (`price`, `indicator`) share the chart's OHLC viewport
  and the bottom time axis. They draw nothing until `data.bars` is provided.
- **Self-contained** panels (`heatmap`, `hbar`, `histogram`, `scatter`) ignore
  the time axis and render purely from their own data. A chart that contains
  *only* self-contained panels hides the bottom time axis automatically.

All panels share a common header:

```ts
interface BasePanel {
  id: string;          // unique within the chart
  kind: PanelKind;     // discriminator
  weight: number;      // height = weight / sum(weights)
  title?: string;      // top-left label
  titleColor?: string; // override per-panel
}
```

---

## `price`

OHLC candles, line, or area. Overlays draw on top of the price layer.

```ts
{
  id: 'price', kind: 'price', weight: 4, title: 'AAPL',
  type: 'candles',                    // 'candles' | 'line' | 'area'
  overlays: [
    { values: bbUpper, lowerValues: bbLower, kind: 'band',
      color: 'rgba(0,229,255,0.7)', glow: 'rgba(0,229,255,0.22)' },
    { values: ema20, kind: 'line', color: '#ffd166' },
  ],
}
```

`type: 'line'` and `'area'` plot the close. Overlays accept the same shape as
indicator series (line / area / band / histogram).

## `indicator`

A standalone indicator pane below price. One required `indicator` series, plus
optional `overlays`.

```ts
{
  id: 'rsi', kind: 'indicator', weight: 1, title: 'RSI 14',
  indicator: {
    values: rsi,                       // Float32Array (or column ref in spec)
    kind: 'line',                      // 'line' | 'area' | 'band' | 'histogram'
    color: '#a3ff12',
    refLines: [30, 70],                // dashed horizontal references
    yRange: [0, 100],                  // omit for autoscale
  },
}
```

Use `kind: 'histogram'` with `colorNegative` for MACD-style oscillators.

## `heatmap`

Labeled 2D grid. Default colour scale is diverging red→white→blue, symmetric
around zero. Pass a `colorScale` (function in core; `{ neg, mid, pos }` hex
triplet in the JSON spec) to override.

```ts
{
  id: 'monthly', kind: 'heatmap', weight: 1, title: 'Monthly Returns',
  heatmap: {
    rows: ['2024', '2023', '2022'],
    cols: ['Jan','Feb',…,'Dec'],
    values: [[0.012, -0.005, …], …],   // [row][col], may contain null
    format: (v) => `${(v*100).toFixed(1)}%`,
  },
}
```

## `hbar`

Horizontal bars centred on `x = 0`. Positive bars use `positiveColor`, negative
use `negativeColor`. `showMean: true` draws a dashed mean line.

```ts
{
  id: 'yearly', kind: 'hbar', weight: 1, title: 'Yearly Returns',
  hbar: {
    categories: ['2020', '2021', '2022', '2023', '2024'],
    values: [0.18, 0.27, -0.19, 0.24, 0.11],
    showMean: true,
    positiveColor: '#1f5fa6',
    negativeColor: '#c44',
  },
}
```

## `histogram`

Equal-width bins of raw observations. Distinct from `indicator` `kind:
'histogram'`, which is bar-indexed. Use this for return distributions.

```ts
{
  id: 'dist', kind: 'histogram', weight: 1, title: 'Daily Returns',
  histogram: {
    values: dailyReturns,
    bins: 24,
    showMean: true,
    color: '#1f5fa6',
  },
}
```

## `scatter`

Free 2D scatter with optional `y = x` reference line. Used for QQ plots,
factor exposures, and anything else two-dimensional.

```ts
{
  id: 'qq', kind: 'scatter', weight: 1, title: 'QQ vs Normal',
  scatter: {
    points: qqPoints,                  // [{ x, y }, …]
    identityLine: true,
    pointColor: '#1f5fa6',
    pointRadius: 2.5,
  },
}
```

---

## Mixing kinds

A chart can mix time-indexed and self-contained panels freely. The engine
detects whether any time-indexed panel is present and shows / hides the shared
time axis accordingly.

A typical *tearsheet* layout:

```
┌─────────────────────────┐
│ price       (price)     │
├─────────────────────────┤
│ rolling vol (indicator) │
├─────────────────────────┤
│ heatmap     (heatmap)   │
├─────────────────────────┤
│ yearly      (hbar)      │
├─────────────────────────┤
│ dist        (histogram) │
├─────────────────────────┤
│ qq          (scatter)   │
└─────────────────────────┘
```

See [`apps/playground/src/PortfolioOverview.tsx`](../apps/playground/src/PortfolioOverview.tsx)
for a complete worked example.
