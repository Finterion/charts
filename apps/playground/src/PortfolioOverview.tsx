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

// Inverse standard normal (Beasley-Springer-Moro).
function invNorm(p: number): number {
  const a = [-3.969683028665376e+1, 2.209460984245205e+2, -2.759285104469687e+2, 1.38357751867269e+2, -3.066479806614716e+1, 2.506628277459239];
  const b = [-5.447609879822406e+1, 1.615858368580409e+2, -1.556989798598866e+2, 6.680131188771972e+1, -1.328068155288572e+1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  const ph = 1 - pl;
  let q: number, r: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p <= ph) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
}

// ───────────────────────── derived chart inputs ─────────────────────────
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

// ───────────────────────── small UI helpers ─────────────────────────
function fmtPct1(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
function fmtPct0(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function PanelCard({
  height,
  children,
}: {
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        height,
        background: 'white',
        border: '1px solid #d6d9de',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

// ───────────────────────── page ─────────────────────────
export function PortfolioOverview() {
  const points = useMemo(() => generateDaily(2006, 11, 7), []);
  const monthly = useMemo(() => aggregateMonthly(points), [points]);
  const yearly = useMemo(() => aggregateYearly(monthly), [monthly]);
  const { rollRet, rollVol } = useMemo(() => rollingStats(points, 126), [points]);
  const equityBars = useMemo(() => pointsToBars(points), [points]);
  const heat = useMemo(() => buildHeatmapValues(monthly), [monthly]);
  const qqPoints = useMemo(() => buildQQPoints(monthly), [monthly]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Equity-curve panel (line, no candles).
  const performancePanels: PanelSpec[] = useMemo(
    () => [
      {
        id: 'equity',
        kind: 'price',
        type: 'line',
        weight: 1,
        title: 'Strategy Performance',
      },
    ],
    [],
  );

  // Rolling stats: two indicator panels stacked, sharing the time axis.
  const rollingPanels: PanelSpec[] = useMemo(
    () => [
      {
        id: 'roll-ret',
        kind: 'indicator',
        weight: 1,
        title: 'Rolling Return (annualised)',
        indicator: {
          values: rollRet,
          kind: 'line',
          color: '#1f5fa6',
        },
      },
      {
        id: 'roll-vol',
        kind: 'indicator',
        weight: 1,
        title: 'Rolling Volatility (annualised)',
        indicator: {
          values: rollVol,
          kind: 'line',
          color: '#9aa3ad',
        },
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
          format: fmtPct1,
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
          formatX: fmtPct0,
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
    theme: 'finterion-light' as const,
    titleColor: '#222',
    titleFontSize: 12,
    titlePadding: { top: 8, left: 12 },
    titleSpace: 24,
    gridStyle: 'horizontal' as const,
    panelGap: 8,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#e7e9ec',
        padding: '32px 16px',
        fontFamily: 'Helvetica, Arial, sans-serif',
        color: '#222',
      }}
    >
      <div
        style={{
          width: 820,
          margin: '0 auto',
          background: 'white',
          padding: 24,
          boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          borderRadius: 4,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            paddingBottom: 12,
            borderBottom: '2px solid #b9bdc4',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '2px solid #1f5fa6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              color: '#1f5fa6',
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            QF·LIB
          </div>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
            <div>Generated with QF-Lib</div>
            <div>Example Strategy</div>
            <div>{dateStr}</div>
          </div>
        </div>

        <div style={{ height: 16 }} />
        <PanelCard height={210}>
          <Chart data={equityBars} panels={performancePanels} {...chartCommon} />
        </PanelCard>

        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <PanelCard height={230}>
            <Chart panels={heatmapPanels} {...chartCommon} />
          </PanelCard>
          <PanelCard height={230}>
            <Chart panels={yearlyPanels} {...chartCommon} />
          </PanelCard>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <PanelCard height={210}>
            <Chart panels={distPanels} {...chartCommon} />
          </PanelCard>
          <PanelCard height={210}>
            <Chart panels={qqPanels} {...chartCommon} />
          </PanelCard>
        </div>

        <div style={{ height: 16 }} />
        <PanelCard height={260}>
          <Chart data={equityBars} panels={rollingPanels} {...chartCommon} />
        </PanelCard>

        <div
          style={{
            marginTop: 24,
            paddingTop: 8,
            borderTop: '1px solid #cdd0d6',
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: 11,
            color: '#777',
          }}
        >
          Page 1 of 2
        </div>
      </div>
    </div>
  );
}
