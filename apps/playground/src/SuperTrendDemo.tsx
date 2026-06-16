import { useEffect, useMemo, useState } from 'react';
import { Chart } from '@finterion/charts-react';
import type {
  OHLC,
  PanelSpec,
  ThemeName,
  TradeMarker,
} from '@finterion/charts-core';
import { useChartTheme } from './finterion/themeContext';

interface SuperTrendPayload {
  symbol: string;
  atr_length: number;
  factor: number;
  bars: OHLC[];
  supertrend: (number | null)[];
  supertrend_trend: number[]; // 1 bullish, 0 bearish
  supertrend_upper: (number | null)[];
  supertrend_lower: (number | null)[];
  supertrend_signal: number[]; // 1 buy, -1 sell
  rsi_period: number;
  rsi: (number | null)[];
  bb_period: number;
  bb_std_dev: number;
  bb_upper: (number | null)[];
  bb_middle: (number | null)[];
  bb_lower: (number | null)[];
  macd_short: number;
  macd_long: number;
  macd_signal_period: number;
  macd: (number | null)[];
  macd_signal: (number | null)[];
  macd_histogram: (number | null)[];
}

function toFloat32(arr: (number | null)[]): Float32Array {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    out[i] = v == null ? NaN : v;
  }
  return out;
}

/**
 * Splits the SuperTrend trailing-stop line into two Float32Arrays — one for
 * bullish bars, one for bearish — so we can render them with different colours
 * via two overlays. Bars belonging to the other regime are set to NaN, which
 * the line renderer treats as a gap.
 */
function splitByTrend(
  values: (number | null)[],
  trend: number[],
): { bull: Float32Array; bear: Float32Array } {
  const bull = new Float32Array(values.length);
  const bear = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const t = trend[i];
    const x = v == null ? NaN : v;
    if (t === 1) {
      bull[i] = x;
      bear[i] = NaN;
    } else {
      bull[i] = NaN;
      bear[i] = x;
    }
  }
  return { bull, bear };
}

