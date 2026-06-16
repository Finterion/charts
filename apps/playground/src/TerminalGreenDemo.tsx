/**
 * Terminal-green demo — recreates the WSB "most mentions strategy vs SPY"
 * screenshot: pure-black canvas, bright phosphor-green strategy line, faint
 * red SPY benchmark, dim green grid + monospace uppercase axis labels.
 *
 * Visually it's a single indicator panel with two line series; the title,
 * axis captions and legend are rendered as HTML overlays so we get the
 * exact terminal-shell typography from the reference image.
 */
import { useMemo } from 'react';
import { Chart } from '@finterion/charts-react';
import type {
  IndicatorSeries,
  OHLC,
  PanelSpec,
} from '@finterion/charts-core';
import { useChartTheme } from './finterion/themeContext';

const N_DAYS = 128;

// Phosphor palette tuned for the reference screenshot. The chart's chrome
// (background, grid, axis text) follows the global PlaygroundThemeContext;
// the series colors below stay phosphor-green / faint-red so the demo
// always looks like the screenshot regardless of the active theme.
const TERMINAL = {
  strategy: '#00ff37',
  strategyGlow: 'rgba(0, 255, 55, 0.55)',
  spy: '#ff3d6e',
  // Chrome — used only by the HTML overlays (title, legend, axis labels).
  bg: '#000000',
  grid: 'rgba(0, 255, 55, 0.16)',
  text: '#00ff37',
} as const;

function makeRng(seed: number): () => number {
  // Mulberry32 — deterministic so the demo looks identical between reloads.
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GeneratedData {
  bars: OHLC[];
  strategy: Float32Array;
  spy: Float32Array;
}

function generate(n: number): GeneratedData {
  // Daily bars ending today.
  const start = Date.now() - n * 86400_000;
  const bars: OHLC[] = new Array(n);
  for (let i = 0; i < n; i++) {
    bars[i] = { time: start + i * 86400_000, open: 1, high: 1, low: 1, close: 1 };
  }

  // SPY: ~+18% over the window with small daily noise (mirrors the faint
  // red baseline in the screenshot, ~1.00 → ~1.18).
  const spyRng = makeRng(0xa11ce);
  const spy = new Float32Array(n);
  let s = 1.0;
  for (let i = 0; i < n; i++) {
    const drift = 0.0014;
    const noise = (spyRng() - 0.5) * 0.004;
    s *= 1 + drift + noise;
    spy[i] = s;
  }

  // STRATEGY: WSB-style boom/bust.
  //  - days 0-12  : choppy climb to ~1.10
  //  - days 13-19 : two violent spikes peaking ~2.2 and ~2.0
  //  - days 20-25 : crash to ~0.50
  //  - days 26-95 : slow bleed to ~0.10
  //  - days 100-107: dead-cat bounce to ~0.40
  //  - days 108-end: drift back to ~0.15
  const stratRng = makeRng(0xb0b);
  const strategy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v: number;
    const jitter = (stratRng() - 0.5) * 0.04;
    if (i <= 12) {
      v = 1.0 + (i / 12) * 0.10 + jitter * 0.6;
    } else if (i === 15) {
      v = 2.18;
    } else if (i === 16) {
      v = 1.58;
    } else if (i === 17) {
      v = 1.22;
    } else if (i === 18) {
      v = 2.02;
    } else if (i === 19) {
      v = 1.20;
    } else if (i >= 13 && i <= 19) {
      v = 1.15 + jitter * 1.5;
    } else if (i <= 25) {
      // Crash leg, ~0.55 by day 25.
      const t = (i - 20) / 5;
      v = 1.20 * (1 - t) + 0.50 * t + jitter * 0.5;
    } else if (i <= 95) {
      // Slow bleed from 0.50 → ~0.10.
      const t = (i - 25) / 70;
      v = 0.50 * (1 - t) + 0.10 * t + jitter * 0.15;
    } else if (i <= 107) {
      // Dead-cat bounce: 0.10 → ~0.42 → back down.
      const t = (i - 95) / 12;
      const bump = Math.sin(t * Math.PI) * 0.32;
      v = 0.11 + bump + jitter * 0.1;
    } else {
      // Tail bleed back to ~0.15.
      const t = (i - 107) / Math.max(1, n - 1 - 107);
      v = 0.20 * (1 - t) + 0.13 * t + jitter * 0.08;
    }
    strategy[i] = Math.max(0.05, v);
  }

  return { bars, strategy, spy };
}

