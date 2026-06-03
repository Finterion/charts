import type { HistogramData, ThemeTokens } from '../types';
import { axisColors, fmtAxisNum } from './colors';

const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
const Y_TICKS = 5;

export function renderValueHistogram(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: HistogramData,
  theme: ThemeTokens,
) {
  const { line, text, accent } = axisColors(theme);
  const padL = 50;
  const padR = 12;
  const padT = 6;
  const padB = data.xLabel ? 32 : 22;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  const n = data.values.length;
  if (n === 0) return;
  const bins = Math.max(1, data.bins ?? 20);

  let lo = Infinity;
  let hi = -Infinity;
  let sum = 0;
  for (const v of data.values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
    sum += v;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) {
    hi = lo + 1;
  }
  const step = (hi - lo) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const v of data.values) {
    if (!Number.isFinite(v)) continue;
    const k = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / step)));
    counts[k]++;
  }
  const cMax = Math.max(1, ...counts);
  const mean = sum / n;
  const fmtX = data.formatX ?? fmtAxisNum;

  const x = (v: number) => padL + ((v - lo) / (hi - lo)) * innerW;
  const y = (c: number) => padT + (1 - c / cMax) * innerH;

  ctx.save();
  ctx.font = FONT;

  // Horizontal grid + y-ticks.
  ctx.strokeStyle = line;
  ctx.fillStyle = text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let k = 0; k <= Y_TICKS; k++) {
    const c = (cMax * k) / Y_TICKS;
    const py = Math.round(y(c)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(padL + innerW, py);
    ctx.stroke();
    ctx.fillText(Math.round(c).toString(), padL - 6, py);
  }

  // Bars.
  ctx.fillStyle = data.color ?? accent;
  for (let i = 0; i < bins; i++) {
    const bx = x(lo + i * step);
    const bw = (innerW / bins) - 2;
    const c = counts[i] ?? 0;
    const by = y(c);
    ctx.fillRect(bx + 1, by, Math.max(1, bw), padT + innerH - by);
  }

  // x-tick labels (5 across).
  ctx.fillStyle = text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const X_TICKS = 5;
  for (let k = 0; k <= X_TICKS; k++) {
    const v = lo + (k / X_TICKS) * (hi - lo);
    ctx.fillText(fmtX(v), x(v), padT + innerH + 4);
  }

  // Mean line.
  if (data.showMean && Number.isFinite(mean)) {
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
    ctx.fillText(`mean ${fmtX(mean)}`, px + 4, padT + 2);
  }

  // Frame.
  ctx.strokeStyle = line;
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
