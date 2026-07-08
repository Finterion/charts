/**
 * Three side-by-side overlaid equity-curve charts, each mounted with a
 * different `initialZoom` value. Demonstrates how the same data + panels
 * look zoomed IN (50%), fit-to-data (100%), and zoomed OUT with padding
 * on both axes (120%).
 *
 * Uses the same synthetic equity-curve generator as `EquityCurvesDemo`,
 * scaled down to 6 algorithms so the three cards can sit next to each
 * other without overwhelming the viewport.
 */
import { useMemo } from 'react';
import { Chart } from '@finterion/charts-react';
import { alignByDuration, type IndicatorSeries, type OHLC, type PanelSpec } from '@finterion/charts-core';
import { TopBar, Card, CardHeader, Overline } from './finterion/components';
import { colors, spacing } from './finterion/tokens';
import { useChartTheme } from './finterion/themeContext';

const N_ALGOS = 6;
const DAY_MS = 86_400_000;
const YEAR_BARS = 252;
const RUN_LEN = YEAR_BARS * 2; // 2 years per curve

const PALETTE = [
  '#0969da', '#8250df', '#bf8700',
  '#cf222e', '#1a7f37', '#0a3069',
];

const NAMES = [
  'MeanRev-Z', 'Momentum-12-1', 'Trend-Breakout',
  'Pairs-Stat', 'Vol-Carry', 'RSI-Divergence',
];

interface AlgoCurve {
  id: string;
  label: string;
  color: string;
  values: Float32Array;
  cagr: number;
}

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCurves(): AlgoCurve[] {
  const curves: AlgoCurve[] = [];
  for (let a = 0; a < N_ALGOS; a++) {
    const rng = makeRng(0xABCD + a * 733);
    const drift = (rng() - 0.35) * 0.0014;
    const vol = 0.008 + rng() * 0.015;
    const values = new Float32Array(RUN_LEN);
    let eq = 1.0;
    for (let i = 0; i < RUN_LEN; i++) {
      const z = (rng() + rng() + rng() - 1.5) * 1.4142;
      eq *= 1 + drift + z * vol;
      values[i] = eq;
    }
    const cagr = Math.pow(eq, 1 / (RUN_LEN / YEAR_BARS)) - 1;
    curves.push({
      id: `algo-${a}`,
      label: NAMES[a] ?? `Algo ${a + 1}`,
      color: PALETTE[a % PALETTE.length]!,
      values,
      cagr,
    });
  }
  return curves;
}

interface ZoomVariant {
  key: string;
  label: string;
  zoom: number | { x?: number; y?: number };
  description: string;
  legend: string;
}

const VARIANTS: ZoomVariant[] = [
  {
    key: 'zoom-in',
    label: 'initialZoom = 50',
    zoom: 50,
    description: 'Zoomed IN — shows the most recent half of the buffer.',
    legend: 'visible: ~50% of buffer on both axes',
  },
  {
    key: 'zoom-fit',
    label: 'initialZoom = 100',
    zoom: 100,
    description: 'Fit-to-data — every bar visible, no padding.',
    legend: 'visible: 100% of buffer on both axes',
  },
  {
    key: 'zoom-out',
    label: 'initialZoom = 200',
    zoom: 200,
    description: 'Zoomed OUT — 50% empty padding on each side of both axes.',
    legend: 'visible: 100% of buffer + 100% padding on both axes',
  },
  {
    key: 'zoom-x-only',
    label: 'initialZoom = { x: 200, y: 100 }',
    zoom: { x: 200, y: 100 },
    description: 'Zoomed OUT on X only — 50% horizontal padding, y fits data.',
    legend: 'x: 100% + 100% pad · y: fits data',
  },
  {
    key: 'zoom-y-only',
    label: 'initialZoom = { x: 100, y: 200 }',
    zoom: { x: 100, y: 200 },
    description: 'Zoomed OUT on Y only — x fits data, 50% vertical padding.',
    legend: 'x: fits data · y: 100% + 100% pad',
  },
  {
    key: 'zoom-mixed',
    label: 'initialZoom = { x: 50, y: 150 }',
    zoom: { x: 50, y: 150 },
    description: 'Mixed — zoom IN on x, zoom OUT on y for vertical headroom.',
    legend: 'x: recent 50% · y: 100% + 50% pad',
  },
];

