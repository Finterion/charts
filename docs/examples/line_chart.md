# Line Chart

Render OHLCV bars as a continuous line instead of candles. Useful for equity
curves, index comparisons, and any context where body shape adds noise rather
than signal.

## Data

Daily BTC/USD bars (2023-03-11 → 2023-07-31). Each bar has a `timestamp` ISO
string plus `open`, `high`, `low`, `close`, and `volume` fields.

```json
[
    {
        "close": 19219,
        "high": 19682,
        "low": 18655,
        "open": 18986,
        "timestamp": "2023-03-11T00:00:00",
        "volume": 430.96337327
    },
    {
        "close": 20665,
        "high": 20700,
        "low": 19097,
        "open": 19231,
        "timestamp": "2023-03-12T00:00:00",
        "volume": 570.40631158
    },
    {
        "close": 22338,
        "high": 22727,
        "low": 20265,
        "open": 20681,
        "timestamp": "2023-03-13T00:00:00",
        "volume": 1262.70186029
    },
   ...
]
```

## React

```tsx
import { Chart } from '@finterion/charts-react';
import type { OHLC } from '@finterion/charts-core';

// Raw data loaded from your API / import. The engine expects `time` as a
// millisecond epoch number, so convert the ISO timestamp on the way in.
const raw: Array<{
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> = DATA; // replace with your import or fetch result

const data: OHLC[] = raw.map((bar) => ({
  time: new Date(bar.timestamp).getTime(),
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
  volume: bar.volume,
}));

export function BtcLineChart() {
  return (
    <Chart
      data={data}
      panels={[{ id: 'price', kind: 'price', weight: 1, type: 'line' }]}
      theme="finterion-dark"
      initialFit="all"
      style={{ width: '100%', height: 400 }}
    />
  );
}
```

## Python

```python
import json
from datetime import datetime, timezone
from finterion_charts import ChartSpec, Price

# Load the data (adjust path or replace with an API call).
with open("line_chart.json") as f:
    raw = json.load(f)

# The engine expects time as millisecond epoch floats.
def _to_ms(iso: str) -> float:
    dt = datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)
    return dt.timestamp() * 1000

time   = [_to_ms(bar["timestamp"]) for bar in raw]
open_  = [bar["open"]   for bar in raw]
high   = [bar["high"]   for bar in raw]
low    = [bar["low"]    for bar in raw]
close  = [bar["close"]  for bar in raw]
volume = [bar["volume"] for bar in raw]

spec = (
    ChartSpec(theme="finterion-dark")
    .with_bars(time=time, open=open_, high=high, low=low, close=close, volume=volume)
    .add_panel(Price(id="price", weight=1, type="line"))
)

# Jupyter / VS Code notebook — renders inline:
spec.display()

# Plain Python script — opens in the default browser:
# spec.show()
```

---

## Monthly Returns Heatmap

Aggregate daily returns into monthly compound returns and display them as a
`kind: 'heatmap'` panel. Rows are years, columns are months. A custom
`colorScale` gives losing months a red glow and winning months a green glow
against a black background — matching the terminal-green style shown in the
screenshot.

### React

