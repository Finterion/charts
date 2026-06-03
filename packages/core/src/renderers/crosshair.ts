import type { ThemeTokens, Viewport } from '../types';
import { xCenter } from './layout';

export interface CrosshairState {
  /** Index of hovered bar; -1 means hidden. */
  idx: number;
  /** Mouse y in CSS px relative to this panel's overlay. */
  y: number;
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: Viewport,
  theme: ThemeTokens,
  state: CrosshairState,
  showHorizontal: boolean,
) {
  if (state.idx < 0 || state.idx < viewport.startIdx || state.idx > viewport.endIdx) return;
  const x = xCenter(state.idx, viewport, width);
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.55;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  if (showHorizontal && state.y >= 0 && state.y <= height) {
    ctx.beginPath();
    ctx.moveTo(0, state.y);
    ctx.lineTo(width, state.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTooltip(
  ctx: CanvasRenderingContext2D,
  width: number,
  theme: ThemeTokens,
  lines: string[],
) {
  if (!lines.length) return;
  ctx.save();
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  const padX = 10;
  const padY = 8;
  const lineH = 14;
  let maxW = 0;
  for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
  const w = maxW + padX * 2;
  const h = lineH * lines.length + padY * 2;
  const x = 12;
  const y = 12;

  ctx.fillStyle = theme.surface;
  ctx.strokeStyle = theme.border;
  ctx.shadowColor = theme.accentGlow;
  ctx.shadowBlur = 14;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.fillStyle = theme.text;
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, x + padX, y + padY + i * lineH);
  }
  ctx.restore();
  void width;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
