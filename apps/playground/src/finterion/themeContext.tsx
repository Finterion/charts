/**
 * Global chart-theme context for the playground. The user picks one of four
 * predefined chart themes (TradingView light/dark, Terminal light/dark) in
 * the top nav, and every demo's <Chart> reads it from here.
 *
 * Scope is intentionally narrow: this only drives the *chart* theme. The
 * surrounding page chrome (TopBar, Cards, KPI tiles) keeps its existing
 * Finterion light styling.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeName } from '@finterion/charts-core';

export type PlaygroundChartTheme = Extract<
  ThemeName,
  'tradingview-light' | 'tradingview-dark' | 'terminal-light' | 'terminal-dark'
>;

export const PLAYGROUND_THEMES: Array<{ value: PlaygroundChartTheme; label: string }> = [
  { value: 'tradingview-light', label: 'TV Light' },
  { value: 'tradingview-dark', label: 'TV Dark' },
  { value: 'terminal-light', label: 'Terminal Light' },
  { value: 'terminal-dark', label: 'Terminal Dark' },
];

const STORAGE_KEY = 'finterion-playground.chartTheme';
const DEFAULT_THEME: PlaygroundChartTheme = 'tradingview-light';

interface ThemeContextValue {
  theme: PlaygroundChartTheme;
  setTheme: (t: PlaygroundChartTheme) => void;
}

const Ctx = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

function readInitial(): PlaygroundChartTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && PLAYGROUND_THEMES.some((t) => t.value === saved)) {
    return saved as PlaygroundChartTheme;
  }
  return DEFAULT_THEME;
}

export function PlaygroundThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setTheme] = useState<PlaygroundChartTheme>(readInitial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useChartTheme(): PlaygroundChartTheme {
  return useContext(Ctx).theme;
}

export function useChartThemeControl(): ThemeContextValue {
  return useContext(Ctx);
}

/**
 * Convenience selector: returns true when the active theme is a "dark"
 * variant. Useful for picking series colors or backgrounds that should
 * adapt with the theme without reaching into the full token set.
 */
export function useIsDarkTheme(): boolean {
  const t = useChartTheme();
  return t === 'tradingview-dark' || t === 'terminal-dark';
}