```tsx
import { useMemo } from 'react';
import { Chart } from '@finterion/charts-react';
import type { PanelSpec } from '@finterion/charts-core';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Replace with your own daily-return data: array of { year, month (0-based), ret }
const monthly: Array<{ year: number; month: number; ret: number }> = MY_DAILY_RETURNS;

// Build the heatmap rows × cols grid (newest year on top)
function buildHeatmap(data: typeof monthly) {
  const years = [...new Set(data.map((d) => d.year))].sort((a, b) => b - a);
  const rows = years.map(String);
  const values: (number | null)[][] = years.map(() => Array<number | null>(12).fill(null));
  const idx = new Map(years.map((y, i) => [y, i]));
  for (const m of data) {
    const r = idx.get(m.year);
    if (r !== undefined) values[r]![m.month] = m.ret;
  }
  return { rows, values };
}

// Phosphor color scale: negative → red, positive → green, zero → black
function terminalColorScale(t: number): string {
  const v = Math.abs(t);
  if (t < 0) return `rgb(${Math.round(180 * v)},${Math.round(20 * (1 - v))},0)`;
  return `rgb(${Math.round(10 * (1 - v))},${Math.round(80 + 175 * v)},${Math.round(10 * (1 - v))})`;
}

export function MonthlyReturnsHeatmap() {
  const { rows, values } = useMemo(() => buildHeatmap(monthly), []);

  const panels = useMemo<PanelSpec[]>(
    () => [
      {
        id: 'monthly-returns',
        kind: 'heatmap',
        weight: 1,
        heatmap: {
          rows,
          cols: MONTHS,
          values,
          format: (v) => `${(v * 100).toFixed(1)}`,
          colorScale: terminalColorScale,
          xLabel: 'Month',
          yLabel: 'Year',
        },
      },
    ],
    [rows, values],
  );

  return (
    <Chart
      panels={panels}
      background="#000000"
      gridColor="rgba(0,255,55,0.35)"
      style={{ width: '100%', height: 340 }}
    />
  );
}
```

### Python

```python
from finterion_charts import ChartSpec, Heatmap

MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

# Replace with your own data. Each item: { year, month (1-based), ret (decimal) }
monthly = MY_MONTHLY_RETURNS  # e.g. [{'year': 2016, 'month': 1, 'ret': 0.034}, ...]

# Build rows × cols grid (newest year on top)
years = sorted({m['year'] for m in monthly}, reverse=True)
rows = [str(y) for y in years]
year_idx = {y: i for i, y in enumerate(years)}
values = [[None] * 12 for _ in years]
for m in monthly:
    r = year_idx.get(m['year'])
    if r is not None:
        values[r][m['month'] - 1] = m['ret']

spec = (
    ChartSpec(background='#000000', grid_color='rgba(0,255,55,0.35)')
    .add_panel(
        Heatmap(
            id='monthly-returns',
            weight=1,
            rows=rows,
            cols=MONTHS,
            values=values,
            format=lambda v: f'{v * 100:.1f}',
            x_label='Month',
            y_label='Year',
        )
    )
)

spec.display()  # Jupyter / VS Code notebook
# spec.show()   # plain Python script — opens in browser
```

---

## Portfolio Demo


A QF-Lib-style tearsheet that combines multiple non-time panel kinds
(`heatmap`, `hbar`, `histogram`, `scatter`) alongside time-series panels,
all rendered through `<Chart>`.

