import { useMemo, useState } from 'react';
import { Chart } from '@finterion/charts-react';
import { alignByDuration, type IndicatorSeries, type OHLC, type PanelSpec } from '@finterion/charts-core';
import { TopBar, Card, CardHeader, KpiTile, ToggleGroup, Overline } from './finterion/components';
import { colors, spacing } from './finterion/tokens';
import { useChartTheme } from './finterion/themeContext';

const N_ALGOS = 20;
const DAY_MS = 86_400_000;
const YEAR_BARS = 252; // trading days
// The staggered date window each backtest picks its start from.
const WINDOW_START = Date.UTC(2020, 0, 1);
const WINDOW_END = Date.UTC(2026, 0, 1);
const MIN_LEN = Math.round(YEAR_BARS * 0.75); // ≥ 9 months
const MAX_LEN = YEAR_BARS * 3;                // ≤ 3 years

// 20-color palette tuned for the Finterion light canvas — brand chart series
// first, then a denser distinguishable spread so 20 curves stay readable on
// white without screaming.
const PALETTE = [
  '#0969da', '#8250df', '#bf8700', '#cf222e', '#1a7f37',
  '#0a3069', '#6639ba', '#7d4e00', '#9e1420', '#0e5e2a',
  '#2b7cd3', '#a48dd9', '#d4a72c', '#ec5b6a', '#4dab6f',
  '#1f6feb', '#bc8cff', '#dbab09', '#ff7b72', '#3fb950',
];

const ALGO_NAMES = [
  'MeanRev-Z',
  'Momentum-12-1',
  'Trend-Breakout',
  'Pairs-Stat',
  'Vol-Carry',
  'RSI-Divergence',
  'BB-Reversion',
  'MACD-Cross',
  'Kalman-Trend',
  'GARCH-Vol',
  'PPO-Squeeze',
  'CCI-Surge',
  'ADX-Filter',
  'Donchian-20',
  'Ichimoku-Cloud',
  'Heikin-Trend',
  'SuperTrend-3x10',
  'Keltner-Break',
  'Stoch-Slow',
  'OBV-Trend',
];

interface AlgoCurve {
  id: string;
  label: string;
  color: string;
  /** Absolute UTC ms timestamp of the first bar. */
  startTime: number;
  /** Per-bar equity values (starts at 1.0). */
  values: Float32Array;
  finalEquity: number;
  cagr: number;
  maxDD: number;
}

function makeRng(seed: number): () => number {
  // Mulberry32 — deterministic pseudo-random so the demo looks the same
  // between reloads.
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate `nAlgos` equity curves, each with a random start date within
 *  `[WINDOW_START, WINDOW_END)` and a random length in trading days. This is
 *  the realistic case: every backtest ran over a different date range. */
function generateEquityCurves(nAlgos: number): AlgoCurve[] {
  const curves: AlgoCurve[] = [];
  for (let a = 0; a < nAlgos; a++) {
    const rng = makeRng(0x1234 + a * 977);
    const len = Math.round(MIN_LEN + rng() * (MAX_LEN - MIN_LEN));
    // Anchor the start so the whole run fits in the window.
    const maxStartOffsetDays = Math.max(0, Math.floor((WINDOW_END - WINDOW_START) / DAY_MS) - len);
    const startOffsetDays = Math.floor(rng() * (maxStartOffsetDays + 1));
    const startTime = WINDOW_START + startOffsetDays * DAY_MS;

    const drift = (rng() - 0.40) * 0.0014;    // ~ −0.06% .. +0.08% daily
    const vol = 0.006 + rng() * 0.020;         // 0.6% .. 2.6% daily
    const values = new Float32Array(len);
    let eq = 1.0;
    let peak = 1.0;
    let maxDD = 0;
    for (let i = 0; i < len; i++) {
      // Box-Muller-ish normal-ish noise (two uniforms summed → triangle, fine for a demo).
      const z = (rng() + rng() + rng() - 1.5) * 1.4142;
      const ret = drift + z * vol;
      eq *= 1 + ret;
      if (eq > peak) peak = eq;
      const dd = eq / peak - 1;
      if (dd < maxDD) maxDD = dd;
      values[i] = eq;
    }
    const years = len / YEAR_BARS;
    const cagr = Math.pow(eq, 1 / years) - 1;
    curves.push({
      id: `algo-${a}`,
      label: ALGO_NAMES[a] ?? `Algo ${a + 1}`,
      color: PALETTE[a % PALETTE.length]!,
      startTime,
      values,
      finalEquity: eq,
      cagr,
      maxDD,
    });
  }
  return curves;
}

/** Build a shared calendar time axis spanning every curve's actual date
 *  range, and NaN-pad each curve into its correct slice. Left-pads curves
 *  that started late; right-pads curves that finished early. */
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
    const t = globalStart + i * DAY_MS;
    bars[i] = { time: t, open: 1, high: 1, low: 1, close: 1 };
  }
  const padded: Float32Array[] = curves.map((c) => {
    const out = new Float32Array(n);
    out.fill(NaN);
    const offset = Math.round((c.startTime - globalStart) / DAY_MS);
    for (let i = 0; i < c.values.length; i++) out[offset + i] = c.values[i]!;
    return out;
  });
  return { bars, padded };
}

