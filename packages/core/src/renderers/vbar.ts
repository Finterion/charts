import type { VBarData, ThemeTokens } from '../types';
import { axisColors, fmtAxisNum } from './colors';

const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
const Y_TICKS = 5;

export function renderVBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: VBarData,
  theme: ThemeTokens,
) {
  const { line, text, up, down } = axisColors(theme);
  const padL = data.yLabel ? 56 : 50;
  const padR = 12;
  const padT = 10;
  const padB = data.xLabel ? 34 : 24;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  const n = data.categories.length;
  if (n === 0) return;
  const colW = innerW / n;
  const fmt = data.format ?? ((v: number) => v.toFixed(1));
  const positiveColor = data.positiveColor ?? up;
  const negativeColor = data.negativeColor ?? down;

  // Y-range: symmetric around zero when the data has mixed signs, otherwise
  // tight around the min/max with a small padding. This preserves the "signed
  // returns" look of the hbar cousin while not wasting half the plot on all-
  // positive data (bar counts, magnitudes, …).
  let dMin = Infinity;
  let dMax = -Infinity;
  for (const v of data.values) {
    if (!Number.isFinite(v)) continue;
    if (v < dMin) dMin = v;
    if (v > dMax) dMax = v;
  }
  if (!Number.isFinite(dMin) || !Number.isFinite(dMax)) {
    dMin = 0;
    dMax = 1;
  }
  let yMin: number;
  let yMax: number;
  if (dMin < 0 && dMax > 0) {
    const m = Math.max(Math.abs(dMin), Math.abs(dMax));
    yMin = -m * 1.08;
    yMax = m * 1.08;
  } else if (dMax <= 0) {
    yMin = dMin * 1.08;
    yMax = 0;
  } else {
    yMin = 0;
    yMax = dMax * 1.08;
  }
  if (yMin === yMax) yMax = yMin + 1;
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  ctx.save();
  ctx.font = FONT;

  // Horizontal grid + y ticks.
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.fillStyle = text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let k = 0; k <= Y_TICKS; k++) {
    const v = yMin + (k / Y_TICKS) * (yMax - yMin);
    const py = Math.round(y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(padL + innerW, py);
    ctx.stroke();
    ctx.fillText(fmtAxisNum(v), padL - 6, py);
  }

  // Zero line (only when it lives inside the plot).
  if (yMin < 0 && yMax > 0) {
    const py = Math.round(y(0)) + 0.5;
    ctx.strokeStyle = theme.textDim;
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(padL + innerW, py);
    ctx.stroke();
  }

  // Bars.
  const barW = Math.max(2, colW - 4);
  const y0 = y(0);
  for (let i = 0; i < n; i++) {
    const v = data.values[i] ?? 0;
    const y1 = y(v);
    const top = Math.min(y0, y1);
    const h = Math.abs(y1 - y0);
    const cx = padL + colW * i + colW / 2;
    const x = cx - barW / 2;
    ctx.fillStyle = v >= 0 ? positiveColor : negativeColor;
    ctx.fillRect(x, top, barW, h);
    // Value label just outside the bar tip.
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'center';
    if (v >= 0) {
      ctx.textBaseline = 'bottom';
      ctx.fillText(fmt(v), cx, y1 - 3);
    } else {
      ctx.textBaseline = 'top';
      ctx.fillText(fmt(v), cx, y1 + 3);
    }
  }

  // X-axis category labels.
  ctx.fillStyle = text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < n; i++) {
    const cx = padL + colW * i + colW / 2;
    ctx.fillText(data.categories[i] ?? '', cx, padT + innerH + 4);
  }

  // Mean line (horizontal, dashed).
  if (data.showMean && n > 0) {
    let sum = 0;
    let count = 0;
    for (const v of data.values) {
      if (Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    if (count > 0) {
      const mean = sum / count;
      ctx.strokeStyle = theme.textDim;
      ctx.setLineDash([4, 3]);
      const py = Math.round(y(mean)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + innerW, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = theme.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`mean ${fmt(mean)}`, padL + 4, py - 2);
    }
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
