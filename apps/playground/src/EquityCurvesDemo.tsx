import { useMemo, useState } from 'react';
import { Chart } from '@finterion/charts-react';
import type { IndicatorSeries, OHLC, PanelSpec } from '@finterion/charts-core';
import { TopBar, Card, CardHeader, KpiTile, ToggleGroup, Overline } from './finterion/components';
import { colors, spacing } from './finterion/tokens';
import { useChartTheme } from './finterion/themeContext';

const N_BARS = 504; // ~2 years of trading days
const N_ALGOS = 20;

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
  values: Float32Array;
  finalEquity: number;
  cagr: number; // annualised (assumes 252 daily bars / year)
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

function generateEquityCurves(nBars: number, nAlgos: number): {
  bars: OHLC[];
  curves: AlgoCurve[];
} {
  const start = Date.now() - nBars * 86400_000; // daily bars
  const bars: OHLC[] = new Array(nBars);
  for (let i = 0; i < nBars; i++) {
    bars[i] = { time: start + i * 86400_000, open: 1, high: 1, low: 1, close: 1 };
  }
  const curves: AlgoCurve[] = [];
  for (let a = 0; a < nAlgos; a++) {
    const rng = makeRng(0x1234 + a * 977);
    // Each algo has its own drift/vol profile — most are slightly positive.
    const drift = (rng() - 0.40) * 0.0014;     // ~ −0.06% .. +0.08% daily
    const vol = 0.006 + rng() * 0.020;          // 0.6%  .. 2.6% daily
    const values = new Float32Array(nBars);
    let eq = 1.0;
    let peak = 1.0;
    let maxDD = 0;
    for (let i = 0; i < nBars; i++) {
      // Box-Muller-ish normal-ish noise (two uniforms summed → triangle, fine for a demo).
      const z = (rng() + rng() + rng() - 1.5) * 1.4142;
      const ret = drift + z * vol;
      eq *= 1 + ret;
      if (eq > peak) peak = eq;
      const dd = eq / peak - 1;
      if (dd < maxDD) maxDD = dd;
      values[i] = eq;
    }
    const years = nBars / 252;
    const cagr = Math.pow(eq, 1 / years) - 1;
    curves.push({
      id: `algo-${a}`,
      label: ALGO_NAMES[a] ?? `Algo ${a + 1}`,
      color: PALETTE[a % PALETTE.length]!,
      values,
      finalEquity: eq,
      cagr,
      maxDD,
    });
  }
  return { bars, curves };
}

type SortKey = 'cagr' | 'maxdd' | 'name';

export function EquityCurvesDemo() {
  const { bars, curves } = useMemo(() => generateEquityCurves(N_BARS, N_ALGOS), []);
  const [sortBy, setSortBy] = useState<SortKey>('cagr');
  const theme = useChartTheme();

  // The chart's autoscale only looks at the main indicator series, so we
  // compute a global y-range that envelopes every curve and pin it on the
  // primary indicator. Includes a ±5% pad.
  const yRange = useMemo<[number, number]>(() => {
    let lo = Infinity, hi = -Infinity;
    for (const c of curves) {
      for (let i = 0; i < c.values.length; i++) {
        const v = c.values[i]!;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    const pad = (hi - lo) * 0.05;
    return [lo - pad, hi + pad];
  }, [curves]);

  const sortedCurves = useMemo(() => {
    const arr = [...curves];
    if (sortBy === 'cagr') arr.sort((a, b) => b.cagr - a.cagr);
    else if (sortBy === 'maxdd') arr.sort((a, b) => b.maxDD - a.maxDD);
    else arr.sort((a, b) => a.label.localeCompare(b.label));
    return arr;
  }, [curves, sortBy]);

  const panels = useMemo<PanelSpec[]>(() => {
    if (!sortedCurves.length) return [];
    const [first, ...rest] = sortedCurves;
    const toSeries = (c: AlgoCurve): IndicatorSeries => ({
      id: c.id,
      label: c.label,
      metric: `${c.cagr >= 0 ? '+' : ''}${(c.cagr * 100).toFixed(1)}%`,
      values: c.values,
      kind: 'line',
      color: c.color,
    });
    return [
      {
        id: 'equity',
        kind: 'indicator',
        weight: 1,
        title: `${curves.length} Algorithms`,
        indicator: {
          ...toSeries(first!),
          yRange,
          refLines: [1.0],
        },
        overlays: rest.map(toSeries),
      },
    ];
  }, [sortedCurves, yRange, curves.length]);

  const best = sortedCurves[0];
  const worst = sortedCurves[sortedCurves.length - 1];
  const medianCagr = median(sortedCurves.map((c) => c.cagr));
  const medianDD = median(sortedCurves.map((c) => c.maxDD));

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
        subtitle={`${curves.length} algorithms · ${bars.length} daily bars · ~${(N_BARS / 252).toFixed(1)} years`}
        tag="DEMO"
        right={
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
              subtitle="Legend is rendered to the right — click the eye to isolate or hide a curve."
            />
            <div style={{ width: '100%', height: 420 }}>
              <Chart
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
              />
            </div>
          </div>
        </Card>
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