/** Alignment axis used by the chart. */
type AlignMode = 'date' | 'duration';
type SortKey = 'cagr' | 'maxdd' | 'name';

export function EquityCurvesDemo() {
  const curves = useMemo(() => generateEquityCurves(N_ALGOS), []);
  const [sortBy, setSortBy] = useState<SortKey>('cagr');
  const [alignMode, setAlignMode] = useState<AlignMode>('duration');
  const theme = useChartTheme();

  const sortedCurves = useMemo(() => {
    const arr = [...curves];
    if (sortBy === 'cagr') arr.sort((a, b) => b.cagr - a.cagr);
    else if (sortBy === 'maxdd') arr.sort((a, b) => b.maxDD - a.maxDD);
    else arr.sort((a, b) => a.label.localeCompare(b.label));
    return arr;
  }, [curves, sortBy]);

  // Build the two things the Chart needs — `bars` and per-curve `values` —
  // in the currently-selected alignment mode.
  const { bars, alignedValues } = useMemo(() => {
    if (alignMode === 'duration') {
      const aligned = alignByDuration(
        sortedCurves.map((c) => ({
          values: c.values,
          // The elapsed-ms axis is derived from the length + shared bar
          // interval; timestamps are only used to *infer* spacing.
        })),
        { barIntervalMs: DAY_MS },
      );
      const b: OHLC[] = new Array(aligned.time.length);
      for (let i = 0; i < aligned.time.length; i++) {
        b[i] = { time: aligned.time[i]!, open: 1, high: 1, low: 1, close: 1 };
      }
      return { bars: b, alignedValues: aligned.values };
    }
    const { bars: b, padded } = alignByDate(sortedCurves);
    return { bars: b, alignedValues: padded };
  }, [sortedCurves, alignMode]);

  // Global y-range envelope so autoscale doesn't clip overlays.
  const yRange = useMemo<[number, number]>(() => {
    let lo = Infinity, hi = -Infinity;
    for (const arr of alignedValues) {
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i]!;
        if (!Number.isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!Number.isFinite(lo)) return [0, 2];
    const pad = (hi - lo) * 0.05;
    return [lo - pad, hi + pad];
  }, [alignedValues]);

  const panels = useMemo<PanelSpec[]>(() => {
    if (!sortedCurves.length) return [];
    const toSeries = (c: AlgoCurve, i: number): IndicatorSeries => ({
      id: c.id,
      label: c.label,
      metric: `${c.cagr >= 0 ? '+' : ''}${(c.cagr * 100).toFixed(1)}%`,
      values: alignedValues[i]!,
      kind: 'line',
      color: c.color,
    });
    const [first, ...rest] = sortedCurves.map((c, i) => toSeries(c, i));
    return [
      {
        id: 'equity',
        kind: 'indicator',
        weight: 1,
        title: `${curves.length} Algorithms`,
        indicator: {
          ...first!,
          yRange,
          refLines: [1.0],
        },
        overlays: rest,
      },
    ];
  }, [sortedCurves, alignedValues, yRange, curves.length]);

  const best = sortedCurves[0];
  const worst = sortedCurves[sortedCurves.length - 1];
  const medianCagr = median(sortedCurves.map((c) => c.cagr));
  const medianDD = median(sortedCurves.map((c) => c.maxDD));

  const minLenDays = sortedCurves.length
    ? Math.min(...sortedCurves.map((c) => c.values.length))
    : 0;
  const maxLenDays = sortedCurves.length
    ? Math.max(...sortedCurves.map((c) => c.values.length))
    : 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.canvasSubtle,
        color: colors.ink,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <TopBar
        title="Equity Curves"
        subtitle={
          alignMode === 'duration'
            ? `${curves.length} algorithms · aligned by elapsed duration · runs ${minLenDays}–${maxLenDays} days`
            : `${curves.length} algorithms · aligned by calendar date · staggered starts 2020–2025`
        }
        tag="DEMO"
        right={
          <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
              <Overline style={{ color: colors.inkMuted, marginRight: 4 }}>Axis</Overline>
              <ToggleGroup<AlignMode>
                size="sm"
                value={alignMode}
                onChange={setAlignMode}
                options={[
                  { label: 'Duration', value: 'duration' },
                  { label: 'Date', value: 'date' },
                ]}
              />
            </div>
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
              <Overline style={{ color: colors.inkMuted, marginRight: 4 }}>Sort</Overline>
              <ToggleGroup<SortKey>
                size="sm"
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { label: 'CAGR', value: 'cagr' },
                  { label: 'Max DD', value: 'maxdd' },
                  { label: 'Name', value: 'name' },
                ]}
              />
            </div>
          </div>
        }
      />

      <div style={{ padding: spacing.lg, maxWidth: 1080, margin: '0 auto' }}>
        {/* KPI strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          {best && (
            <KpiTile
              label="Best CAGR"
              value={`${(best.cagr * 100).toFixed(1)}%`}
              delta={best.label}
              tone="up"
            />
          )}
          {worst && (
            <KpiTile
              label="Worst CAGR"
              value={`${(worst.cagr * 100).toFixed(1)}%`}
              delta={worst.label}
              tone={worst.cagr < 0 ? 'down' : 'flat'}
            />
          )}
          <KpiTile
            label="Median CAGR"
            value={`${(medianCagr * 100).toFixed(1)}%`}
            delta={`across ${curves.length} strategies`}
            tone={medianCagr >= 0 ? 'up' : 'down'}
          />
          <KpiTile
            label="Median Max DD"
            value={`${(medianDD * 100).toFixed(1)}%`}
            delta="lower is better"
            tone="down"
          />
        </div>

        {/* Chart card — chart + right-side legend sidebar */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: `${spacing.md}px ${spacing.lg}px` }}>
            <CardHeader
              title={`${curves.length} Algorithms · Equity Curves`}
              subtitle={
                alignMode === 'duration'
                  ? 'Every curve starts at t=0. The x-axis shows elapsed time since each backtest began — perfect for comparing strategies that ran over different date ranges.'
                  : 'Every curve keeps its real calendar dates. Staggered starts and different run lengths are visible as gaps on the left and right of each line.'
              }
            />
            <div style={{ width: '100%', height: 420 }}>
              <Chart
                key={alignMode}
                data={bars}
                panels={panels}
                theme={theme}
                titleFontSize={12}
                titlePadding={{ top: 8, left: 12 }}
                titleSpace={24}
                showLegend="auto"
                legendPosition="right"
                legendWidth={220}
                initialFit="all"
                timeFormat={alignMode === 'duration' ? 'duration' : undefined}
              />
            </div>
          </div>
        </Card>

        {/* Code-snippet card — show how to define this chart in the three
            supported surfaces (React, Python, plain HTML embed). */}
        <div style={{ marginTop: spacing.lg }}>
          <CodeSnippets alignMode={alignMode} />
        </div>
      </div>
    </div>
  );
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >>> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ──────────────────────────────────────────────────────────────────────
// "How do I build this chart?" — code samples for the three surfaces
// (React, Python, plain HTML iframe). Static strings; nothing dynamic.
// ──────────────────────────────────────────────────────────────────────

