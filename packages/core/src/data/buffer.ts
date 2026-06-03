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