export function SuperTrendDemo() {
  const [payload, setPayload] = useState<SuperTrendPayload | null>(null);
  const theme = useChartTheme();
  const [gridStyle, setGridStyle] = useState<'none' | 'horizontal' | 'full'>('horizontal');

  useEffect(() => {
    let alive = true;
    fetch('/supertrend.json')
      .then((r) => r.json())
      .then((j: SuperTrendPayload) => {
        if (alive) setPayload(j);
      })
      .catch((err) => console.error('Failed to load supertrend.json', err));
    return () => {
      alive = false;
    };
  }, []);

  const markers = useMemo<TradeMarker[]>(() => {
    if (!payload) return [];
    const out: TradeMarker[] = [];
    for (let i = 0; i < payload.bars.length; i++) {
      const sig = payload.supertrend_signal[i];
      const bar = payload.bars[i]!;
      if (sig === 1) {
        out.push({ time: bar.time, side: 'buy', price: bar.low, label: 'B' });
      } else if (sig === -1) {
        out.push({ time: bar.time, side: 'sell', price: bar.high, label: 'S' });
      }
    }
    return out;
  }, [payload]);

  const supertrendCode = `// Edit me — return an array of PanelSpec.
// In scope: payload, toFloat32, splitByTrend, Float32Array
const { bull, bear } = splitByTrend(payload.supertrend, payload.supertrend_trend);
const trendArr = new Float32Array(payload.supertrend_trend);

return [
  {
    id: 'price',
    kind: 'price',
    weight: 3,
    type: 'candles',
    title: \`\${payload.symbol} · SuperTrend (ATR \${payload.atr_length}, ×\${payload.factor})\`,
    overlays: [
      { values: bull, kind: 'line', color: '#00ffa3', glow: 'rgba(0,255,163,0.55)' },
      { values: bear, kind: 'line', color: '#ff3d6e', glow: 'rgba(255,61,110,0.55)' },
    ],
  },
  {
    id: 'trend',
    kind: 'indicator',
    weight: 1,
    title: 'SuperTrend regime (1 = bull, 0 = bear)',
    indicator: {
      values: trendArr,
      kind: 'area',
      color: '#00e5ff',
      glow: 'rgba(0,229,255,0.45)',
      yRange: [-0.1, 1.1],
      refLines: [0.5],
    },
  },
];
`;

  const rsiCode = `return [
  {
    id: 'price-rsi',
    kind: 'price',
    weight: 2,
    type: 'candles',
    title: payload.symbol,
  },
  {
    id: 'rsi',
    kind: 'indicator',
    weight: 1,
    title: \`RSI \${payload.rsi_period}\`,
    indicator: {
      values: toFloat32(payload.rsi),
      kind: 'line',
      color: '#a3ff12',
      glow: 'rgba(163,255,18,0.5)',
      refLines: [30, 70],
      yRange: [0, 100],
    },
  },
];
`;

  const bbCode = `return [
  {
    id: 'price-bb',
    kind: 'price',
    weight: 1,
    type: 'candles',
    title: \`\${payload.symbol} · Bollinger Bands (\${payload.bb_period}, ±\${payload.bb_std_dev}σ)\`,
    overlays: [
      {
        values: toFloat32(payload.bb_upper),
        lowerValues: toFloat32(payload.bb_lower),
        kind: 'band',
        color: 'rgba(0,229,255,0.85)',
        glow: 'rgba(0,229,255,0.25)',
      },
      {
        values: toFloat32(payload.bb_middle),
        kind: 'line',
        color: '#ffd166',
        glow: 'rgba(255,209,102,0.45)',
      },
    ],
  },
];
`;

  const macdCode = `const histRaw = toFloat32(payload.macd_histogram);
const macdLine = toFloat32(payload.macd);
const sigLine = toFloat32(payload.macd_signal);
// Symmetric y-range so the zero line sits visually centered.
let absMax = 0;
for (let i = 0; i < histRaw.length; i++) {
  const h = histRaw[i], m = macdLine[i], s = sigLine[i];
  if (Number.isFinite(h)) absMax = Math.max(absMax, Math.abs(h));
  if (Number.isFinite(m)) absMax = Math.max(absMax, Math.abs(m));
  if (Number.isFinite(s)) absMax = Math.max(absMax, Math.abs(s));
}
const yPad = absMax * 1.1 || 1;

return [
  {
    id: 'price-macd',
    kind: 'price',
    weight: 2,
    type: 'candles',
    title: payload.symbol,
  },
  {
    id: 'macd-hist',
    kind: 'indicator',
    weight: 1,
    title: \`MACD (\${payload.macd_short}, \${payload.macd_long}, \${payload.macd_signal_period})\`,
    indicator: {
      values: histRaw,
      kind: 'histogram',
      color: 'rgba(38,166,154,0.85)',         // positive: teal-green
      colorNegative: 'rgba(239,83,80,0.85)',  // negative: red
      glow: 'rgba(0,0,0,0)',
      refLines: [0],
      yRange: [-yPad, yPad],
    },
    overlays: [
      { values: macdLine, kind: 'line', color: '#2196f3', glow: 'rgba(33,150,243,0.45)' },
      { values: sigLine,  kind: 'line', color: '#ff9800', glow: 'rgba(255,152,0,0.45)' },
    ],
  },
];
`;

  const allInOneCode = `// Return either a PanelSpec[] or an object that lets you also override
// chart-wide display options (background, grid color, grid style).
//
// 👇 Inline legend with eye-toggle buttons:
//    • By default any series with a \`label\` becomes toggleable ('auto').
//    • Set \`toggleable: true\` to force a series into the legend (a fallback
//      label is derived from \`id\` if no \`label\` is set).
//    • Set \`toggleable: false\` to keep a series out of the legend even if
//      it has a label (useful for axis-only reference series).
const { bull, bear } = splitByTrend(payload.supertrend, payload.supertrend_trend);
const trendArr = new Float32Array(payload.supertrend_trend);

return {
  background: '#131722',
  gridColor: '#494d57',
  gridStyle: 'horizontal', // 'none' | 'horizontal' | 'full'
  panels: [
    {
      id: 'price-all',
      kind: 'price',
      weight: 4,
      type: 'candles',
      title: \`\${payload.symbol} · BB + SuperTrend\`,
      overlays: [
        // Bollinger Bands (cyan band + amber middle) — explicitly toggleable.
        {
          id: 'bb-band',
          label: \`BB \${payload.bb_period} ±\${payload.bb_std_dev}σ\`,
          values: toFloat32(payload.bb_upper),
          lowerValues: toFloat32(payload.bb_lower),
          kind: 'band',
          color: 'rgba(0,229,255,0.7)',
          glow: 'rgba(0,229,255,0.22)',
          toggleable: true,
        },
        {
          id: 'bb-mid',
          label: 'BB middle',
          values: toFloat32(payload.bb_middle),
          kind: 'line',
          color: '#ffd166',
          glow: 'rgba(255,209,102,0.35)',
          toggleable: true,
        },
        // SuperTrend (green/red, split by regime). Both share one toggle row.
        {
          id: 'st-bull',
          label: \`SuperTrend ATR \${payload.atr_length} ×\${payload.factor} (bull)\`,
          values: bull,
          kind: 'line',
          color: '#00ffa3',
          glow: 'rgba(0,255,163,0.55)',
          toggleable: true,
        },
        {
          // No label → derived from id when toggleable is explicit.
          id: 'st-bear',
          values: bear,
          kind: 'line',
          color: '#ff3d6e',
          glow: 'rgba(255,61,110,0.55)',
          toggleable: true,
        },
      ],
    },
    {
      id: 'rsi-all',
      kind: 'indicator',
      weight: 1,
      title: \`RSI \${payload.rsi_period}\`,
      indicator: {
        id: 'rsi',
        label: \`RSI \${payload.rsi_period}\`,
        values: toFloat32(payload.rsi),
        kind: 'line',
        color: '#a3ff12',
        glow: 'rgba(163,255,18,0.5)',
        refLines: [30, 70],
        yRange: [0, 100],
      },
    },
    {
      id: 'trend-all',
      kind: 'indicator',
      weight: 1,
      title: 'SuperTrend regime (1 = bull, 0 = bear)',
      indicator: {
        id: 'st-regime',
        label: 'SuperTrend regime',
        values: trendArr,
        kind: 'area',
        color: '#00e5ff',
        glow: 'rgba(0,229,255,0.45)',
        yRange: [-0.1, 1.1],
        refLines: [0.5],
      },
    },
  ],
};
`;

  const isDark = theme === 'tradingview-dark' || theme === 'terminal-dark' || theme === 'finterion-dark';

  if (!payload) {
    return (
      <div style={{ padding: 24, fontFamily: 'ui-monospace, monospace' }}>
        Loading SuperTrend dataset…
      </div>
    );
  }

  const lastTrend = payload.supertrend_trend[payload.supertrend_trend.length - 1];
  const buys = markers.filter((m) => m.side === 'buy').length;
  const sells = markers.filter((m) => m.side === 'sell').length;

  // Shared display tweaks: gap between stacked panes, brighter+roomier titles.
  // The dark theme uses TradingView-ish background + softer grid lines; the
  // light theme keeps the resolved theme defaults.
  const chartDisplay = {
    panelGap: 12,
    titleColor: isDark ? '#ffd166' : '#1976d2',
    titleFontSize: 12,
    titlePadding: { top: 8, left: 12 },
    titleSpace: 26,
    showTimeAxis: true,
    gridStyle,
    background: isDark ? '#131722' : undefined,
    gridColor: isDark ? '#494d57' : undefined,
  } as const;

  // Material-ish palette.
  const palette = isDark
    ? {
        pageBg: '#0b1220',
        appBarBg: '#111a2c',
        paperBg: '#15203a',
        text: '#e8ecf2',
        textSecondary: 'rgba(232,236,242,0.65)',
        divider: 'rgba(255,255,255,0.08)',
        primary: '#90caf9',
        elevation:
          '0 2px 4px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.45)',
      }
    : {
        pageBg: '#f4f6fb',
        appBarBg: '#1976d2',
        paperBg: '#ffffff',
        text: '#1a202c',
        textSecondary: 'rgba(26,32,44,0.65)',
        divider: 'rgba(0,0,0,0.08)',
        primary: '#1976d2',
        elevation:
          '0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.06)',
      };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: palette.pageBg,
        color: palette.text,
        fontFamily:
          'Roboto, "Helvetica Neue", Helvetica, Arial, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* AppBar */}
      <div
        style={{
          background: palette.appBarBg,
          color: '#fff',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow:
            '0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px 0 rgba(0,0,0,0.14), 0 1px 10px 0 rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: lastTrend === 1 ? '#00e676' : '#ff5252',
              boxShadow:
                lastTrend === 1
                  ? '0 0 10px rgba(0,230,118,0.7)'
                  : '0 0 10px rgba(255,82,82,0.7)',
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: 0.3 }}>
            Finterion Charts
          </div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            · PyIndicators SuperTrend
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn active={gridStyle === 'none'} onClick={() => setGridStyle('none')}>
            no grid
          </Btn>
          <Btn active={gridStyle === 'horizontal'} onClick={() => setGridStyle('horizontal')}>
            lines
          </Btn>
          <Btn active={gridStyle === 'full'} onClick={() => setGridStyle('full')}>
            grid
          </Btn>
        </div>
      </div>

      {/* Page content */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <LiveChartCard
          palette={palette}
          title={`${payload.symbol} · All indicators`}
          subtitle={`Bollinger Bands (${payload.bb_period}, ±${payload.bb_std_dev}σ) · SuperTrend (ATR ${payload.atr_length}, ×${payload.factor.toFixed(1)}) · RSI ${payload.rsi_period}`}
          chips={
            <>
              <Chip
                label={lastTrend === 1 ? 'BULL' : 'BEAR'}
                color={lastTrend === 1 ? '#00e676' : '#ff5252'}
              />
              <Chip label={`BB ${payload.bb_period}`} color="#00e5ff" />
              <Chip label={`RSI ${payload.rsi_period}`} color="#a3ff12" />
            </>
          }
          footer="all indicators layered in a single chart"
          height={620}
          defaultCode={allInOneCode}
          payload={payload}
          theme={theme}
          markers={markers}
          chartDisplay={chartDisplay}
        />

        <LiveChartCard
          palette={palette}
          title={payload.symbol}
          subtitle={`SuperTrend · ATR length ${payload.atr_length} · factor ×${payload.factor.toFixed(1)} · ${payload.bars.length} bars`}
          chips={
            <>
              <Chip
                label={lastTrend === 1 ? 'BULL' : 'BEAR'}
                color={lastTrend === 1 ? '#00e676' : '#ff5252'}
              />
              <Chip label={`${buys} BUY`} color="#00e676" />
              <Chip label={`${sells} SELL`} color="#ff5252" />
            </>
          }
          footer="computed by pyindicators.supertrend (Python)"
          height={520}
          defaultCode={supertrendCode}
          payload={payload}
          theme={theme}
          markers={markers}
          chartDisplay={chartDisplay}
        />

        <LiveChartCard
          palette={palette}
          title={`${payload.symbol} · RSI`}
          subtitle={`Relative Strength Index · period ${payload.rsi_period} · overbought 70 / oversold 30`}
          chips={<Chip label={`RSI ${payload.rsi_period}`} color="#a3ff12" />}
          footer="computed by pyindicators.rsi (Python)"
          height={420}
          defaultCode={rsiCode}
          payload={payload}
          theme={theme}
          chartDisplay={chartDisplay}
        />

        <LiveChartCard
          palette={palette}
          title={`${payload.symbol} · Bollinger Bands`}
          subtitle={`SMA(${payload.bb_period}) ± ${payload.bb_std_dev}σ envelope`}
          chips={
            <>
              <Chip label={`PERIOD ${payload.bb_period}`} color="#00e5ff" />
              <Chip label={`±${payload.bb_std_dev}σ`} color="#ffd166" />
            </>
          }
          footer="computed by pyindicators.bollinger_bands (Python)"
          height={420}
          defaultCode={bbCode}
          payload={payload}
          theme={theme}
          chartDisplay={chartDisplay}
        />

        <LiveChartCard
          palette={palette}
          title={`${payload.symbol} · MACD`}
          subtitle={`Moving Average Convergence Divergence · (${payload.macd_short}, ${payload.macd_long}, ${payload.macd_signal_period})`}
          chips={
            <>
              <Chip label="MACD" color="#2196f3" />
              <Chip label="SIGNAL" color="#ff9800" />
              <Chip label="HIST" color="#26a69a" />
            </>
          }
          footer="computed by pyindicators.macd (Python)"
          height={520}
          defaultCode={macdCode}
          payload={payload}
          theme={theme}
          chartDisplay={chartDisplay}
        />
      </div>
    </div>
  );
}

