import type { PanelLayout } from './layout';
import { xCenter, yPos } from './layout';
import type { ThemeTokens, Viewport } from '../types';
void xCenter;

/** Background grid style. */
export type GridStyle = 'none' | 'horizontal' | 'full';

const Y_TICKS = 5;

export function drawGrid(
  layout: PanelLayout,
  style: GridStyle = 'horizontal',
  verticalXs: number[] = [],
) {
  const { ctx, width, height, theme, yMin, yMax } = layout;
  ctx.save();
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = theme.textDim;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  if (style === 'full') {
    for (const x of verticalXs) {
      const px = Math.round(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
  }

  for (let i = 0; i <= Y_TICKS; i++) {
    const t = i / Y_TICKS;
    const v = yMax - t * (yMax - yMin);
    const y = yPos(v, yMin, yMax, height);
    if (style !== 'none') {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width - 56, y);
      ctx.stroke();
    }
    ctx.fillText(formatTick(v), width - 6, y);
  }
  ctx.restore();
}

export interface TitleStyle {
  color?: string;
  fontSize?: number;
  paddingTop?: number;
  paddingLeft?: number;
}

export function drawTitle(layout: PanelLayout, title: string, style: TitleStyle = {}) {
  const { ctx, theme } = layout;
  const fontSize = style.fontSize ?? 11;
  const padTop = style.paddingTop ?? 8;
  const padLeft = style.paddingLeft ?? 8;
  ctx.save();
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = style.color ?? theme.textDim;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title.toUpperCase(), padLeft, padTop);
  ctx.restore();
}

function formatTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 10000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

/**
 * Compute the visible time-axis ticks for a viewport, using the same nice-step
 * ladder as drawTimeAxis. Returns objects with `t` (timestamp ms) and `x`
 * (CSS pixel center inside `width`). Used by both the time axis renderer and
 * panels that want to anchor vertical grid lines on these positions.
 */
export function computeTimeTicks(
  viewport: Viewport,
  times: Float64Array,
  width: number,
): { t: number; x: number; stepMs: number }[] {
  if (viewport.endIdx < viewport.startIdx) return [];
  const tStart = times[viewport.startIdx];
  const tEnd = times[viewport.endIdx];
  if (tStart === undefined || tEnd === undefined || tEnd <= tStart) return [];
  const totalMs = tEnd - tStart;
  const targetCount = Math.max(3, Math.floor(width / 100));
  const span = viewport.endIdx - viewport.startIdx + 1;

  const idxFromTime = (t: number): number => {
    if (t <= tStart) return viewport.startIdx;
    if (t >= tEnd) return viewport.endIdx;
    let lo = viewport.startIdx;
    let hi = viewport.endIdx;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid]! < t) lo = mid + 1;
      else hi = mid;
    }
    if (lo > viewport.startIdx) {
      const t0 = times[lo - 1]!;
      const t1 = times[lo]!;
      if (t1 > t0) return lo - 1 + (t - t0) / (t1 - t0);
    }
    return lo;
  };

  let bestTicks: number[] | null = null;
  let bestStep = 0;
  let bestDist = Infinity;
  for (const step of NICE_STEPS_MS) {
    const first = alignUp(tStart, step);
    const ticks: number[] = [];
    for (let t = first; t <= tEnd; t += step) ticks.push(t);
    if (ticks.length === 0) continue;
    const dist = Math.abs(ticks.length - targetCount);
    if (dist < bestDist) {
      bestDist = dist;
      bestTicks = ticks;
      bestStep = step;
    }
  }

  if (!bestTicks || bestTicks.length < 2) {
    const n = Math.max(2, Math.min(targetCount, span));
    const out: { t: number; x: number; stepMs: number }[] = [];
    const avgBarMs = totalMs / Math.max(1, span - 1);
    const stepMs = avgBarMs * (span / n);
    for (let k = 0; k < n; k++) {
      const idx = viewport.startIdx + Math.round((k + 0.5) * (span / n) - 0.5);
      const clamped = Math.max(viewport.startIdx, Math.min(viewport.endIdx, idx));
      const t = times[clamped];
      if (t === undefined) continue;
      const x = ((clamped - viewport.startIdx + 0.5) / span) * width;
      out.push({ t, x, stepMs });
    }
    return out;
  }

  return bestTicks.map((t) => {
    const idx = idxFromTime(t);
    const x = ((idx - viewport.startIdx + 0.5) / span) * width;
    return { t, x, stepMs: bestStep };
  });
}

/**
 * Draws the bottom time axis: tick marks + time labels. Picks a sensible
 * number of labels based on width and spaces them along the visible viewport.
 */
export function drawTimeAxis(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: Viewport,
  times: Float64Array,
  theme: ThemeTokens,
) {
  ctx.clearRect(0, 0, width, height);
  if (viewport.endIdx < viewport.startIdx) return;
  ctx.save();
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.lineTo(width, 0.5);
  ctx.stroke();

  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = theme.textDim;
  ctx.textBaseline = 'top';

  const tStart = times[viewport.startIdx];
  const tEnd = times[viewport.endIdx];
  if (tStart === undefined || tEnd === undefined || tEnd <= tStart) {
    ctx.restore();
    return;
  }
  const totalMs = tEnd - tStart;
  const showDate = totalMs > 24 * 3600 * 1000;
  const spansYears = totalMs > 365 * 24 * 3600 * 1000;

  const ticks = computeTimeTicks(viewport, times, width);
  for (const { t, x, stepMs } of ticks) {
    ctx.strokeStyle = theme.grid;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 4);
    ctx.stroke();
    const label = formatTimeLabel(t, showDate, spansYears, stepMs);
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width;
    const cx = Math.max(tw / 2 + 2, Math.min(width - tw / 2 - 2, x));
    ctx.fillText(label, cx, 7);
  }
  ctx.restore();
}

const NICE_STEPS_MS: number[] = [
  60_000,            // 1m
  5 * 60_000,        // 5m
  15 * 60_000,       // 15m
  30 * 60_000,       // 30m
  3600_000,          // 1h
  2 * 3600_000,      // 2h
  4 * 3600_000,      // 4h
  6 * 3600_000,      // 6h
  12 * 3600_000,     // 12h
  86_400_000,        // 1d
  2 * 86_400_000,    // 2d
  7 * 86_400_000,    // 1w
  14 * 86_400_000,   // 2w
  30 * 86_400_000,   // ~1mo
  90 * 86_400_000,   // ~1q
  365 * 86_400_000,  // ~1y
];

function pickNiceStep(approxMs: number): number {
  for (const s of NICE_STEPS_MS) if (s >= approxMs) return s;
  return NICE_STEPS_MS[NICE_STEPS_MS.length - 1]!;
}
void pickNiceStep;

function alignUp(t: number, stepMs: number): number {
  // For day or larger steps, align to UTC midnight to avoid odd 23:00 ticks
  // bleeding from sub-day boundaries.
  if (stepMs >= 86_400_000) {
    const day = 86_400_000;
    const dayStart = Math.ceil(t / day) * day;
    // Snap to the nearest multiple of stepMs (in days), anchored at the epoch.
    return Math.ceil(dayStart / stepMs) * stepMs;
  }
  return Math.ceil(t / stepMs) * stepMs;
}

function formatTimeLabel(t: number, showDate: boolean, spansYears: boolean, stepMs: number): string {
  const d = new Date(t);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  if (spansYears && stepMs >= 30 * 86_400_000) {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  }
  if (stepMs >= 86_400_000) {
    // Daily or coarser: just date.
    return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`;
  }
  if (showDate) {
    return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
