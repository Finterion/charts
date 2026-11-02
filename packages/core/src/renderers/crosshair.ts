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