type Lang = 'react' | 'python' | 'html';

const SNIPPETS_DURATION: Record<Lang, { label: string; subtitle: string; code: string }> = {
  react: {
    label: 'React',
    subtitle: 'TypeScript · @finterion/charts-react',
    code: `import { Chart } from '@finterion/charts-react';
import { alignByDuration, type OHLC, type PanelSpec } from '@finterion/charts-core';

// Each backtest ran over its own date range — different starts and lengths.
// alignByDuration builds a shared synthetic time axis (ms since t=0) and
// right-pads shorter curves with NaN, so every curve starts at bar 0.
const aligned = alignByDuration(
  curves.map((c) => ({ values: c.values, times: c.timestamps })),
  { barIntervalMs: 86_400_000 }, // 1 day
);

const bars: OHLC[] = Array.from(aligned.time, (t) => ({
  time: t, open: 1, high: 1, low: 1, close: 1,
}));

const [first, ...rest] = curves;
const panels: PanelSpec[] = [{
  id: 'equity',
  kind: 'indicator',
  weight: 1,
  title: \`\${curves.length} Algorithms\`,
  indicator: {
    id: first.id, label: first.label,
    values: aligned.values[0]!,
    kind: 'line', color: first.color,
    refLines: [1.0], yRange,
  },
  overlays: rest.map((c, i) => ({
    id: c.id, label: c.label,
    values: aligned.values[i + 1]!,
    kind: 'line', color: c.color,
  })),
}];

<Chart
  data={bars}
  panels={panels}
  theme="finterion-light"
  timeFormat="duration"   // axis + tooltip show "6M", "1Y 3M", ...
  showLegend="auto"
  legendPosition="right"
  initialFit="all"
/>;`,
  },
  python: {
    label: 'Python',
    subtitle: 'Jupyter / Streamlit · finterion-charts',
    code: `from finterion_charts import (
    ChartSpec, Display, Indicator, align_by_duration,
)

# curves: list of dicts {id, label, color, values, times}
aligned = align_by_duration(curves, bar_interval_ms=86_400_000)
n = len(aligned.time)

first, *rest = curves
spec = (
    ChartSpec(display=Display(theme="finterion-light", time_format="duration"))
    .with_bars(
        time=aligned.time,
        open=[1.0]*n, high=[1.0]*n, low=[1.0]*n, close=[1.0]*n,
    )
    .add_panel(Indicator.panel(
        id="equity", weight=1, title=f"{len(curves)} Algorithms",
        values=aligned.values[0], color=first["color"], label=first["label"],
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

spec.show()`,
  },
  html: {
    label: 'Plain HTML',
    subtitle: 'iframe embed · no build step',
    code: `<!--
  Duration-aligned overlay: build the synthetic time axis on the server
  (JS/Python), then post the ChartSpec into the sandboxed embed iframe.
-->
<iframe
  src="https://charts.finterion.com/embed/"
  width="100%" height="460"
  style="border:1px solid #d0d7de;border-radius:6px"
  loading="lazy"
  id="equity-frame"
></iframe>

<script>
  const spec = {
    version: 1,
    data: { bars: { time: [/* 0, 86400000, 172800000, ... ms elapsed */] } },
    display: {
      theme: "finterion-light",
      legendPosition: "right",
      timeFormat: "duration",     // "6M", "1Y 3M", ...
    },
    panels: [{
      id: "equity", kind: "indicator", weight: 1, title: "20 Algorithms",
      indicator: {
        id: "algo-0", label: "MeanRev-Z",
        values: [/* right-padded with null */], kind: "line", color: "#0969da",
        refLines: [1.0], yRange: [0.7, 1.6],
      },
      overlays: [ /* 19 more curves, each right-padded with null */ ],
    }],
  };
  document.getElementById('equity-frame').onload = (e) =>
    e.target.contentWindow.postMessage({ type: 'spec', spec }, '*');
</script>`,
  },
};

