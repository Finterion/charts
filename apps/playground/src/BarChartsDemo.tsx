/**
 * Bar Charts demo — showcases both `hbar` (categorical horizontal bars)
 * and `vbar` (categorical vertical bars) side-by-side.
 *
 * Data: 10 years of synthetic annual returns for a strategy, rendered as:
 *   - `hbar` : yearly returns, categorical y-axis (years top-to-bottom),
 *              value x-axis, symmetric around 0.
 *   - `vbar` : same data flipped 90° — categorical x-axis (years
 *              left-to-right), value y-axis.
 *
 * The `vbar` panel switches to a tight (non-symmetric) y-range automatically
 * for the all-positive "P&L per month" example on the right, so magnitude-
 * only datasets fill the plot instead of wasting half of it below zero.
 */
import { useMemo, useState } from 'react';
import { Chart } from '@finterion/charts-react';
import type { PanelSpec } from '@finterion/charts-core';
import { colors, radii, spacing } from './finterion/tokens';
import { useChartTheme } from './finterion/themeContext';

// ── Deterministic RNG (Mulberry32) ──────────────────────────────────────────
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
  return Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(2 * Math.PI * rand());
}

// ── Synthetic data ──────────────────────────────────────────────────────────
function yearlyReturns(seed = 42) {
  const rand = mulberry32(seed);
  const years: string[] = [];
  const values: number[] = [];
  const start = 2015;
  for (let i = 0; i < 10; i++) {
    const y = start + i;
    years.push(String(y));
    // Mix of up/down years around a modest positive drift, with one
    // deliberate drawdown year for visual contrast.
    const base = 0.08 * gauss(rand);
    const drift = 0.06;
    const shock = y === 2018 ? -0.22 : y === 2022 ? -0.15 : 0;
    values.push(+(base + drift + shock).toFixed(4));
  }
  return { years, values };
}

function monthlyPnl(seed = 11) {
  const rand = mulberry32(seed);
  // All-positive "bookings" per month — showcases vbar's tight y-range.
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const values = months.map(() => Math.round(40 + rand() * 260));
  return { months, values };
}

// ── Code snippet block (React + Python tabs) ────────────────────────────────
type Lang = 'react' | 'python';

const SNIPPETS: Record<Lang, { label: string; subtitle: string; code: string }> = {
  react: {
    label: 'React',
    subtitle: 'TypeScript · @finterion/charts-react',
    code: `import { Chart } from '@finterion/charts-react';
import type { PanelSpec } from '@finterion/charts-core';

// Horizontal bars — categorical y-axis, value x-axis, symmetric around 0.
const hbar: PanelSpec = {
  id: 'yearly-returns',
  kind: 'hbar',
  weight: 1,
  title: 'Yearly Returns',
  hbar: {
    categories: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
    values:     [ 0.087, 0.184, 0.213,-0.216, 0.337, 0.295,-0.022, 0.113, 0.544,-0.029],
    showMean: true,
    format:  (v) => \`\${(v * 100).toFixed(1)}%\`,
    positiveColor: '#1a7f37',
    negativeColor: '#cf222e',
  },
};

// Vertical bars — categorical x-axis, value y-axis. Same options as hbar.
const vbar: PanelSpec = {
  id: 'monthly-bookings',
  kind: 'vbar',
  weight: 1,
  title: 'Monthly Bookings',
  vbar: {
    categories: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    values:     [ 120, 180,  95, 210, 260, 145, 190, 175, 240, 205, 155, 220],
    showMean: true,
    format:  (v) => v.toFixed(0),
  },
};

export function BarCharts() {
  return (
    <>
      <Chart panels={[hbar]} style={{ width: '100%', height: 320 }} />
      <Chart panels={[vbar]} style={{ width: '100%', height: 320 }} />
    </>
  );
}`,
  },
  python: {
    label: 'Python',
    subtitle: 'Jupyter / Streamlit · finterion-charts',
    code: `from finterion_charts import ChartSpec, HBar, VBar

# Horizontal bars — categorical y-axis, value x-axis, symmetric around 0.
hbar_spec = (
    ChartSpec()
    .add_panel(HBar(
        id='yearly-returns',
        weight=1,
        title='Yearly Returns',
        categories=['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
        values=[0.087, 0.184, 0.213, -0.216, 0.337, 0.295, -0.022, 0.113, 0.544, -0.029],
        show_mean=True,
        format='pct1',
        positive_color='#1a7f37',
        negative_color='#cf222e',
    ))
)

# Vertical bars — categorical x-axis, value y-axis. Same options as HBar.
vbar_spec = (
    ChartSpec()
    .add_panel(VBar(
        id='monthly-bookings',
        weight=1,
        title='Monthly Bookings',
        categories=['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'],
        values=[120, 180, 95, 210, 260, 145, 190, 175, 240, 205, 155, 220],
        show_mean=True,
        format='fixed0',
    ))
)

hbar_spec.display_in_jupyter()
vbar_spec.display_in_jupyter()
# spec.show()  # plain Python — opens the chart in a browser`,
  },
};

