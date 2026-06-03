import type { ScatterData, ThemeTokens } from '../types';
import { axisColors, fmtAxisNum } from './colors';

const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
const TICKS = 5;

export function renderScatter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ScatterData,
  theme: ThemeTokens,
) {
  const { line, text, accent } = axisColors(theme);
  const padL = 50;
  const padR = 12;
  const padT = 6;
  const padB = data.xLabel ? 32 : 22;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  if (data.points.length === 0) return;

  let xLo = Infinity;
  let xHi = -Infinity;
  let yLo = Infinity;
  let yHi = -Infinity;
  for (const p of data.points) {
    if (p.x < xLo) xLo = p.x;
    if (p.x > xHi) xHi = p.x;
    if (p.y < yLo) yLo = p.y;
    if (p.y > yHi) yHi = p.y;
  }
  if (data.xRange) [xLo, xHi] = data.xRange;
  if (data.yRange) [yLo, yHi] = data.yRange;
  if (xHi === xLo) xHi = xLo + 1;
  if (yHi === yLo) yHi = yLo + 1;

  const x = (v: number) => padL + ((v - xLo) / (xHi - xLo)) * innerW;
  const y = (v: number) => padT + (1 - (v - yLo) / (yHi - yLo)) * innerH;
  const fmtX = data.formatX ?? fmtAxisNum;
  const fmtY = data.formatY ?? fmtAxisNum;

  ctx.save();
  ctx.font = FONT;

  // Grid + ticks.
  ctx.strokeStyle = line;
  ctx.fillStyle = text;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let k = 0; k <= TICKS; k++) {
    const v = yLo + (k / TICKS) * (yHi - yLo);
    const py = Math.round(y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(padL + innerW, py);
    ctx.stroke();
    ctx.fillText(fmtY(v), padL - 6, py);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let k = 0; k <= TICKS; k++) {
    const v = xLo + (k / TICKS) * (xHi - xLo);
    const px = Math.round(x(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, padT);
    ctx.lineTo(px, padT + innerH);
    ctx.stroke();
    ctx.fillText(fmtX(v), px, padT + innerH + 4);
  }

  // Identity line.
  if (data.identityLine) {
    const lo = Math.max(xLo, yLo);
    const hi = Math.min(xHi, yHi);
    if (hi > lo) {
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x(lo), y(lo));
      ctx.lineTo(x(hi), y(hi));
      ctx.stroke();
    }
  }

  // Points.
  const pr = data.pointRadius ?? 2.5;
  const pc = data.pointColor ?? accent;
  ctx.fillStyle = pc;
  ctx.strokeStyle = pc;
  for (const p of data.points) {
    ctx.beginPath();
    ctx.arc(x(p.x), y(p.y), pr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Frame.
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.strokeRect(padL + 0.5, padT + 0.5, innerW, innerH);

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