const SNIPPETS_DATE: Record<Lang, { label: string; subtitle: string; code: string }> = {
  react: {
    label: 'React',
    subtitle: 'TypeScript · @finterion/charts-react',
    code: `import { Chart } from '@finterion/charts-react';
import type { OHLC, PanelSpec } from '@finterion/charts-core';

// Build a shared calendar time axis spanning every curve's date range,
// then NaN-pad each curve into its correct slice.
const globalStart = Math.min(...curves.map((c) => c.startTime));
const globalEnd   = Math.max(...curves.map((c) => c.startTime + (c.values.length - 1) * 86_400_000));
const n = Math.round((globalEnd - globalStart) / 86_400_000) + 1;

const bars: OHLC[] = Array.from({ length: n }, (_, i) => ({
  time: globalStart + i * 86_400_000, open: 1, high: 1, low: 1, close: 1,
}));
const padded = curves.map((c) => {
  const out = new Float32Array(n).fill(NaN);
  const offset = Math.round((c.startTime - globalStart) / 86_400_000);
  out.set(c.values, offset);
  return out;
});

const [first, ...rest] = curves;
const panels: PanelSpec[] = [{
  id: 'equity', kind: 'indicator', weight: 1,
  title: \`\${curves.length} Algorithms\`,
  indicator: {
    id: first.id, label: first.label,
    values: padded[0]!,
    kind: 'line', color: first.color,
    refLines: [1.0], yRange,
  },
  overlays: rest.map((c, i) => ({
    id: c.id, label: c.label,
    values: padded[i + 1]!,
    kind: 'line', color: c.color,
  })),
}];

<Chart
  data={bars}
  panels={panels}
  theme="finterion-light"
  showLegend="auto"
  legendPosition="right"
  initialFit="all"
/>;`,
  },
  python: {
    label: 'Python',
    subtitle: 'Jupyter / Streamlit · finterion-charts',
    code: `import numpy as np
from finterion_charts import ChartSpec, Display, Indicator

DAY_MS = 86_400_000

# curves: list of dicts {id, label, color, values, start_time_ms}
global_start = min(c["start_time_ms"] for c in curves)
global_end   = max(c["start_time_ms"] + (len(c["values"]) - 1) * DAY_MS for c in curves)
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
    ChartSpec(display=Display(theme="finterion-light"))
    .with_bars(time=time, open=[1.0]*n, high=[1.0]*n, low=[1.0]*n, close=[1.0]*n)
    .add_panel(Indicator.panel(
        id="equity", weight=1, title=f"{len(curves)} Algorithms",
        values=pad(first), color=first["color"], label=first["label"],
        ref_lines=[1.0],
        overlays=[
            Indicator(id=c["id"], label=c["label"], values=pad(c),
                      kind="line", color=c["color"])
            for c in rest
        ],
    ))
)
spec.show()`,
  },
  html: {
    label: 'Plain HTML',
    subtitle: 'iframe embed · no build step',
    code: `<!--
  Date-aligned overlay: real calendar timestamps, curves padded with null
  where they weren't running. Post the spec into the sandboxed embed iframe.
-->
<iframe
  src="https://charts.finterion.com/embed/"
  width="100%" height="460"
  style="border:1px solid #d0d7de;border-radius:6px"
  loading="lazy"
  id="equity-frame"
></iframe>

<script>
  const spec = {
    version: 1,
    data: { bars: { time: [/* unix ms timestamps */] } },
    display: { theme: "finterion-light", legendPosition: "right" },
    panels: [{
      id: "equity", kind: "indicator", weight: 1, title: "20 Algorithms",
      indicator: {
        id: "algo-0", label: "MeanRev-Z",
        values: [/* null on left/right where the backtest wasn't running */],
        kind: "line", color: "#0969da",
        refLines: [1.0], yRange: [0.7, 1.6],
      },
      overlays: [ /* 19 more curves, each null-padded to the shared axis */ ],
    }],
  };
  document.getElementById('equity-frame').onload = (e) =>
    e.target.contentWindow.postMessage({ type: 'spec', spec }, '*');
</script>`,
  },
};