interface Palette {
  pageBg: string;
  appBarBg: string;
  paperBg: string;
  text: string;
  textSecondary: string;
  divider: string;
  primary: string;
  elevation: string;
}

function IndicatorCard({
  palette,
  title,
  subtitle,
  chips,
  footer,
  height,
  children,
}: {
  palette: Palette;
  title: string;
  subtitle: string;
  chips?: React.ReactNode;
  footer?: string;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: palette.paperBg,
        borderRadius: 12,
        boxShadow: palette.elevation,
        overflow: 'hidden',
        border: `1px solid ${palette.divider}`,
      }}
    >
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${palette.divider}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: 0.15 }}>
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: palette.textSecondary,
              marginTop: 4,
            }}
          >
            {subtitle}
          </div>
        </div>
        {chips && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{chips}</div>
        )}
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ width: '100%', height }}>{children}</div>
      </div>

      {footer && (
        <div
          style={{
            padding: '12px 24px',
            borderTop: `1px solid ${palette.divider}`,
            fontSize: 12,
            color: palette.textSecondary,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span>Drag to pan · scroll to zoom</span>
          <span>{footer}</span>
        </div>
      )}
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 12,
        background: `${color}1f`, // ~12% alpha
        color,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.4,
        border: `1px solid ${color}55`,
      }}
    >
      {label}
    </span>
  );
}

