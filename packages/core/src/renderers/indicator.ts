import type { IndicatorSeries } from '../types';
import type { PanelLayout } from './layout';
import { bandWidth, xCenter, yPos } from './layout';

export function indicatorExtrema(values: Float32Array, startIdx: number, endIdx: number, lowerValues?: Float32Array): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  const s = Math.max(0, startIdx);
  const e = Math.min(values.length - 1, endIdx);
  for (let i = s; i <= e; i++) {
    const v = values[i]!;
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (lowerValues) {
      const lv = lowerValues[i]!;
      if (Number.isFinite(lv)) {
        if (lv < min) min = lv;
        if (lv > max) max = lv;
      }
    }
  }
  if (!Number.isFinite(min)) return [0, 1];
  return [min, max];
}

export function renderIndicator(layout: PanelLayout, series: IndicatorSeries) {
  const { ctx, width, height, viewport, yMin, yMax, theme } = layout;
  const s = Math.max(0, viewport.startIdx);
  const e = Math.min(series.values.length - 1, viewport.endIdx);

  if (series.refLines) {
    ctx.save();
    ctx.strokeStyle = theme.border;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    for (const v of series.refLines) {
      const y = yPos(v, yMin, yMax, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width - 56, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  if (series.kind === 'band' && series.lowerValues) {
    const lower = series.lowerValues;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, series.glow ?? series.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;

    // Walk forward along the upper edge, then back along the lower edge,
    // breaking into separate sub-paths whenever either side has a NaN gap.
    ctx.beginPath();
    let runStart = -1;
    for (let i = s; i <= e + 1; i++) {
      const finite =
        i <= e && Number.isFinite(series.values[i]!) && Number.isFinite(lower[i]!);
      if (finite && runStart < 0) {
        runStart = i;
      } else if (!finite && runStart >= 0) {
        const runEnd = i - 1;
        // upper edge L -> R
        for (let j = runStart; j <= runEnd; j++) {
          const x = xCenter(j, viewport, width);
          const y = yPos(series.values[j]!, yMin, yMax, height);
          if (j === runStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // lower edge R -> L
        for (let j = runEnd; j >= runStart; j--) {
          const x = xCenter(j, viewport, width);
          const y = yPos(lower[j]!, yMin, yMax, height);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        runStart = -1;
      }
    }
    ctx.fill();

    // Stroke both edges on top of the fill.
    ctx.strokeStyle = series.color;
    ctx.shadowColor = series.glow ?? series.color;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.2;
    for (const arr of [series.values, lower]) {
      ctx.beginPath();
      let penDown = false;
      for (let i = s; i <= e; i++) {
        const v = arr[i]!;
        if (!Number.isFinite(v)) { penDown = false; continue; }
        const x = xCenter(i, viewport, width);
        const y = yPos(v, yMin, yMax, height);
        if (!penDown) { ctx.moveTo(x, y); penDown = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (series.kind === 'histogram') {
    const bw = bandWidth(viewport, width);
    const barW = Math.max(1, bw * 0.7);
    const zeroY = yPos(0, yMin, yMax, height);
    const negColor = series.colorNegative ?? series.color;
    ctx.shadowColor = series.glow ?? series.color;
    ctx.shadowBlur = 6;
    for (let i = s; i <= e; i++) {
      const v = series.values[i]!;
      if (!Number.isFinite(v)) continue;
      const y = yPos(v, yMin, yMax, height);
      const x = xCenter(i, viewport, width);
      ctx.fillStyle = v >= 0 ? series.color : negColor;
      ctx.fillRect(x - barW / 2, Math.min(y, zeroY), barW, Math.abs(y - zeroY));
    }
  } else if (series.kind === 'area') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, series.glow ?? series.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(xCenter(s, viewport, width), height);
    for (let i = s; i <= e; i++) {
      const v = series.values[i]!;
      ctx.lineTo(xCenter(i, viewport, width), yPos(Number.isFinite(v) ? v : 0, yMin, yMax, height));
    }
    ctx.lineTo(xCenter(e, viewport, width), height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = series.color;
    ctx.shadowColor = series.glow ?? series.color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let penDown = false;
    for (let i = s; i <= e; i++) {
      const v = series.values[i]!;
      if (!Number.isFinite(v)) { penDown = false; continue; }
      const x = xCenter(i, viewport, width);
      const y = yPos(v, yMin, yMax, height);
      if (!penDown) { ctx.moveTo(x, y); penDown = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    ctx.strokeStyle = series.color;
    ctx.shadowColor = series.glow ?? series.color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let penDown = false;
    for (let i = s; i <= e; i++) {
      const v = series.values[i]!;
      if (!Number.isFinite(v)) { penDown = false; continue; }
      const x = xCenter(i, viewport, width);
      const y = yPos(v, yMin, yMax, height);
      if (!penDown) { ctx.moveTo(x, y); penDown = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