export function TerminalGreenDemo(): JSX.Element {
  const { bars, strategy, spy } = useMemo(() => generate(N_DAYS), []);
  const theme = useChartTheme();

  const yRange = useMemo<[number, number]>(() => {
    // Pin y-range so both series share the same scale (and the round 0.5
    // gridlines from the screenshot stay anchored).
    return [0, 2.3];
  }, []);

  const panels = useMemo<PanelSpec[]>(() => {
    const strategySeries: IndicatorSeries = {
      id: 'strategy',
      label: 'STRATEGY',
      values: strategy,
      kind: 'line',
      color: TERMINAL.strategy,
      glow: TERMINAL.strategyGlow,
      yRange,
    };
    const spySeries: IndicatorSeries = {
      id: 'spy',
      label: 'SPY',
      values: spy,
      kind: 'line',
      color: TERMINAL.spy,
    };
    return [
      {
        id: 'wealth',
        kind: 'indicator',
        weight: 1,
        indicator: strategySeries,
        overlays: [spySeries],
      },
    ];
  }, [strategy, spy, yRange]);

  // Format today's date as the "as of" tag in the title.
  const today = useMemo(() => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const mono = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

  return (
    <div
      style={{
        background: TERMINAL.bg,
        color: TERMINAL.text,
        fontFamily: mono,
        padding: '32px 24px',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Title block — two lines of uppercase phosphor text. */}
        <div
          style={{
            textAlign: 'center',
            color: TERMINAL.text,
            textShadow: `0 0 8px ${TERMINAL.strategyGlow}`,
            marginBottom: 24,
            userSelect: 'none',
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 3,
              marginBottom: 6,
            }}
          >
            {today} &nbsp;|&nbsp; SOFI &nbsp;(28 MENTIONS)
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 2,
              color: TERMINAL.text,
              opacity: 0.95,
            }}
          >
            MOST MENTIONS STRATEGY VS SPY
          </div>
        </div>

        {/* Plot area: y-label on the left, chart in the middle, x-label below. */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              color: TERMINAL.text,
              fontSize: 11,
              letterSpacing: 2,
            }}
          >
            <span
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                whiteSpace: 'nowrap',
              }}
            >
              WEALTH INDEX (START = 1)
            </span>
          </div>

          <div style={{ position: 'relative', flex: 1, height: 520 }}>
            <Chart
              data={bars}
              panels={panels}
              theme={theme}
              gridStyle="full"
              showLegend={false}
              showTimeAxis={false}
              initialFit="all"
            />

            {/* Custom legend — top-left box matching the screenshot. */}
            <div
              style={{
                position: 'absolute',
                top: 14,
                left: 18,
                padding: '6px 10px',
                border: `1px solid ${TERMINAL.strategy}`,
                background: 'rgba(0, 0, 0, 0.65)',
                fontSize: 11,
                letterSpacing: 1.5,
                lineHeight: 1.6,
                color: TERMINAL.text,
                textTransform: 'uppercase',
                boxShadow: `0 0 6px ${TERMINAL.strategyGlow}`,
              }}
            >
              <LegendRow color={TERMINAL.spy} label="SPY" />
              <LegendRow color={TERMINAL.strategy} label="STRATEGY" />
            </div>

            {/* Synthetic "trading day" axis ticks rendered as HTML so the
                labels read 0, 20, 40, ... exactly like the screenshot. */}
            <DayAxis n={N_DAYS} color={TERMINAL.text} mono={mono} />
          </div>
        </div>

        {/* X-axis label */}
        <div
          style={{
            textAlign: 'center',
            color: TERMINAL.text,
            fontSize: 11,
            letterSpacing: 2,
            marginTop: 4,
            paddingLeft: 28,
          }}
        >
          TRADING DAY
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 14,
          height: 2,
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <span style={{ color }}>{label}</span>
    </div>
  );
}

/**
 * Renders integer "trading day" tick labels below the chart. Uses 7 ticks
 * (0, 20, 40, ...) to mirror the reference image.
 */
function DayAxis({
  n,
  color,
  mono,
}: {
  n: number;
  color: string;
  mono: string;
}): JSX.Element {
  const step = 20;
  const ticks: number[] = [];
  for (let d = 0; d <= n - 1; d += step) ticks.push(d);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -2,
        height: 18,
        pointerEvents: 'none',
      }}
    >
      {ticks.map((d) => {
        const pct = (d / (n - 1)) * 100;
        return (
          <span
            key={d}
            style={{
              position: 'absolute',
              left: `${pct}%`,
              transform: 'translateX(-50%)',
              color,
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: 1,
            }}
          >
            {d}
          </span>
        );
      })}
    </div>
  );
}
