import type { ThemeTokens } from '../types';

/** Linear interpolation between two `rgb(...)` strings (returned literally). */
export function lerpColor(c0: [number, number, number], c1: [number, number, number], t: number): string {
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
  return `rgb(${r},${g},${b})`;
}

/** Default red→white→blue diverging scale. `t ∈ [-1, 1]`. */
export function divergingScale(t: number): string {
  const clamped = Math.max(-1, Math.min(1, t));
  if (clamped >= 0) return lerpColor([255, 255, 255], [31, 95, 166], clamped);
  return lerpColor([255, 255, 255], [200, 64, 64], -clamped);
}

/** Format a small number for axis labels. */
export function fmtAxisNum(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1000) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toExponential(1);
}

/** Common axis colors derived from the theme. */
export function axisColors(theme: ThemeTokens) {
  return {
    line: theme.grid,
    text: theme.textDim,
    accent: theme.accent,
    up: theme.up,
    down: theme.down,
  };
}
