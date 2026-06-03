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
  type ThemeName,
  type TradeMarker,
} from '@finterion/charts-core';

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
  const [theme, setTheme] = useState<ThemeName>('finterion-dark');
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
    if (emaFast) overlays.push({ values: emaFast, kind: 'line', color: '#00e5ff', glow: 'rgba(0,229,255,0.55)' });
    if (emaSlow) overlays.push({ values: emaSlow, kind: 'line', color: '#ff2dd1', glow: 'rgba(255,45,209,0.55)' });

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
          values: rsiVals,
          kind: 'line',
          color: '#a3ff12',
          glow: 'rgba(163,255,18,0.5)',
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
          values: ddVals,
          kind: 'area',
          color: '#ff3d6e',
          glow: 'rgba(255,61,110,0.45)',
        },
      });
    }
    return out;
  }, [type, rsiVals, ddVals, emaFast, emaSlow]);

  const isDark = theme === 'finterion-dark';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: isDark ? 'radial-gradient(1200px 600px at 20% 0%, #0a1a2c 0%, #06070a 60%)' : '#f6f7fb',
      color: isDark ? '#e8ecf2' : '#0a0e19',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,14,25,0.08)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#00ffa3', boxShadow: '0 0 16px #00ffa3',
          }} />
          <div style={{ fontSize: 14, letterSpacing: 2 }}>FINTERION CHARTS</div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>· demo</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['candles', 'line', 'area'] as const).map((t) => (
            <Btn key={t} active={type === t} onClick={() => setType(t)}>{t}</Btn>
          ))}
          <div style={{ width: 1, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)', margin: '0 6px' }} />
          <Btn active={isDark} onClick={() => setTheme('finterion-dark')}>dark</Btn>
          <Btn active={!isDark} onClick={() => setTheme('finterion-light')}>light</Btn>
        </div>
      </header>

      <div style={{ flex: 1, padding: 16, minHeight: 0 }}>
        <div style={{ width: '100%', height: '100%', minHeight: 0 }}>
          <Chart data={data} panels={panels} theme={theme} markers={markers} />
        </div>
      </div>

      <footer style={{
        padding: '8px 20px',
        fontSize: 11,
        opacity: 0.55,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,14,25,0.08)'}`,
        display: 'flex', gap: 16,
      }}>
        <span>drag to pan</span>
        <span>scroll to zoom</span>
        <span>{data.length} bars</span>
        <span>{markers.length} signals</span>
        <span style={{ marginLeft: 'auto' }}>indicators: web worker</span>
      </footer>
    </div>
  );
}

function Btn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.08)',
        background: active ? '#00e5ff' : 'transparent',
        color: active ? '#06070a' : 'inherit',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
        boxShadow: active ? '0 0 16px rgba(0,229,255,0.4)' : 'none',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
