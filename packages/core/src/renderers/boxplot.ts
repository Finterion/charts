import type { BoxplotData, ThemeTokens } from '../types';
import { assertDistributionData } from '../data/distributions';
import { categoryColor } from './donut';
import { fmtAxisNum } from './colors';

export function boxplotStatistics(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  // Observed-order statistics intentionally do not interpolate.
  return {
    min: sorted[0]!, q1: sorted[Math.floor(n * 0.25)]!,
    median: sorted[Math.floor(n * 0.5)]!, q3: sorted[Math.floor(n * 0.75)]!,
    max: sorted[n - 1]!,
  };
}

export function pointJitter(category: number, observation: number): number {
  const hash = Math.imul(category + 1, 73856093) ^ Math.imul(observation + 1, 19349663);
  return ((hash >>> 0) % 1009) / 1008 - 0.5;
}

export function renderBoxplot(
  ctx: CanvasRenderingContext2D, width: number, height: number, data: BoxplotData, theme: ThemeTokens,
) {
  assertDistributionData('boxplot', data);
  if (width <= 0 || height <= 0 || !data.categories.length) return;
  const stats = data.values.map(boxplotStatistics);
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of stats) {
    if (!s) continue;
    lo = Math.min(lo, s.min);
    hi = Math.max(hi, s.max);
  }
  if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
  // Scale first to avoid overflowing the range for large, opposite-signed values.
  const scale = Math.max(1, Math.abs(lo), Math.abs(hi));
  lo /= scale;
  hi /= scale;
  const padding = (hi - lo || 1) * 0.08;
  lo -= padding;
  hi += padding;
  const left = Math.min(64, width * 0.3);
  const top = 24;
  const plotW = Math.max(1, width - left - 12);
  const plotH = Math.max(1, height - top - 28);
  const band = plotW / data.categories.length;
  const boxW = Math.min(48, band * 0.5);
  const y = (v: number) => top + (1 - (v / scale - lo) / (hi - lo)) * plotH;
  const fmt = data.format ?? fmtAxisNum;
  ctx.save();
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let k = 0; k <= 5; k++) {
    const normalized = lo + (hi - lo) * k / 5;
    const py = top + (1 - k / 5) * plotH;
    ctx.strokeStyle = theme.grid;
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(left + plotW, py);
    ctx.stroke();
    ctx.fillStyle = theme.textDim;
    // Padding can exceed the representable numeric range at Number.MAX_VALUE.
    const tick = normalized * scale;
    if (Number.isFinite(tick)) ctx.fillText(fmt(tick), left - 6, py, Math.max(1, left - 8));
  }
  data.categories.forEach((category, i) => {
    const cx = left + (i + 0.5) * band;
    ctx.fillStyle = theme.textDim;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(category, cx, top + plotH + 5, Math.max(1, band - 4));
    const s = stats[i];
    if (!s) return;
    const color = categoryColor(i, data.colors, theme);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, y(s.min));
    ctx.lineTo(cx, y(s.max));
    for (const value of [s.min, s.max]) {
      ctx.moveTo(cx - boxW / 4, y(value));
      ctx.lineTo(cx + boxW / 4, y(value));
    }
    ctx.stroke();
    const boxH = Math.max(1, y(s.q1) - y(s.q3));
    ctx.globalAlpha = 0.25;
    ctx.fillRect(cx - boxW / 2, y(s.q3), boxW, boxH);
    ctx.globalAlpha = 1;
    ctx.strokeRect(cx - boxW / 2, y(s.q3), boxW, boxH);
    ctx.beginPath();
    ctx.moveTo(cx - boxW / 2, y(s.median));
    ctx.lineTo(cx + boxW / 2, y(s.median));
    ctx.stroke();
    if (data.showPoints) {
      data.values[i]!.forEach((value, j) => {
        ctx.beginPath();
        ctx.arc(cx + pointJitter(i, j) * boxW, y(value), 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
  ctx.restore();
}
