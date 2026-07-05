/**
 * Monthly Returns Heatmap demo.
 *
 * Generates 11 years of synthetic daily equity returns (2006-2016), rolls
 * them up to monthly compound returns, then renders the result as a `kind:
 * 'heatmap'` panel styled with a phosphor-green terminal palette — matching
 * the reference screenshot.
 *
 * The `colorScale` callback maps t ∈ [-1, 1] to a red/black/green gradient
 * so that positive months glow green and losing months glow red.
 */
import { useMemo, useState } from 'react';
import { Chart } from '@finterion/charts-react';
import type { PanelSpec } from '@finterion/charts-core';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Phosphor-green palette (matches TerminalGreenDemo) ──────────────────────
const T = {
  bg: '#000000',
  text: '#00ff37',
  textGlow: 'rgba(0,255,55,0.55)',
  border: 'rgba(0,255,55,0.35)',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
} as const;

// ── Deterministic RNG (Mulberry32) ───────────────────────────────────────────
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

// ── Synthetic daily returns → monthly compound returns ───────────────────────
interface MonthlyCell {
  year: number;
  month: number; // 0-based
  ret: number;
}

function generateMonthly(startYear = 2006, years = 11, seed = 7): MonthlyCell[] {
  const rand = mulberry32(seed);
  const map = new Map<string, number>();
  const start = new Date(Date.UTC(startYear, 0, 2));
  const end = new Date(Date.UTC(startYear + years, 0, 1));

  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const mu = 0.16 / 252;
    const sigma = 0.14 / Math.sqrt(252);
    const yr = d.getUTCFullYear();
    const shock = yr === 2008 ? -0.0018 : yr === 2015 ? -0.0006 : 0;
    const r = mu + shock + sigma * gauss(rand);
    const k = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    map.set(k, (map.get(k) ?? 1) * (1 + r));
  }

  return Array.from(map.entries())
    .map(([k, v]) => {
      const [y, m] = k.split('-').map(Number);
      return { year: y!, month: m!, ret: v - 1 };
    })
    .sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month));
}

function buildHeatmap(monthly: MonthlyCell[]): { rows: string[]; values: (number | null)[][] } {
  const years = Array.from(new Set(monthly.map((m) => m.year))).sort((a, b) => b - a);
  const rows = years.map(String);
  const values: (number | null)[][] = years.map(() => Array<number | null>(12).fill(null));
  const idx = new Map(years.map((y, i) => [y, i]));
  for (const m of monthly) {
    const r = idx.get(m.year);
    if (r !== undefined) values[r]![m.month] = m.ret;
  }
  return { rows, values };
}

// ── Phosphor color scale: red ← 0 → green, with black at zero ───────────────
function terminalColorScale(t: number): string {
  // t in [-1, 1]. Negative → red glow, positive → green glow.
  const intensity = Math.abs(t);
  if (t < 0) {
    const r = Math.round(180 * intensity);
    const g = Math.round(20 * (1 - intensity));
    return `rgb(${r},${g},0)`;
  }
  const g = Math.round(80 + 175 * intensity);
  const r = Math.round(10 * (1 - intensity));
  return `rgb(${r},${g},${r})`;
}

// ── Code snippet block ───────────────────────────────────────────────────────
type Lang = 'react' | 'python';

