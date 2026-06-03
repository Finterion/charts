import type { ThemeTokens, Viewport } from '../types';

export interface PanelLayout {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  viewport: Viewport;
  yMin: number;
  yMax: number;
  theme: ThemeTokens;
}

export function xCenter(i: number, vp: Viewport, width: number): number {
  const span = vp.endIdx - vp.startIdx + 1;
  const band = width / span;
  return band * (i - vp.startIdx + 0.5);
}

export function bandWidth(vp: Viewport, width: number): number {
  return width / (vp.endIdx - vp.startIdx + 1);
}

export function yPos(v: number, yMin: number, yMax: number, height: number): number {
  if (yMax === yMin) return height / 2;
  return height - ((v - yMin) / (yMax - yMin)) * height;
}

export function clearLayer(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
}

export function pad(yMin: number, yMax: number, frac = 0.05): [number, number] {
  const range = yMax - yMin || 1;
  const p = range * frac;
  return [yMin - p, yMax + p];
}