```tsx
/**
 * QF-Lib-style portfolio tearsheet. Every panel is rendered through
 * `<Chart>` from `@finterion/charts-react` — the two time-series panels use
 * `kind: 'price'` (line) on synthetic OHLC bars, the others use the new
 * non-time panel kinds (`heatmap`, `hbar`, `histogram`, `scatter`).
 */
import { useMemo } from 'react';
import { Chart } from '@finterion/charts-react';
import type { OHLC, PanelSpec } from '@finterion/charts-core';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ───────────────────────── deterministic RNG ─────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ───────────────────────── synthetic data ─────────────────────────
interface DayPoint {
  date: Date;
  ret: number;
  equity: number;
}

function generateDaily(startYear = 2006, years = 11, seed = 7): DayPoint[] {
  const rand = mulberry32(seed);
  const out: DayPoint[] = [];
  const start = new Date(Date.UTC(startYear, 0, 2));
  const end = new Date(Date.UTC(startYear + years, 0, 1));
  let equity = 1;
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const mu = 0.16 / 252;
    const sigma = 0.14 / Math.sqrt(252);
    const yr = d.getUTCFullYear();
    const shock = yr === 2008 ? -0.0018 : yr === 2015 ? -0.0006 : 0;
    const r = mu + shock + sigma * gauss(rand);
    equity *= 1 + r;
    out.push({ date: new Date(d), ret: r, equity });
  }
  return out;
}

interface MonthlyCell {
  year: number;
  month: number; // 0..11
  ret: number;
}

function aggregateMonthly(points: DayPoint[]): MonthlyCell[] {
  const map = new Map<string, number>();
  for (const p of points) {
    const k = `${p.date.getUTCFullYear()}-${p.date.getUTCMonth()}`;
    const cur = map.get(k);
    map.set(k, (cur === undefined ? 1 : cur) * (1 + p.ret));
  }
  return Array.from(map.entries())
    .map(([k, v]) => {
      const [y, m] = k.split('-').map(Number);
      return { year: y!, month: m!, ret: v - 1 };
    })
    .sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month));
}

function aggregateYearly(monthly: MonthlyCell[]): { year: number; ret: number }[] {
  const map = new Map<number, number>();
  for (const m of monthly) {
    const cur = map.get(m.year);
    map.set(m.year, (cur === undefined ? 1 : cur) * (1 + m.ret));
  }
  return Array.from(map.entries())
    .map(([year, v]) => ({ year, ret: v - 1 }))
    .sort((a, b) => a.year - b.year);
}

function rollingStats(points: DayPoint[], window = 126) {
  const n = points.length;
  const rollRet = new Float32Array(n);
  const rollVol = new Float32Array(n);
  rollRet.fill(NaN);
  rollVol.fill(NaN);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    sum += points[i]!.ret;
    sumSq += points[i]!.ret * points[i]!.ret;
    if (i >= window) {
      sum -= points[i - window]!.ret;
      sumSq -= points[i - window]!.ret * points[i - window]!.ret;
    }
    if (i >= window - 1) {
      const mean = sum / window;
      const variance = Math.max(0, sumSq / window - mean * mean);
      rollRet[i] = mean * 252;
      rollVol[i] = Math.sqrt(variance * 252);
    }
  }
  return { rollRet, rollVol };
}

function pointsToBars(points: DayPoint[]): OHLC[] {
  return points.map((p) => ({
    time: p.date.getTime(),
    open: p.equity,
    high: p.equity,
    low: p.equity,
    close: p.equity,
  }));
}

function buildHeatmapValues(monthly: MonthlyCell[]): { rows: string[]; values: (number | null)[][] } {
  const years = Array.from(new Set(monthly.map((m) => m.year))).sort((a, b) => b - a);
  const rows = years.map(String);
  const values: (number | null)[][] = years.map(() => new Array<number | null>(12).fill(null));
  const yearIdx = new Map(years.map((y, i) => [y, i]));
  for (const m of monthly) {
    const r = yearIdx.get(m.year);
    if (r === undefined) continue;
    values[r]![m.month] = m.ret;
  }
  return { rows, values };
}

function buildQQPoints(monthly: MonthlyCell[]): { x: number; y: number }[] {
  const sorted = [...monthly.map((m) => m.ret)].sort((a, b) => a - b);
  const mean = sorted.reduce((s, r) => s + r, 0) / sorted.length;
  const std = Math.sqrt(
    sorted.reduce((s, r) => s + (r - mean) * (r - mean), 0) / sorted.length,
  );
  return sorted.map((r, i) => {
    const p = (i + 0.5) / sorted.length;
    return { x: invNorm(p), y: (r - mean) / std };
  });
}

// ───────────────────────── component ─────────────────────────
export function PortfolioOverview() {
  const points = useMemo(() => generateDaily(2006, 11, 7), []);
  const monthly = useMemo(() => aggregateMonthly(points), [points]);
  const yearly = useMemo(() => aggregateYearly(monthly), [monthly]);
  const { rollRet, rollVol } = useMemo(() => rollingStats(points, 126), [points]);
  const equityBars = useMemo(() => pointsToBars(points), [points]);
  const heat = useMemo(() => buildHeatmapValues(monthly), [monthly]);
  const qqPoints = useMemo(() => buildQQPoints(monthly), [monthly]);

  const performancePanels: PanelSpec[] = useMemo(
    () => [{ id: 'equity', kind: 'price', type: 'line', weight: 1, title: 'Strategy Performance' }],
    [],
  );

  const rollingPanels: PanelSpec[] = useMemo(
    () => [
      {
        id: 'roll-ret',
        kind: 'indicator',
        weight: 1,
        title: 'Rolling Return (annualised)',
        indicator: { values: rollRet, kind: 'line', color: '#1f5fa6' },
      },
      {
        id: 'roll-vol',
        kind: 'indicator',
        weight: 1,
        title: 'Rolling Volatility (annualised)',
        indicator: { values: rollVol, kind: 'line', color: '#9aa3ad' },
      },
    ],
    [rollRet, rollVol],
  );

  const heatmapPanels: PanelSpec[] = useMemo(
    () => [
      {
        id: 'monthly-heat',
        kind: 'heatmap',
        weight: 1,
        title: 'Monthly Returns',
        heatmap: {
          rows: heat.rows,
          cols: MONTHS,
          values: heat.values,
          format: (v) => `${(v * 100).toFixed(1)}`,
          xLabel: 'Month',
          yLabel: 'Year',
        },
      },
    ],
    [heat],
  );

  const yearlyPanels: PanelSpec[] = useMemo(() => {
    const sorted = [...yearly].sort((a, b) => b.year - a.year);
    return [
      {
        id: 'yearly-bars',
        kind: 'hbar',
        weight: 1,
        title: 'Yearly Returns',
        hbar: {
          categories: sorted.map((d) => String(d.year)),
          values: sorted.map((d) => d.ret),
          positiveColor: '#1f5fa6',
          negativeColor: '#c44',
          showMean: true,
          format: (v) => `${(v * 100).toFixed(1)}%`,
          xLabel: 'Returns',
          yLabel: 'Year',
        },
      },
    ];
  }, [yearly]);

  const distPanels: PanelSpec[] = useMemo(
    () => [
      {
        id: 'monthly-dist',
        kind: 'histogram',
        weight: 1,
        title: 'Distribution of Monthly Returns',
        histogram: {
          values: monthly.map((m) => m.ret),
          bins: 18,
          color: '#1f5fa6',
          showMean: true,
          formatX: (v) => `${(v * 100).toFixed(0)}%`,
          xLabel: 'Returns',
          yLabel: 'Occurrences',
        },
      },
    ],
    [monthly],
  );

  const qqPanels: PanelSpec[] = useMemo(
    () => [
      {
        id: 'qq',
        kind: 'scatter',
        weight: 1,
        title: 'Normal Distribution Q-Q',
        scatter: {
          points: qqPoints,
          identityLine: true,
          pointColor: '#1f5fa6',
          pointRadius: 2.5,
          xLabel: 'Normal Distribution Quantile',
          yLabel: 'Observed Quantile',
        },
      },
    ],
    [qqPoints],
  );

  const chartCommon = {
    theme: 'finterion-light',
    titleFontSize: 12,
    titlePadding: { top: 8, left: 12 },
    titleSpace: 24,
    gridStyle: 'horizontal' as const,
    panelGap: 8,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#e7e9ec', padding: '32px 16px' }}>
      <div style={{ width: 820, margin: '0 auto', background: 'white', padding: 24 }}>
        {/* Equity curve */}
        <Chart data={equityBars} panels={performancePanels} {...chartCommon} style={{ height: 210 }} />

        {/* Monthly heatmap + yearly bar chart */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <Chart panels={heatmapPanels} {...chartCommon} style={{ flex: 1, height: 230 }} />
          <Chart panels={yearlyPanels} {...chartCommon} style={{ flex: 1, height: 230 }} />
        </div>

        {/* Return distribution + Q-Q plot */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <Chart panels={distPanels} {...chartCommon} style={{ flex: 1, height: 210 }} />
          <Chart panels={qqPanels} {...chartCommon} style={{ flex: 1, height: 210 }} />
        </div>

        {/* Rolling return & volatility */}
        <Chart
          data={equityBars}
          panels={rollingPanels}
          {...chartCommon}
          style={{ height: 260, marginTop: 16 }}
        />
      </div>
    </div>
  );
}
```