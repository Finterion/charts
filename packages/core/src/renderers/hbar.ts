import type { HBarData, ThemeTokens } from '../types';
import { axisColors, fmtAxisNum } from './colors';

const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
const X_TICKS = 5;

export function renderHBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: HBarData,
  theme: ThemeTokens,
) {
  const { line, text, up, down } = axisColors(theme);
  const padL = 50;
  const padR = 24;
  const padT = 6;
  const padB = data.xLabel ? 32 : 22;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  const n = data.categories.length;
  if (n === 0) return;
  const rowH = innerH / n;
  const fmt = data.format ?? ((v: number) => v.toFixed(1));
  const positiveColor = data.positiveColor ?? up;
  const negativeColor = data.negativeColor ?? down;

  // Symmetric x-range with a small padding.
  const maxAbs = Math.max(0.01, ...data.values.map((v) => Math.abs(v)));
  const xMin = -maxAbs * 1.08;
  const xMax = maxAbs * 1.08;
  const x = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * innerW;

  ctx.save();
  ctx.font = FONT;

  // Vertical grid + x ticks.
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.fillStyle = text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let k = 0; k <= X_TICKS; k++) {
    const v = xMin + (k / X_TICKS) * (xMax - xMin);
    const px = Math.round(x(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, padT);
    ctx.lineTo(px, padT + innerH);
    ctx.stroke();
    ctx.fillText(fmtAxisNum(v), px, padT + innerH + 4);
  }

  // y labels (categories).
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = text;
  for (let i = 0; i < n; i++) {
    ctx.fillText(data.categories[i] ?? '', padL - 6, padT + rowH * i + rowH / 2);
  }

  // Bars.
  const barH = Math.max(2, rowH - 4);
  const x0 = x(0);
  for (let i = 0; i < n; i++) {
    const v = data.values[i] ?? 0;
    const x1 = x(v);
    const left = Math.min(x0, x1);
    const w = Math.abs(x1 - x0);
    const y = padT + rowH * i + (rowH - barH) / 2;
    ctx.fillStyle = v >= 0 ? positiveColor : negativeColor;
    ctx.fillRect(left, y, w, barH);
    // Value label outside the bar end.
    ctx.fillStyle = theme.text;
    ctx.textBaseline = 'middle';
    if (v >= 0) {
      ctx.textAlign = 'left';
      ctx.fillText(fmt(v), x1 + 4, y + barH / 2);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(fmt(v), x1 - 4, y + barH / 2);
    }
  }

  // Mean line.
  if (data.showMean && n > 0) {
    const mean = data.values.reduce((s, v) => s + v, 0) / n;
    ctx.strokeStyle = theme.textDim;
    ctx.setLineDash([4, 3]);
    const px = Math.round(x(mean)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, padT);
    ctx.lineTo(px, padT + innerH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`mean ${fmt(mean)}`, px + 4, padT + 2);
  }

  // Axis labels.
  if (data.xLabel) {
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(data.xLabel, padL + innerW / 2, height - 4);
  }
  if (data.yLabel) {
    ctx.save();
    ctx.translate(12, padT + innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(data.yLabel, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
