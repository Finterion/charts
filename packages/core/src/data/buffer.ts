import type { OHLC, OHLCBuffer } from '../types';

export function createBuffer(bars: OHLC[]): OHLCBuffer {
  const n = bars.length;
  const buf: OHLCBuffer = {
    length: n,
    time: new Float64Array(n),
    open: new Float32Array(n),
    high: new Float32Array(n),
    low: new Float32Array(n),
    close: new Float32Array(n),
    volume: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    const b = bars[i]!;
    buf.time[i] = b.time;
    buf.open[i] = b.open;
    buf.high[i] = b.high;
    buf.low[i] = b.low;
    buf.close[i] = b.close;
    buf.volume[i] = b.volume ?? 0;
  }
  return buf;
}

export function appendBar(buf: OHLCBuffer, bar: OHLC): OHLCBuffer {
  const n = buf.length + 1;
  const next: OHLCBuffer = {
    length: n,
    time: new Float64Array(n),
    open: new Float32Array(n),
    high: new Float32Array(n),
    low: new Float32Array(n),
    close: new Float32Array(n),
    volume: new Float32Array(n),
  };
  next.time.set(buf.time);
  next.open.set(buf.open);
  next.high.set(buf.high);
  next.low.set(buf.low);
  next.close.set(buf.close);
  next.volume.set(buf.volume);
  next.time[buf.length] = bar.time;
  next.open[buf.length] = bar.open;
  next.high[buf.length] = bar.high;
  next.low[buf.length] = bar.low;
  next.close[buf.length] = bar.close;
  next.volume[buf.length] = bar.volume ?? 0;
  return next;
}

/** Binary search for the bar nearest to a given time. */
export function indexAtTime(buf: OHLCBuffer, time: number): number {
  let lo = 0;
  let hi = buf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (buf.time[mid]! < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ───────────────────────────────────────────────────────────────────────────
// alignByDuration — overlay curves that don't share the same wall-clock dates
// ───────────────────────────────────────────────────────────────────────────

/** A single input curve for {@link alignByDuration}. */
export interface DurationSeriesInput {
  /** Per-sample values. */
  values: ArrayLike<number>;
  /**
   * Optional per-sample timestamps in ms. Only used to *infer* the bar
   * spacing when `barIntervalMs` is not supplied (the median gap of the
   * longest curve wins). Values are still placed sample-by-sample at
   * indices [0, values.length) on the synthetic axis — this helper does
   * NOT resample onto a target frequency.
   */
  times?: ArrayLike<number>;
}

/** Options for {@link alignByDuration}. */
export interface AlignByDurationOptions {
  /**
   * Spacing between successive samples in ms. When omitted, inferred from
   * the median gap of the longest curve that has a `times` array, else
   * defaults to `86_400_000` (one day). All curves are assumed to share
   * this spacing — the helper does not resample.
   */
  barIntervalMs?: number;
  /** Value used to right-pad shorter curves. Default: `NaN` (renders as a gap). */
  padValue?: number;
}

/** Result returned by {@link alignByDuration}. */
export interface AlignByDurationResult {
  /**
   * Synthetic time axis in ms starting at 0. Length equals the longest
   * input curve. Feed this straight into a `OHLC[]` (with `time` = these
   * values) or a `Float64Array` if you build the buffer manually.
   */
  time: Float64Array;
  /**
   * Per-curve resampled/padded arrays in the same order as the input.
   * Each is a `Float32Array` of length `time.length`.
   */
  values: Float32Array[];
  /** Resolved bar interval (user-supplied or inferred). */
  barIntervalMs: number;
}

/**
 * Right-pad a set of curves onto a common synthetic time axis measured in
 * elapsed ms since t=0 — so overlays line up by *duration* rather than by
 * wall-clock date.
 *
 * Typical use: overlaying equity curves from backtests that started on
 * different dates. Each curve is placed starting at index 0 on the shared
 * axis; shorter curves are padded with `NaN` on the right so the renderer
 * draws them as ending early instead of stretching them.
 *
 * All input curves are assumed to share the same sample spacing (typically
 * daily). No resampling is performed — mixed frequencies must be
 * downsampled by the caller before passing in.
 *
 * Combine with `timeFormat: 'duration'` on the chart to display axis
 * labels like `"6M"` / `"1Y 3M"` instead of fake calendar dates.
 *
 * @example
 * const { time, values } = alignByDuration([
 *   { values: algoA.equity, times: algoA.timestamps }, // 504 daily bars starting 2020-01
 *   { values: algoB.equity, times: algoB.timestamps }, // 320 daily bars starting 2022-09
 * ]);
 *
 * const bars = Array.from(time, (t) => ({ time: t, open: 1, high: 1, low: 1, close: 1 }));
 * <Chart data={bars} timeFormat="duration" panels={[{
 *   kind: 'indicator', id: 'eq', weight: 1,
 *   indicator: { values: values[0], kind: 'line', color: '#0969da', label: 'Algo A' },
 *   overlays:  [{ values: values[1], kind: 'line', color: '#8250df', label: 'Algo B' }],
 * }]} />
 */
export function alignByDuration(
  curves: readonly DurationSeriesInput[],
  options: AlignByDurationOptions = {},
): AlignByDurationResult {
  const padValue = options.padValue ?? NaN;

  if (curves.length === 0) {
    return { time: new Float64Array(0), values: [], barIntervalMs: options.barIntervalMs ?? 86_400_000 };
  }

  // Longest curve determines the synthetic axis length.
  let n = 0;
  let longest = -1;
  for (let i = 0; i < curves.length; i++) {
    const len = curves[i]!.values.length;
    if (len > n) { n = len; longest = i; }
  }

  // Resolve bar spacing.
  let barIntervalMs = options.barIntervalMs;
  if (barIntervalMs === undefined || !Number.isFinite(barIntervalMs) || barIntervalMs <= 0) {
    barIntervalMs = inferBarSpacing(curves, longest) ?? 86_400_000;
  }

  // Synthetic axis: 0, bar, 2*bar, ...
  const time = new Float64Array(n);
  for (let i = 0; i < n; i++) time[i] = i * barIntervalMs;

  // Copy + right-pad each curve to length n.
  const values: Float32Array[] = new Array(curves.length);
  for (let c = 0; c < curves.length; c++) {
    const src = curves[c]!.values;
    const out = new Float32Array(n);
    const len = src.length;
    for (let i = 0; i < len; i++) out[i] = src[i]!;
    if (len < n) out.fill(padValue, len, n);
    values[c] = out;
  }

  return { time, values, barIntervalMs };
}

/** Median inter-sample gap of the first curve (starting with `preferredIdx`)
 *  that has a `times` array with at least 2 entries. Returns `undefined` if
 *  none has usable timestamps. */
function inferBarSpacing(curves: readonly DurationSeriesInput[], preferredIdx: number): number | undefined {
  const order: number[] = [];
  if (preferredIdx >= 0) order.push(preferredIdx);
  for (let i = 0; i < curves.length; i++) if (i !== preferredIdx) order.push(i);
  for (const i of order) {
    const t = curves[i]!.times;
    if (!t || t.length < 2) continue;
    const gaps: number[] = new Array(t.length - 1);
    for (let j = 1; j < t.length; j++) gaps[j - 1] = t[j]! - t[j - 1]!;
    gaps.sort((a, b) => a - b);
    const mid = gaps.length >> 1;
    const med = gaps.length % 2 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2;
    if (Number.isFinite(med) && med > 0) return med;
  }
  return undefined;
}
