/**
 * Train / Test split demo.
 *
 * Shows a BTC/USD daily close line (2022-01-01 → 2023-07-31) with two
 * visually distinct segments:
 *
 *   Train   2022-01-01 → 2023-01-01   blue
 *   Test    2023-01-31 → 2023-07-30   amber
 *
 * The gap between train-end and test-start (2023-01-01 → 2023-01-31) is left
 * blank in both series (NaN) so neither color bleeds across the boundary.
 *
 * Technique: two IndicatorSeries overlays on a single indicator panel. Each
 * series holds the close price for its own window and NaN everywhere else —
 * the line renderer treats NaN as a gap.
 */
import { useEffect, useMemo, useState } from 'react';
import { Chart } from '@finterion/charts-react';
import type { IndicatorSeries, OHLC, PanelSpec } from '@finterion/charts-core';
import { useChartTheme } from './finterion/themeContext';

// ─── Date boundaries (ms UTC) ────────────────────────────────────────────────

const TRAIN_START = Date.UTC(2022, 0, 1);   // 2022-01-01
const TRAIN_END   = Date.UTC(2023, 0, 1);   // 2023-01-01  (inclusive)
const TEST_START  = Date.UTC(2023, 0, 31);  // 2023-01-31  (inclusive)
const TEST_END    = Date.UTC(2023, 6, 30);  // 2023-07-30  (inclusive)

// ─── Colors ──────────────────────────────────────────────────────────────────

const TRAIN_COLOR    = '#0969da';             // blue
const TRAIN_GLOW     = 'rgba(9,105,218,0.35)';
const TRAIN_BG       = 'rgba(9,105,218,0.12)'; // solid pixel-space background

const TEST_COLOR     = '#d97706';             // amber
const TEST_GLOW      = 'rgba(217,119,6,0.35)';
const TEST_BG        = 'rgba(217,119,6,0.12)';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function parseData(raw: RawBar[]): OHLC[] {
  return raw.map((bar) => ({
    time: new Date(bar.timestamp).getTime(),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
}

/** Build a Float32Array of `close` prices masked to [windowStart, windowEnd]. */
function maskClose(data: OHLC[], windowStart: number, windowEnd: number): Float32Array {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const { time, close } = data[i]!;
    out[i] = time >= windowStart && time <= windowEnd ? close : NaN;
  }
  return out;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TrainTestDemo() {
  const theme = useChartTheme();
  const [raw, setRaw] = useState<RawBar[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/line_chart_train_test.json')
      .then((r) => r.json())
      .then((d: RawBar[]) => { if (alive) setRaw(d); })
      .catch(console.error);
    return () => { alive = false; };
  }, []);

  const data = useMemo<OHLC[]>(() => (raw ? parseData(raw) : []), [raw]);

  /** 1/NaN mask for the train window — rendered as a pixel-space background fill. */
  const trainBg = useMemo<IndicatorSeries>(() => {
    const mask = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      mask[i] = data[i]!.time >= TRAIN_START && data[i]!.time <= TRAIN_END ? 1 : NaN;
    }
    return { id: 'train-bg', kind: 'background', values: mask, color: TRAIN_BG };
  }, [data]);

  /** 1/NaN mask for the test window. */
  const testBg = useMemo<IndicatorSeries>(() => {
    const mask = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      mask[i] = data[i]!.time >= TEST_START && data[i]!.time <= TEST_END ? 1 : NaN;
    }
    return { id: 'test-bg', kind: 'background', values: mask, color: TEST_BG };
  }, [data]);

  const trainSeries = useMemo<IndicatorSeries>(() => ({
    id: 'train',
    label: 'Train  (2022-01-01 → 2023-01-01)',
    kind: 'line',
    values: maskClose(data, TRAIN_START, TRAIN_END),
    color: TRAIN_COLOR,
    glow: TRAIN_GLOW,
  }), [data]);

  const testSeries = useMemo<IndicatorSeries>(() => ({
    id: 'test',
    label: 'Test  (2023-01-31 → 2023-07-30)',
    kind: 'line',
    values: maskClose(data, TEST_START, TEST_END),
    color: TEST_COLOR,
    glow: TEST_GLOW,
  }), [data]);

  const volumeSeries = useMemo<IndicatorSeries>(() => {
    const vol = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) vol[i] = data[i]!.volume ?? 0;
    return {
      id: 'vol',
      label: 'Volume',
      kind: 'histogram' as const,
      values: vol,
      color: 'rgba(100,116,139,0.45)',
    };
  }, [data]);

  const panels = useMemo<PanelSpec[]>(
    () => [
      {
        id: 'price',
        kind: 'indicator',
        weight: 3,
        title: 'BTC/USD — Train / Test split',
        // trainSeries drives y-scaling; background overlays render first (behind lines).
        indicator: trainSeries,
        overlays: [trainBg, testBg, testSeries],
      },
      {
        id: 'volume',
        kind: 'indicator',
        weight: 1,
        title: 'Volume',
        indicator: volumeSeries,
      },
    ],
    [trainSeries, testSeries, volumeSeries],
  );

  if (!raw) {
    return (
      <Chart
        data={[]}
        panels={panels}
        theme={theme}
        initialFit="all"
        interactive={false}
        timeFormat="MMM YYYY"
        gridStyle="horizontal"
        showLegend={true}
        titleSpace={22}
        loading={true}
        style={{ width: '100%', height: 480 }}
      />
    );
  }

  return (
    <Chart
      data={data}
      panels={panels}
      theme={theme}
      initialFit="all"
      interactive={false}
      timeFormat="MMM YYYY"
      gridStyle="horizontal"
      showLegend={true}
      titleSpace={22}
      loading={!raw}
      style={{ width: '100%', height: 480 }}
    />
  );
}
