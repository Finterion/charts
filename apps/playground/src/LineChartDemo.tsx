/**
 * BTC/USD daily line chart demo.
 *
 * Renders 143 daily bars (2023-03-11 → 2023-07-31) as a price line with a
 * stacked volume histogram below. Demonstrates:
 *   - loading real OHLCV JSON
 *   - converting ISO timestamp strings to ms-epoch
 *   - `type: 'line'` on a price panel
 *   - stacked volume indicator panel
 *   - respecting the playground's global theme control
 */
import { useEffect, useMemo, useState } from 'react';
import { Chart } from '@finterion/charts-react';
import type { IndicatorSeries, OHLC, PanelSpec } from '@finterion/charts-core';
import { useChartTheme } from './finterion/themeContext';

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

export function LineChartDemo() {
  const theme = useChartTheme();
  const [raw, setRaw] = useState<RawBar[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/line_chart.json')
      .then((r) => r.json())
      .then((d: RawBar[]) => {
        if (alive) setRaw(d);
      })
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, []);

  const data = useMemo<OHLC[]>(() => (raw ? parseData(raw) : []), [raw]);

  const volumeSeries = useMemo<IndicatorSeries[]>(() => {
    if (!data.length) return [];
    const vol = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) vol[i] = data[i]!.volume ?? 0;
    return [
      {
        id: 'vol',
        label: 'Volume',
        kind: 'histogram',
        values: vol,
        color: 'rgba(9, 105, 218, 0.55)',
      },
    ];
  }, [data]);

  const panels = useMemo<PanelSpec[]>(
    () => [
      {
        id: 'price',
        kind: 'price',
        weight: 3,
        type: 'line',
        title: 'BTC/USD',
      },
      {
        id: 'volume',
        kind: 'indicator',
        weight: 1,
        title: 'Volume',
        indicator: volumeSeries[0] ?? {
          id: 'vol',
          kind: 'histogram',
          values: new Float32Array(0),
          color: 'rgba(9, 105, 218, 0.55)',
        },
      },
    ],
    [volumeSeries],
  );

  if (!raw) {
    return (
      <div
        style={{
          height: 480,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 13,
          color: '#8c959f',
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <Chart
      data={data}
      panels={panels}
      theme={theme}
      initialFit="all"
      gridStyle="horizontal"
      titleSpace={22}
      style={{ width: '100%', height: 480 }}
    />
  );
}