export function ZoomLevelsDemo() {
  const curves = useMemo(() => generateCurves(), []);
  const theme = useChartTheme();

  const { bars, alignedValues } = useMemo(() => {
    const aligned = alignByDuration(
      curves.map((c) => ({ values: c.values })),
      { barIntervalMs: DAY_MS },
    );
    const b: OHLC[] = new Array(aligned.time.length);
    for (let i = 0; i < aligned.time.length; i++) {
      b[i] = { time: aligned.time[i]!, open: 1, high: 1, low: 1, close: 1 };
    }
    return { bars: b, alignedValues: aligned.values };
  }, [curves]);

  const panels = useMemo<PanelSpec[]>(() => {
    if (!curves.length) return [];
    const toSeries = (c: AlgoCurve, i: number): IndicatorSeries => ({
      id: c.id,
      label: c.label,
      metric: `${c.cagr >= 0 ? '+' : ''}${(c.cagr * 100).toFixed(1)}%`,
      values: alignedValues[i]!,
      kind: 'line',
      color: c.color,
    });
    const [first, ...rest] = curves.map((c, i) => toSeries(c, i));
    return [
      {
        id: 'equity',
        kind: 'indicator',
        weight: 1,
        title: `${curves.length} Algorithms`,
        indicator: {
          ...first!,
          refLines: [1.0],
        },
        overlays: rest,
      },
    ];
  }, [curves, alignedValues]);

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
        title="Initial Zoom Levels"
        subtitle={`Same data (${curves.length} equity curves) mounted with three different initialZoom values`}
        tag="DEMO"
      />

      <div style={{ padding: spacing.lg, maxWidth: 1400, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: spacing.lg,
          }}
        >
          {VARIANTS.map((v) => (
            <Card key={v.key} padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ padding: `${spacing.md}px ${spacing.lg}px` }}>
                <CardHeader title={v.label} subtitle={v.description} />
                <div style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
                  <Overline style={{ color: colors.inkMuted }}>{v.legend}</Overline>
                </div>
                <div style={{ width: '100%', height: 320 }}>
                  <Chart
                    data={bars}
                    panels={panels}
                    theme={theme}
                    titleFontSize={11}
                    titlePadding={{ top: 8, left: 12 }}
                    titleSpace={22}
                    showLegend={false}
                    initialZoom={v.zoom}
                    timeFormat="duration"
                    interactive={false}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div style={{ marginTop: spacing.lg }}>
          <Card>
            <CardHeader
              title="How it works"
              subtitle="initialZoom is a percentage of the buffer visible on mount. It overrides initialFit."
            />
            <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.inkMuted, lineHeight: 1.7 }}>
              <li>
                <code>initialZoom &lt; 100</code> — zoom IN; e.g. <code>25</code> shows the most recent
                quarter of the buffer.
              </li>
              <li>
                <code>initialZoom = 100</code> — fit every bar snugly (same as <code>initialFit="all"</code>).
              </li>
              <li>
                <code>initialZoom &gt; 100</code> — zoom OUT past the data extent, adding empty padding
                on the affected axis. e.g. <code>120</code> adds ~10% breathing room per edge.
              </li>
              <li>
                Pass an object <code>{'{'} x?, y? {'}'}</code> to zoom the two axes independently.
                A missing axis defaults to <code>100</code>. e.g. <code>{'{'} x: 100, y: 200 {'}'}</code>{' '}
                fits the x-axis and adds 50% padding on the y-axis.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
