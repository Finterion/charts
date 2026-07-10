/**
 * Single-page playground that stacks every demo as a vertical section.
 * A sticky top nav lets users scroll between them — replaces the previous
 * hash-based router. Each demo keeps its own visual identity inside its
 * section; the wrapper just provides the unified shell + nav.
 */
import { useCallback, useEffect, useState } from 'react';
import { App } from './App';
import { LineChartDemo } from './LineChartDemo';
import { MonthlyChartDemo } from './MonthlyChartDemo';
import { BarChartsDemo } from './BarChartsDemo';
import { TrainTestDemo } from './TrainTestDemo';
import { SuperTrendDemo } from './SuperTrendDemo';
import { PortfolioOverview } from './PortfolioOverview';
import { EquityCurvesDemo } from './EquityCurvesDemo';
import { TerminalGreenDemo } from './TerminalGreenDemo';
import { LoadingDemo } from './LoadingDemo';
import { ZoomLevelsDemo } from './ZoomLevelsDemo';
import { colors, radii, spacing } from './finterion/tokens';
import {
  PLAYGROUND_THEMES,
  useChartThemeControl,
  type PlaygroundChartTheme,
} from './finterion/themeContext';

interface Section {
  id: string;
  label: string;
  description: string;
  Component: () => JSX.Element;
}

const SECTIONS: Section[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'BTC/USD synthetic feed · candles, line, area',
    Component: App,
  },
  {
    id: 'line-chart',
    label: 'Line Chart',
    description: 'BTC/USD daily line chart · 143 real bars',
    Component: LineChartDemo,
  },
  {
    id: 'monthly-returns',
    label: 'Monthly Returns',
    description: 'Synthetic 11-year monthly returns heatmap · terminal-green style',
    Component: MonthlyChartDemo,
  },
  {
    id: 'bar-charts',
    label: 'Bar Charts',
    description: 'hbar (horizontal) + vbar (vertical) categorical bars',
    Component: BarChartsDemo,
  },
  {
    id: 'train-test',
    label: 'Train / Test',
    description: 'BTC/USD 2022–2023 · train vs test split',
    Component: TrainTestDemo,
  },
  {
    id: 'equity',
    label: 'Equity',
    description: '20 algorithm equity curves with sidebar legend',
    Component: EquityCurvesDemo,
  },
  {
    id: 'zoom-levels',
    label: 'Zoom Levels',
    description: 'Three equity-curve overlays showing initialZoom 50 / 100 / 120',
    Component: ZoomLevelsDemo,
  },
  {
    id: 'supertrend',
    label: 'SuperTrend',
    description: 'Live spec editor with worker indicators',
    Component: SuperTrendDemo,
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    description: 'QF-Lib-style print tearsheet',
    Component: PortfolioOverview,
  },
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Phosphor-green WSB-style strategy vs SPY',
    Component: TerminalGreenDemo,
  },
  {
    id: 'loading',
    label: 'Loading',
    description: 'Spinner overlay while data is in-flight',
    Component: LoadingDemo,
  },
];

