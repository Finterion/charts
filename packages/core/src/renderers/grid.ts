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
  const n = times.length;
  if (n === 0) return [];
  // The viewport may extend outside the data (e.g. when `initialZoom > 100`
  // adds empty padding). Read the actual data-anchored timestamps from
  // clamped indices, then linearly extrapolate to whatever the viewport's
  // startIdx/endIdx point to using the mean bar interval.
  const clampedStart = Math.max(0, Math.min(n - 1, viewport.startIdx));
  const clampedEnd = Math.max(0, Math.min(n - 1, viewport.endIdx));
  const tStartData = times[clampedStart];
  const tEndData = times[clampedEnd];
  if (tStartData === undefined || tEndData === undefined) return [];
  const dataSpan = Math.max(1, clampedEnd - clampedStart);
  const meanBarMs = n > 1 ? (times[n - 1]! - times[0]!) / (n - 1) : (tEndData - tStartData) / dataSpan || 1;
  const tStart = tStartData + (viewport.startIdx - clampedStart) * meanBarMs;
  const tEnd = tEndData + (viewport.endIdx - clampedEnd) * meanBarMs;
  if (tEnd <= tStart) return [];
  const totalMs = tEnd - tStart;
  const targetCount = Math.max(3, Math.floor(width / 100));
  const span = viewport.endIdx - viewport.startIdx + 1;

  const idxFromTime = (t: number): number => {
    if (t <= tStart) return viewport.startIdx;
    if (t >= tEnd) return viewport.endIdx;
    // Data-anchored region uses actual per-bar timestamps; padded regions
    // (outside [clampedStart, clampedEnd]) fall back to linear extrapolation.
    if (t <= tStartData) {
      return clampedStart - (tStartData - t) / meanBarMs;
    }
    if (t >= tEndData) {
      return clampedEnd + (t - tEndData) / meanBarMs;
    }
    let lo = clampedStart;
    let hi = clampedEnd;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid]! < t) lo = mid + 1;
      else hi = mid;
    }
    if (lo > clampedStart) {
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
    const nTicks = Math.max(2, Math.min(targetCount, span));
    const out: { t: number; x: number; stepMs: number }[] = [];
    const avgBarMs = totalMs / Math.max(1, span - 1);
    const stepMs = avgBarMs * (span / nTicks);
    for (let k = 0; k < nTicks; k++) {
      const idx = viewport.startIdx + Math.round((k + 0.5) * (span / nTicks) - 0.5);
      // Clamp to viewport for x-positioning but derive `t` from data-bounded
      // indices + extrapolation, so ticks in padded regions still get labels.
      const dataIdx = Math.max(0, Math.min(n - 1, idx));
      const tBase = times[dataIdx];
      if (tBase === undefined) continue;
      const t = tBase + (idx - dataIdx) * meanBarMs;
      const x = ((idx - viewport.startIdx + 0.5) / span) * width;
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
  timeFormatter?: (t: number) => string,
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
    const label = timeFormatter
      ? timeFormatter(t)
      : formatTimeLabel(t, showDate, spansYears, stepMs);
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

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Compact elapsed-duration formatter — used by the `'duration'` preset.
 *
 * Treats the ms value as an elapsed duration since t=0 (not a wall-clock
 * timestamp) and produces short, tick-friendly labels:
 *
 *   0                    → "0"
 *   3 600 000            → "1h"
 *   86 400 000           → "1d"
 *   30 * 86 400 000      → "1M"
 *   90 * 86 400 000      → "3M"
 *   365 * 86 400 000     → "1Y"
 *   365d + 90d           → "1Y 3M"
 *
 * Approximations follow the same calendar buckets the axis step ladder uses
 * (1 month ≈ 30d, 1 year ≈ 365d), so ticks land on clean labels when the
 * synthetic time axis is built via `alignByDuration` with daily bars. */
export function formatDurationLabel(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const sign = ms < 0 ? '-' : '';
  let s = Math.round(Math.abs(ms) / 1000);
  if (s === 0) return '0';
  const Y = 365 * 24 * 3600;
  const M = 30 * 24 * 3600;
  const D = 24 * 3600;
  const H = 3600;
  const MIN = 60;
  const y = Math.floor(s / Y); s -= y * Y;
  const mo = Math.floor(s / M); s -= mo * M;
  const d = Math.floor(s / D); s -= d * D;
  const h = Math.floor(s / H); s -= h * H;
  const mi = Math.floor(s / MIN); s -= mi * MIN;
  const parts: string[] = [];
  if (y) parts.push(`${y}Y`);
  if (mo) parts.push(`${mo}M`);
  if (parts.length < 2 && d) parts.push(`${d}d`);
  if (parts.length < 2 && h) parts.push(`${h}h`);
  if (parts.length < 2 && mi) parts.push(`${mi}m`);
  if (parts.length < 2 && s) parts.push(`${s}s`);
  return sign + (parts.slice(0, 2).join(' ') || '0');
}

/**
 * Resolve a user-supplied `timeFormat` option (format string or callback) into
 * a plain `(t: number) => string` function. Returns `undefined` when the input
 * is nullish so callers can fall through to the built-in formatter.
 *
 * Two special preset strings are recognised:
 *
 *   - `'duration'`  — format ms values as elapsed durations (`"6M"`, `"1Y 3M"`,
 *                     `"12d"`). Use together with `alignByDuration` when
 *                     overlaying series that don't share a wall-clock date.
 *
 * Any other string is parsed as a token template — see the docstring on
 * `ChartOptions.timeFormat`.
 */
export function resolveTimeFormatter(
  fmt: string | ((t: number) => string) | undefined,
): ((t: number) => string) | undefined {
  if (fmt == null) return undefined;
  if (typeof fmt === 'function') return fmt;
  if (fmt === 'duration') return formatDurationLabel;

  // Format-string implementation. Supported tokens:
  //   YYYY  full year          YY  2-digit year
  //   MM    zero-padded month  MMM short month name
  //   DD    zero-padded day
  //   HH    zero-padded hour   mm  zero-padded minute
  return (t: number) => {
    const d = new Date(t);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return fmt
      .replace('YYYY', String(d.getUTCFullYear()))
      .replace('YY', String(d.getUTCFullYear()).slice(-2))
      .replace('MMM', MONTH_SHORT[d.getUTCMonth()]!)
      .replace('MM', pad2(d.getUTCMonth() + 1))
      .replace('DD', pad2(d.getUTCDate()))
      .replace('HH', pad2(d.getUTCHours()))
      .replace('mm', pad2(d.getUTCMinutes()));
  };
}
