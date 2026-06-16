import { useEffect, useMemo, useState } from 'react';
import { Chart } from '@finterion/charts-react';
import {
  createBuffer,
  ema,
  workerIndicators,
  type IndicatorSeries,
  type OHLC,
  type PanelSpec,
  type SeriesType,
  type TradeMarker,
} from '@finterion/charts-core';
import { TopBar, ToggleGroup, KpiTile } from './finterion/components';
import { colors, radii, spacing } from './finterion/tokens';
import { useChartTheme } from './finterion/themeContext';

const N = 800;

function generate(n: number): OHLC[] {
  const bars: OHLC[] = [];
  let p = 60000;
  const start = Date.now() - n * 3600_000;
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 28) * 220 + Math.cos(i / 11) * 90;
    const trend = Math.sin(i / 90) * 600;
    const noise = (Math.random() - 0.5) * 320;
    const open = p;
    const close = p + drift + trend * 0.04 + noise;
    bars.push({
      time: start + i * 3600_000,
      open,
      high: Math.max(open, close) + Math.random() * 180,
      low: Math.min(open, close) - Math.random() * 180,
      close,
      volume: 400 + Math.random() * 1400,
    });
    p = close;
  }
  return bars;
}

const MARKERS: TradeMarker[] = [];

export function App() {
  const data = useMemo(() => generate(N), []);
  const [type, setType] = useState<SeriesType>('candles');
  const theme = useChartTheme();
  const [rsiVals, setRsiVals] = useState<Float32Array | null>(null);
  const [ddVals, setDdVals] = useState<Float32Array | null>(null);
  const [emaFast, setEmaFast] = useState<Float32Array | null>(null);
  const [emaSlow, setEmaSlow] = useState<Float32Array | null>(null);

  // Compute indicators off-thread.
  useEffect(() => {
    const close = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) close[i] = data[i]!.close;
    let alive = true;
    Promise.all([
      workerIndicators.rsi(close, 14),
      workerIndicators.drawdown(close),
    ]).then(([r, d]) => {
      if (!alive) return;
      setRsiVals(r);
      setDdVals(d);
    });
    // EMA stays on main thread — it's tiny and used for overlays.
    const buf = createBuffer(data);
    setEmaFast(ema(buf, 12));
    setEmaSlow(ema(buf, 48));
    return () => { alive = false; };
  }, [data]);

  // Generate trade markers from EMA crossovers once both EMAs exist.
  const markers = useMemo<TradeMarker[]>(() => {
    if (!emaFast || !emaSlow) return MARKERS;
    const out: TradeMarker[] = [];
    for (let i = 1; i < data.length; i++) {
      const fPrev = emaFast[i - 1]!, sPrev = emaSlow[i - 1]!;
      const fNow = emaFast[i]!, sNow = emaSlow[i]!;
      if (fPrev <= sPrev && fNow > sNow) {
        out.push({ time: data[i]!.time, side: 'buy', price: data[i]!.low, label: 'B' });
      } else if (fPrev >= sPrev && fNow < sNow) {
        out.push({ time: data[i]!.time, side: 'sell', price: data[i]!.high, label: 'S' });
      }
    }
    return out;
  }, [emaFast, emaSlow, data]);

  const panels = useMemo<PanelSpec[]>(() => {
    const overlays: IndicatorSeries[] = [];
    if (emaFast) overlays.push({ id: 'ema-12', label: 'EMA 12', values: emaFast, kind: 'line', color: colors.chartSeries1 });
    if (emaSlow) overlays.push({ id: 'ema-48', label: 'EMA 48', values: emaSlow, kind: 'line', color: colors.chartSeries2 });

    const out: PanelSpec[] = [
      { id: 'price', kind: 'price', weight: 3, type, title: 'BTC / USD', overlays },
    ];
    if (rsiVals) {
      out.push({
        id: 'rsi',
        kind: 'indicator',
        weight: 1,
        title: 'RSI 14',
        indicator: {
          id: 'rsi',
          label: 'RSI 14',
          values: rsiVals,
          kind: 'line',
          color: colors.chartSeries3,
          refLines: [30, 70],
          yRange: [0, 100],
        },
      });
    }
    if (ddVals) {
      out.push({
        id: 'dd',
        kind: 'indicator',
        weight: 1,
        title: 'Drawdown %',
        indicator: {
          id: 'dd',
          label: 'Drawdown',
          values: ddVals,
          kind: 'area',
          color: colors.quantDown,
        },
      });
    }
    return out;
  }, [type, rsiVals, ddVals, emaFast, emaSlow]);

  // ── KPI strip (price, drawdown, last signal) ──
  const lastBar = data[data.length - 1]!;
  const firstBar = data[0]!;
  const pctChange = ((lastBar.close - firstBar.close) / firstBar.close) * 100;
  const lastDD = ddVals && ddVals.length ? ddVals[ddVals.length - 1]! : 0;
  const lastRsi = rsiVals && rsiVals.length ? rsiVals[rsiVals.length - 1]! : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 56px)',
        background: colors.canvasSubtle,
        color: colors.ink,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <TopBar
        title="Finterion Charts"
        subtitle="Default playground · BTC/USD synthetic feed"
        tag="DEMO"
        right={
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
            <ToggleGroup<SeriesType>
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { label: 'Candles', value: 'candles' },
                { label: 'Line', value: 'line' },
                { label: 'Area', value: 'area' },
              ]}
            />
          </div>
        }
      />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: spacing.md,
          padding: `${spacing.lg}px ${spacing.xl}px 0`,
        }}
      >
        <KpiTile
          label="Last price"
          value={`$${lastBar.close.toFixed(2)}`}
          delta={`${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}% (${data.length} bars)`}
          tone={pctChange >= 0 ? 'up' : 'down'}
        />
        <KpiTile
          label="Drawdown"
          value={`${(lastDD * 100).toFixed(2)}%`}
          delta="current"
          tone={lastDD < -0.01 ? 'down' : 'flat'}
        />
        <KpiTile
          label="RSI 14"
          value={lastRsi ? lastRsi.toFixed(1) : '—'}
          delta={lastRsi > 70 ? 'overbought' : lastRsi < 30 ? 'oversold' : 'neutral'}
          tone={lastRsi > 70 ? 'down' : lastRsi < 30 ? 'up' : 'flat'}
        />
        <KpiTile
          label="Signals"
          value={String(markers.length)}
          delta="EMA 12 × EMA 48"
        />
      </div>

      {/* Chart card */}
      <div style={{ padding: spacing.xl }}>
        <div
          style={{
            width: '100%',
            height: 480,
            background: colors.canvas,
            border: `1px solid ${colors.hairline}`,
            borderRadius: radii.sm,
            boxShadow: `0 1px 0 ${colors.shadowCard}`,
            padding: spacing.sm,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <Chart data={data} panels={panels} theme={theme} markers={markers} initialFit="all" />
          </div>
        </div>
      </div>

      <footer
        style={{
          padding: `${spacing.sm}px ${spacing.xl}px`,
          fontSize: 11,
          color: colors.inkMuted,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          letterSpacing: 0.5,
          borderTop: `1px solid ${colors.hairlineSoft}`,
          background: colors.canvas,
          display: 'flex',
          gap: spacing.lg,
        }}
      >
        <span>drag to pan</span>
        <span>scroll to zoom</span>
        <span>{data.length} bars</span>
        <span>{markers.length} signals</span>
        <span style={{ marginLeft: 'auto' }}>indicators: web worker</span>
      </footer>
    </div>
  );
}
