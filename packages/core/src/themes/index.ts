import type { ThemeTokens } from '../types';

export const finterionDark: ThemeTokens = {
  bg: '#06070a',
  surface: 'rgba(18, 22, 30, 0.65)',
  border: 'rgba(255, 255, 255, 0.06)',
  text: '#e8ecf2',
  textDim: 'rgba(232, 236, 242, 0.55)',
  grid: 'rgba(255, 255, 255, 0.04)',
  up: '#00ffa3',
  upGlow: 'rgba(0, 255, 163, 0.55)',
  down: '#ff3d6e',
  downGlow: 'rgba(255, 61, 110, 0.55)',
  accent: '#00e5ff',
  accentGlow: 'rgba(0, 229, 255, 0.55)',
  magenta: '#ff2dd1',
  lime: '#a3ff12',
};

export const finterionLight: ThemeTokens = {
  bg: '#f6f7fb',
  surface: 'rgba(255, 255, 255, 0.85)',
  border: 'rgba(10, 14, 25, 0.08)',
  text: '#0a0e19',
  textDim: 'rgba(10, 14, 25, 0.55)',
  grid: 'rgba(10, 14, 25, 0.06)',
  up: '#00b377',
  upGlow: 'rgba(0, 179, 119, 0.35)',
  down: '#e02a55',
  downGlow: 'rgba(224, 42, 85, 0.35)',
  accent: '#0094c7',
  accentGlow: 'rgba(0, 148, 199, 0.35)',
  magenta: '#c72db1',
  lime: '#5fa30a',
};

export const themes = {
  'finterion-dark': finterionDark,
  'finterion-light': finterionLight,
} as const;

export type ThemeName = keyof typeof themes;

export function resolveTheme(t: ThemeTokens | ThemeName | undefined): ThemeTokens {
  if (!t) return finterionDark;
  if (typeof t === 'string') return themes[t] ?? finterionDark;
  return t;
}