const SNIPPETS: Record<Lang, { label: string; subtitle: string; code: string }> = {
  react: {
    label: 'React',
    subtitle: 'TypeScript · @finterion/charts-react',
    code: `import { useMemo } from 'react';
import { Chart } from '@finterion/charts-react';
import type { PanelSpec } from '@finterion/charts-core';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                 'Jul','Aug','Sep','Oct','Nov','Dec'];

// monthly: Array<{ year: number; month: number; ret: number }>
//   month is 0-based, ret is a decimal (e.g. 0.034 = 3.4 %)
function buildHeatmap(monthly) {
  const years = [...new Set(monthly.map(d => d.year))].sort((a, b) => b - a);
  const rows = years.map(String);
  const values = years.map(() => Array(12).fill(null));
  const idx = new Map(years.map((y, i) => [y, i]));
  for (const m of monthly) {
    const r = idx.get(m.year);
    if (r !== undefined) values[r][m.month] = m.ret;
  }
  return { rows, values };
}

function terminalColorScale(t) {
  const v = Math.abs(t);
  if (t < 0) return \`rgb(\${Math.round(180*v)},\${Math.round(20*(1-v))},0)\`;
  return \`rgb(\${Math.round(10*(1-v))},\${Math.round(80+175*v)},\${Math.round(10*(1-v))})\`;
}

export function MonthlyReturnsHeatmap({ monthly }) {
  const { rows, values } = useMemo(() => buildHeatmap(monthly), [monthly]);

  const panels: PanelSpec[] = useMemo(() => [{
    id: 'monthly-returns',
    kind: 'heatmap',
    weight: 1,
    heatmap: {
      rows,
      cols: MONTHS,
      values,
      format: v => \`\${(v * 100).toFixed(1)}\`,
      colorScale: terminalColorScale,
      xLabel: 'Month',
      yLabel: 'Year',
    },
  }], [rows, values]);

  return (
    <Chart
      panels={panels}
      background="#000000"
      gridColor="rgba(0,255,55,0.35)"
      style={{ width: '100%', height: 340 }}
    />
  );
}`,
  },
  python: {
    label: 'Python',
    subtitle: 'Jupyter / Streamlit · finterion-charts',
    code: `from finterion_charts import ChartSpec, Heatmap

MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
          'Jul','Aug','Sep','Oct','Nov','Dec']

# monthly: list of dicts with keys year, month (1-based), ret (decimal)
years = sorted({m['year'] for m in monthly}, reverse=True)
rows  = [str(y) for y in years]
idx   = {y: i for i, y in enumerate(years)}
values = [[None] * 12 for _ in years]
for m in monthly:
    r = idx.get(m['year'])
    if r is not None:
        values[r][m['month'] - 1] = m['ret']

spec = (
    ChartSpec(background='#000000',
              grid_color='rgba(0,255,55,0.35)')
    .add_panel(
        Heatmap(
            id='monthly-returns',
            weight=1,
            rows=rows,
            cols=MONTHS,
            values=values,
            format=lambda v: f'{v * 100:.1f}',
            x_label='Month',
            y_label='Year',
        )
    )
)

spec.display()   # Jupyter / VS Code notebook
# spec.show()    # plain Python — opens in browser`,
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
    } catch { /* ignore in insecure contexts */ }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: T.mono,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '5px 12px',
    background: active ? T.text : 'transparent',
    color: active ? T.bg : T.text,
    border: `1px solid ${T.border}`,
    borderRadius: 3,
    cursor: 'pointer',
    transition: 'background 120ms, color 120ms',
  });

  return (
    <div
      style={{
        marginTop: 24,
        border: `1px solid ${T.border}`,
        boxShadow: `0 0 8px ${T.textGlow}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: `1px solid ${T.border}`,
          background: 'rgba(0,255,55,0.04)',
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
          <span style={{ fontSize: 11, color: T.text, opacity: 0.6, letterSpacing: '0.06em' }}>
            {snippet.subtitle}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              ...tabStyle(false),
              color: copied ? T.text : T.text,
              background: copied ? 'rgba(0,255,55,0.18)' : 'transparent',
              borderColor: copied ? T.text : T.border,
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Code */}
      <pre
        style={{
          margin: 0,
          padding: '16px 18px',
          background: T.bg,
          color: T.text,
          fontFamily: T.mono,
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
export function MonthlyChartDemo(): JSX.Element {
  const monthly = useMemo(() => generateMonthly(2006, 11, 7), []);
  const { rows, values } = useMemo(() => buildHeatmap(monthly), [monthly]);

  const panels = useMemo<PanelSpec[]>(
    () => [
      {
        id: 'monthly-returns',
        kind: 'heatmap',
        weight: 1,
        heatmap: {
          rows,
          cols: MONTHS_SHORT,
          values,
          format: (v) => `${(v * 100).toFixed(1)}`,
          colorScale: terminalColorScale,
          xLabel: 'Month',
          yLabel: 'Year',
        },
      },
    ],
    [rows, values],
  );

  return (
    <div
      style={{
        background: T.bg,
        color: T.text,
        fontFamily: T.mono,
        padding: '32px 24px',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Title */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 4,
            marginBottom: 20,
            color: T.text,
            textShadow: `0 0 8px ${T.textGlow}`,
            userSelect: 'none',
          }}
        >
          MONTHLY RETURNS
        </div>

        {/* Chart */}
        <div
          style={{
            border: `1px solid ${T.border}`,
            boxShadow: `0 0 12px ${T.textGlow}`,
          }}
        >
          <Chart
            panels={panels}
            background={T.bg}
            gridColor={T.border}
            titleColor={T.text}
            style={{ width: '100%', height: 340 }}
          />
        </div>

        {/* Code snippets */}
        <CodeBlock />

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 10,
            letterSpacing: 2,
            color: T.text,
            opacity: 0.55,
            marginTop: 10,
          }}
        >
          POWERED BY FINTERION
        </div>
      </div>
    </div>
  );
}