function Btn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
      }}
    >
      {children}
    </button>
  );
}

interface LiveChartCardProps {
  palette: Palette;
  title: string;
  subtitle: string;
  chips?: React.ReactNode;
  footer?: string;
  height: number;
  defaultCode: string;
  payload: SuperTrendPayload;
  theme: ThemeName;
  markers?: TradeMarker[];
  chartDisplay: {
    panelGap: number;
    titleColor: string;
    titleFontSize: number;
    titlePadding: { top: number; left: number };
    titleSpace: number;
    showTimeAxis: boolean;
    gridStyle: 'none' | 'horizontal' | 'full';
    background?: string;
    gridColor?: string;
  };
}

function LiveChartCard({
  palette,
  title,
  subtitle,
  chips,
  footer,
  height,
  defaultCode,
  payload,
  theme,
  markers,
  chartDisplay,
}: LiveChartCardProps) {
  const [code, setCode] = useState(defaultCode);
  const [open, setOpen] = useState(false);

  const compiled = useMemo<{
    panels: PanelSpec[] | null;
    overrides: { background?: string; gridColor?: string; gridStyle?: 'none' | 'horizontal' | 'full' };
    error: string | null;
  }>(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      const fn = new Function('payload', 'toFloat32', 'splitByTrend', 'Float32Array', code);
      const result = fn(payload, toFloat32, splitByTrend, Float32Array);
      if (Array.isArray(result)) {
        return { panels: result as PanelSpec[], overrides: {}, error: null };
      }
      if (result && typeof result === 'object' && Array.isArray(result.panels)) {
        const r = result as {
          panels: PanelSpec[];
          background?: string;
          gridColor?: string;
          gridStyle?: 'none' | 'horizontal' | 'full';
        };
        return {
          panels: r.panels,
          overrides: {
            background: r.background,
            gridColor: r.gridColor,
            gridStyle: r.gridStyle,
          },
          error: null,
        };
      }
      return { panels: null, overrides: {}, error: 'Code must return an array of PanelSpec or an object { panels, background?, gridColor?, gridStyle? }.' };
    } catch (e) {
      return { panels: null, overrides: {}, error: (e as Error).message };
    }
  }, [code, payload]);

  const editorBg = '#0b1220';
  const editorText = '#e8ecf2';

  return (
    <div
      style={{
        background: palette.paperBg,
        borderRadius: 12,
        boxShadow: palette.elevation,
        overflow: 'hidden',
        border: `1px solid ${palette.divider}`,
      }}
    >
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${palette.divider}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: 0.15 }}>{title}</div>
          <div style={{ fontSize: 13, color: palette.textSecondary, marginTop: 4 }}>
            {subtitle}
          </div>
        </div>
        {chips && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{chips}</div>}
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ width: '100%', height }}>
          {compiled.panels ? (
            <Chart
              data={payload.bars}
              panels={compiled.panels}
              theme={theme}
              markers={markers}
              initialFit="all"
              {...chartDisplay}
              {...(compiled.overrides.background !== undefined ? { background: compiled.overrides.background } : {})}
              {...(compiled.overrides.gridColor !== undefined ? { gridColor: compiled.overrides.gridColor } : {})}
              {...(compiled.overrides.gridStyle !== undefined ? { gridStyle: compiled.overrides.gridStyle } : {})}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff5252',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 13,
                padding: 16,
                textAlign: 'center',
              }}
            >
              ⚠ {compiled.error}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${palette.divider}`,
          background: open ? editorBg : 'transparent',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
          }}
        >
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              borderRadius: 6,
              border: `1px solid ${palette.divider}`,
              background: 'transparent',
              color: palette.textSecondary,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {open ? '▾ hide code' : '▸ edit code'}
          </button>
          {open && (
            <button
              onClick={() => setCode(defaultCode)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                borderRadius: 6,
                border: `1px solid ${palette.divider}`,
                background: 'transparent',
                color: palette.textSecondary,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ↺ reset
            </button>
          )}
          {open && compiled.error && (
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                color: '#ff5252',
                marginLeft: 'auto',
              }}
            >
              ⚠ {compiled.error}
            </span>
          )}
          {open && !compiled.error && (
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                color: '#00e676',
                marginLeft: 'auto',
              }}
            >
              ● live
            </span>
          )}
        </div>
        {open && (
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            style={{
              display: 'block',
              width: '100%',
              minHeight: 280,
              maxHeight: 600,
              padding: '12px 16px',
              border: 'none',
              borderTop: `1px solid ${palette.divider}`,
              outline: 'none',
              resize: 'vertical',
              background: editorBg,
              color: editorText,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              lineHeight: 1.5,
              tabSize: 2,
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {footer && (
        <div
          style={{
            padding: '12px 24px',
            borderTop: `1px solid ${palette.divider}`,
            fontSize: 12,
            color: palette.textSecondary,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span>Drag to pan · scroll to zoom · edit code below to customise live</span>
          <span>{footer}</span>
        </div>
      )}
    </div>
  );
}