function CodeSnippets({ alignMode }: { alignMode: AlignMode }) {
  const [lang, setLang] = useState<Lang>('react');
  const [copied, setCopied] = useState(false);
  const snippets = alignMode === 'duration' ? SNIPPETS_DURATION : SNIPPETS_DATE;
  const snippet = snippets[lang];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore clipboard errors (eg. insecure context) */
    }
  };

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: `${spacing.md}px ${spacing.lg}px` }}>
        <CardHeader
          title="Define this chart"
          subtitle={
            alignMode === 'duration'
              ? 'Uses alignByDuration + timeFormat="duration" to overlay curves that ran over different date ranges.'
              : 'Overlays curves on their real calendar timestamps, null-padded where each backtest wasn\u2019t running.'
          }
          right={
            <button
              type="button"
              onClick={handleCopy}
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '6px 10px',
                background: copied ? colors.quantUpSubtle : colors.canvas,
                color: copied ? colors.quantUp : colors.inkMuted,
                border: `1px solid ${copied ? colors.quantUp : colors.hairline}`,
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'background 120ms, color 120ms, border-color 120ms',
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          }
        />
        <ToggleGroup<Lang>
          size="sm"
          value={lang}
          onChange={setLang}
          options={[
            { label: 'React', value: 'react' },
            { label: 'Python', value: 'python' },
            { label: 'HTML', value: 'html' },
          ]}
        />
        <div
          style={{
            marginTop: spacing.sm,
            fontSize: 11,
            color: colors.inkMuted,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {snippet.subtitle}
        </div>
      </div>
      <pre
        style={{
          margin: 0,
          padding: `${spacing.md}px ${spacing.lg}px`,
          background: colors.surfaceConsole,
          color: colors.onDark,
          fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          lineHeight: 1.55,
          overflowX: 'auto',
          borderTop: `1px solid ${colors.hairlineSoft}`,
          tabSize: 2,
        }}
      >
        <code>{snippet.code}</code>
      </pre>
    </Card>
  );
}