function CodeBlock(): JSX.Element {
  const [lang, setLang] = useState<Lang>('react');
  const [copied, setCopied] = useState(false);
  const snippet = SNIPPETS[lang];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '5px 12px',
    background: active ? colors.ink : 'transparent',
    color: active ? colors.canvas : colors.ink,
    border: `1px solid ${colors.hairline}`,
    borderRadius: radii.xs,
    cursor: 'pointer',
    transition: 'background 120ms, color 120ms',
  });

  return (
    <div
      style={{
        marginTop: spacing.lg,
        border: `1px solid ${colors.hairline}`,
        borderRadius: radii.md,
        overflow: 'hidden',
        background: colors.canvas,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: `1px solid ${colors.hairlineSoft}`,
          background: colors.canvasSubtle,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {(['react', 'python'] as Lang[]).map((l) => (
            <button key={l} type="button" style={tabStyle(lang === l)} onClick={() => setLang(l)}>
              {SNIPPETS[l].label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 11,
              color: colors.inkMuted,
              letterSpacing: '0.04em',
              fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
            }}
          >
            {snippet.subtitle}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              ...tabStyle(false),
              background: copied ? colors.primarySubtle : 'transparent',
              color: copied ? colors.primary : colors.ink,
              borderColor: copied ? colors.primary : colors.hairline,
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '16px 18px',
          background: colors.surfaceDark,
          color: colors.onDark,
          fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
          fontSize: 12,
          lineHeight: 1.6,
          overflowX: 'auto',
          tabSize: 2,
        }}
      >
        <code>{snippet.code}</code>
      </pre>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export function BarChartsDemo(): JSX.Element {
  const theme = useChartTheme();
  const yr = useMemo(() => yearlyReturns(42), []);
  const mo = useMemo(() => monthlyPnl(11), []);

  const hbarPanels = useMemo<PanelSpec[]>(
    () => [
      {
        id: 'yearly-returns',
        kind: 'hbar',
        weight: 1,
        title: 'Yearly Returns',
        hbar: {
          categories: yr.years,
          values: yr.values,
          showMean: true,
          format: (v) => `${(v * 100).toFixed(1)}%`,
          positiveColor: colors.quantUpEmphasis,
          negativeColor: colors.quantDown,
        },
      },
    ],
    [yr],
  );

  const vbarSignedPanels = useMemo<PanelSpec[]>(
    () => [
      {
        id: 'yearly-returns-v',
        kind: 'vbar',
        weight: 1,
        title: 'Yearly Returns (vertical)',
        vbar: {
          categories: yr.years,
          values: yr.values,
          showMean: true,
          format: (v) => `${(v * 100).toFixed(1)}%`,
          positiveColor: colors.quantUpEmphasis,
          negativeColor: colors.quantDown,
        },
      },
    ],
    [yr],
  );

  const vbarPositivePanels = useMemo<PanelSpec[]>(
    () => [
      {
        id: 'monthly-bookings',
        kind: 'vbar',
        weight: 1,
        title: 'Monthly Bookings (all positive)',
        vbar: {
          categories: mo.months,
          values: mo.values,
          showMean: true,
          format: (v) => v.toFixed(0),
          positiveColor: colors.chartSeries1,
        },
      },
    ],
    [mo],
  );

  return (
    <div
      style={{
        background: colors.canvasSubtle,
        padding: `${spacing.xl}px ${spacing.xl}px`,
        color: colors.ink,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ marginBottom: spacing.lg }}>
          <div
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 11,
              color: colors.primary,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Bar Charts
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.2px',
            }}
          >
            <code style={{ background: colors.canvasInset, padding: '2px 6px', borderRadius: 4 }}>hbar</code>
            {' · '}
            <code style={{ background: colors.canvasInset, padding: '2px 6px', borderRadius: 4 }}>vbar</code>
          </h2>
          <p style={{ margin: '8px 0 0', color: colors.inkMuted, fontSize: 14, maxWidth: 720 }}>
            Categorical bars in either orientation. Both panels use the same options:
            <code> categories</code>, <code>values</code>, <code>positiveColor</code>,
            <code> negativeColor</code>, <code>showMean</code>, and a <code>format</code>{' '}
            callback. Mixed-sign data is drawn symmetric around zero; all-positive data
            fills the plot with a tight range.
          </p>
        </header>

        {/* Side-by-side: signed hbar + signed vbar of the same series. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: spacing.lg,
          }}
        >
          <ChartCard title="Horizontal (signed)">
            <Chart
              theme={theme}
              panels={hbarPanels}
              style={{ width: '100%', height: 320 }}
            />
          </ChartCard>
          <ChartCard title="Vertical (signed)">
            <Chart
              theme={theme}
              panels={vbarSignedPanels}
              style={{ width: '100%', height: 320 }}
            />
          </ChartCard>
        </div>

        {/* Full-width: all-positive vbar showing tight-range behaviour. */}
        <div style={{ marginTop: spacing.lg }}>
          <ChartCard title="Vertical (all-positive · tight range)">
            <Chart
              theme={theme}
              panels={vbarPositivePanels}
              style={{ width: '100%', height: 300 }}
            />
          </ChartCard>
        </div>

        <CodeBlock />
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        background: colors.canvas,
        border: `1px solid ${colors.hairlineSoft}`,
        borderRadius: radii.md,
        boxShadow: `0 1px 0 ${colors.shadowCard}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${colors.hairlineSoft}`,
          fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
          fontSize: 11,
          color: colors.inkMuted,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div style={{ padding: spacing.md }}>{children}</div>
    </div>
  );
}
