import type { OHLC, PanelSpec, ThemeName } from '@finterion/charts-core';
import { Chart } from '@finterion/charts-react';

// Synthetic BTC-like sine-wave bars so the chart has visible content beneath
// the loading overlay.
const PLACEHOLDER_BARS: OHLC[] = (() => {
  const DAY = 86_400_000;
  const start = Date.UTC(2024, 0, 1);
  const bars: OHLC[] = [];
  let price = 42000;
  for (let i = 0; i < 120; i++) {
    const wave = Math.sin((i / 120) * Math.PI * 4) * 6000;
    const noise = (((i * 7919 + 31337) % 100) / 100 - 0.5) * 1200;
    const close = Math.max(20000, price + wave * 0.05 + noise);
    const open = price;
    const hi = Math.max(open, close) * (1 + ((i * 1009) % 100) / 10000);
    const lo = Math.min(open, close) * (1 - ((i * 1013) % 100) / 10000);
    bars.push({ time: start + i * DAY, open, high: hi, low: lo, close, volume: 500 + (i * 37) % 1500 });
    price = close;
  }
  return bars;
})();

const PANELS: PanelSpec[] = [
  {
    id: 'price',
    weight: 1,
    title: 'BTC / USD',
    indicator: { id: 'price', kind: 'line', color: '#3b82f6', values: [] },
  },
];

const THEMES: { name: ThemeName; label: string }[] = [
  { name: 'tradingview-light', label: 'tradingview-light' },
  { name: 'tradingview-dark',  label: 'tradingview-dark'  },
  { name: 'terminal-light',    label: 'terminal-light'    },
  { name: 'terminal-dark',     label: 'terminal-dark'     },
];

export function LoadingDemo() {
  return (
    <div style={{ padding: '0 0 32px' }}>
      <p
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 13,
          color: '#8c959f',
          margin: '0 0 20px',
          lineHeight: 1.6,
        }}
      >
        Pass <code style={{ fontSize: 12 }}>loading&#61;&#123;true&#125;</code> to render a
        theme-coloured spinner on top of the chart while data is being fetched or computed.
        The chart engine stays mounted — no remount cost when loading transitions to{' '}
        <code style={{ fontSize: 12 }}>false</code>.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        {THEMES.map(({ name, label }) => (
          <div key={name}>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11,
                color: '#8c959f',
                marginBottom: 6,
                letterSpacing: '0.03em',
              }}
            >
              {label}
            </div>
            <Chart
              data={PLACEHOLDER_BARS}
              panels={PANELS}
              theme={name}
              initialFit="all"
              interactive={false}
              loading={true}
              style={{ width: '100%', height: 200 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