export function MergedPlayground() {
  const [active, setActive] = useState<string>(() => {
    if (typeof window === 'undefined') return SECTIONS[0]!.id;
    const hash = window.location.hash.replace('#', '');
    return SECTIONS.some((s) => s.id === hash) ? hash : SECTIONS[0]!.id;
  });

  // Active-section detection via IntersectionObserver. Whichever section is
  // closest to the top of the viewport wins.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Prefer the section with the highest intersectionRatio that is
        // currently intersecting; falls back to whatever is closest.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top) setActive(top.target.id);
      },
      // 30% from the top of the viewport activates a section.
      { rootMargin: '-30% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Keep the URL hash in sync with the active section so reloads land on the
  // last viewed demo.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = active === SECTIONS[0]!.id ? '' : `#${active}`;
    if (window.location.hash !== next) {
      // Use replaceState so we don't pollute history while scrolling.
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
    }
  }, [active]);

  // Smooth-scroll to a section, accounting for the sticky nav height.
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const navHeight = 56;
    const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  return (
    <div style={{ background: colors.canvasSubtle, minHeight: '100vh' }}>
      {/* Sticky section nav */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: colors.canvas,
          borderBottom: `1px solid ${colors.hairline}`,
          padding: `0 ${spacing.xl}px`,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.lg,
          boxShadow: '0 1px 0 rgba(31,35,40,0.04)',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 26,
            height: 26,
            borderRadius: radii.sm,
            background: colors.ink,
            color: colors.canvas,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          Fn
        </div>
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            color: colors.ink,
            marginRight: spacing.lg,
          }}
        >
          Finterion Charts
        </div>
        <nav
          style={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            flex: 1,
            minWidth: 0,
          }}
        >
          {SECTIONS.map((s) => (
            <SectionLink
              key={s.id}
              active={active === s.id}
              label={s.label}
              onClick={() => scrollTo(s.id)}
            />
          ))}
        </nav>
        <ThemeSwitcher />
        <div
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 1,
            color: colors.primary,
            background: colors.primarySubtle,
            padding: '2px 8px',
            borderRadius: radii.sm,
            whiteSpace: 'nowrap',
          }}
        >
          PLAYGROUND
        </div>
      </div>

      {/* Stacked sections */}
      {SECTIONS.map((s) => (
        <section
          key={s.id}
          id={s.id}
          aria-label={s.label}
          style={{
            // scroll-margin offsets the sticky nav for #anchor jumps.
            scrollMarginTop: 56,
          }}
        >
          <s.Component />
        </section>
      ))}

      <footer
        style={{
          padding: `${spacing.lg}px ${spacing.xl}px`,
          textAlign: 'center',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11,
          color: colors.inkMuted,
          letterSpacing: 0.5,
          background: colors.canvas,
          borderTop: `1px solid ${colors.hairlineSoft}`,
        }}
      >
        Finterion Charts · {SECTIONS.length} demos · scroll or use the nav
      </footer>
    </div>
  );
}

// ──────────────────────────── Theme switcher ────────────────────────────

/**
 * Compact 4-way segmented control bound to `PlaygroundThemeContext`.
 * Drives the chart theme for every demo on the page.
 */
function ThemeSwitcher() {
  const { theme, setTheme } = useChartThemeControl();
  return (
    <div
      role="radiogroup"
      aria-label="Chart theme"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: 2,
        background: colors.canvasSubtle,
        border: `1px solid ${colors.hairlineSoft}`,
        borderRadius: radii.sm,
      }}
    >
      {PLAYGROUND_THEMES.map((opt) => (
        <ThemeButton
          key={opt.value}
          active={theme === opt.value}
          label={opt.label}
          value={opt.value}
          onClick={() => setTheme(opt.value)}
        />
      ))}
    </div>
  );
}

function ThemeButton({
  active,
  label,
  value,
  onClick,
}: {
  active: boolean;
  label: string;
  value: PlaygroundChartTheme;
  onClick: () => void;
}) {
  // Tiny color swatch on the left of each button hints at the theme palette.
  const swatch = SWATCHES[value];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: '0 10px',
        background: active ? colors.canvas : 'transparent',
        color: active ? colors.ink : colors.inkMuted,
        border: 'none',
        borderRadius: radii.xs,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: active ? '0 1px 0 rgba(31,35,40,0.06)' : 'none',
        transition: 'background 80ms ease, color 80ms ease',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: swatch.bg,
          border: `1px solid ${swatch.border}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 1,
            background: swatch.line,
            opacity: 0.9,
            clipPath: 'polygon(0 70%, 25% 50%, 50% 60%, 75% 30%, 100% 40%, 100% 100%, 0 100%)',
          }}
        />
      </span>
      {label}
    </button>
  );
}

const SWATCHES: Record<PlaygroundChartTheme, { bg: string; line: string; border: string }> = {
  'tradingview-light': { bg: '#ffffff', line: '#089981', border: '#e0e3eb' },
  'tradingview-dark': { bg: '#131722', line: '#26a69a', border: '#2a2e39' },
  'terminal-light': { bg: '#f5f1e8', line: '#2a7a1f', border: 'rgba(26,46,10,0.25)' },
  'terminal-dark': { bg: '#000000', line: '#00ff37', border: 'rgba(0,255,55,0.4)' },
};

function SectionLink({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 32,
        padding: '0 14px',
        background: active ? colors.primary : 'transparent',
        color: active ? colors.onPrimary : colors.ink,
        border: 'none',
        borderRadius: radii.sm,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 80ms ease, color 80ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = colors.canvasSubtle;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {label}
    </button>
  );
}
