import type { ThemeTokens } from '../types';

// ──────────────────────────────────────────────────────────────────────
// TradingView-inspired themes
// ──────────────────────────────────────────────────────────────────────

export const tradingviewLight: ThemeTokens = {
  bg: '#ffffff',
  surface: 'rgba(255, 255, 255, 0.95)',
  border: '#e0e3eb',
  text: '#131722',
  textDim: 'rgba(19, 23, 34, 0.6)',
  grid: '#e0e3eb',
  up: '#089981',
  upGlow: 'rgba(8, 153, 129, 0.25)',
  down: '#f23645',
  downGlow: 'rgba(242, 54, 69, 0.25)',
  accent: '#2962ff',
  accentGlow: 'rgba(41, 98, 255, 0.3)',
  magenta: '#e91e63',
  lime: '#87a92a',
};

export const tradingviewDark: ThemeTokens = {
  bg: '#131722',
  surface: 'rgba(30, 34, 45, 0.95)',
  border: '#2a2e39',
  text: '#d1d4dc',
  textDim: 'rgba(209, 212, 220, 0.6)',
  grid: '#1e222d',
  up: '#26a69a',
  upGlow: 'rgba(38, 166, 154, 0.45)',
  down: '#ef5350',
  downGlow: 'rgba(239, 83, 80, 0.45)',
  accent: '#2962ff',
  accentGlow: 'rgba(41, 98, 255, 0.5)',
  magenta: '#e91e63',
  lime: '#b6e880',
};

// ──────────────────────────────────────────────────────────────────────
// Terminal / phosphor themes
// ──────────────────────────────────────────────────────────────────────

export const terminalDark: ThemeTokens = {
  bg: '#000000',
  surface: 'rgba(0, 20, 0, 0.85)',
  border: 'rgba(0, 255, 55, 0.3)',
  text: '#00ff37',
  textDim: 'rgba(0, 255, 55, 0.55)',
  grid: 'rgba(0, 255, 55, 0.16)',
  up: '#00ff37',
  upGlow: 'rgba(0, 255, 55, 0.55)',
  down: '#ff3d6e',
  downGlow: 'rgba(255, 61, 110, 0.45)',
  accent: '#00ffd1',
  accentGlow: 'rgba(0, 255, 209, 0.5)',
  magenta: '#ff2dd1',
  lime: '#a3ff12',
};

/**
 * "Paper terminal" — cream paper background with dark green phosphor-style
 * series. Evokes an old line-printer trading terminal with warm amber
 * accents. Pairs with `terminalDark` as the light counterpart.
 */
export const terminalLight: ThemeTokens = {
  bg: '#f5f1e8',
  surface: 'rgba(245, 241, 232, 0.95)',
  border: 'rgba(26, 46, 10, 0.25)',
  text: '#1a2e0a',
  textDim: 'rgba(26, 46, 10, 0.55)',
  grid: 'rgba(26, 46, 10, 0.18)',
  up: '#2a7a1f',
  upGlow: 'rgba(42, 122, 31, 0.35)',
  down: '#b8240f',
  downGlow: 'rgba(184, 36, 15, 0.35)',
  accent: '#8a4a00',
  accentGlow: 'rgba(138, 74, 0, 0.35)',
  magenta: '#7a1f5a',
  lime: '#5a7a1f',
};

// ──────────────────────────────────────────────────────────────────────
// Back-compat: keep the old finterion-* names as aliases so existing
// consumers (apps/embed, spec) don't break when this package upgrades.
// ──────────────────────────────────────────────────────────────────────

export const finterionLight: ThemeTokens = tradingviewLight;
export const finterionDark: ThemeTokens = tradingviewDark;

export const themes = {
  'tradingview-light': tradingviewLight,
  'tradingview-dark': tradingviewDark,
  'terminal-light': terminalLight,
  'terminal-dark': terminalDark,
  // Legacy aliases.
  'finterion-light': tradingviewLight,
  'finterion-dark': tradingviewDark,
} as const;

export type ThemeName = keyof typeof themes;

export function resolveTheme(t: ThemeTokens | ThemeName | undefined): ThemeTokens {
  if (!t) return tradingviewDark;
  if (typeof t === 'string') return themes[t] ?? tradingviewDark;
  return t;
}
