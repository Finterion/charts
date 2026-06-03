/**
 * Off-main-thread indicator pipeline. Falls back to sync compute when
 * Workers aren't available (SSR, very old browsers).
 */

type Job = 'ema' | 'rsi' | 'drawdown';
type Resolver = (v: Float32Array) => void;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Resolver>();

function workerBody() {
  const ema = (close: Float32Array, period: number) => {
    const n = close.length;
    const out = new Float32Array(n);
    if (!n) return out;
    const k = 2 / (period + 1);
    out[0] = close[0]!;
    for (let i = 1; i < n; i++) out[i] = close[i]! * k + out[i - 1]! * (1 - k);
    return out;
  };
  const rsi = (close: Float32Array, period: number) => {
    const n = close.length;
    const out = new Float32Array(n);
    if (n < 2) return out;
    let g = 0, l = 0;
    for (let i = 1; i <= period && i < n; i++) {
      const d = close[i]! - close[i - 1]!;
      if (d >= 0) g += d; else l -= d;
    }
    g /= period; l /= period;
    out[period] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = period + 1; i < n; i++) {
      const d = close[i]! - close[i - 1]!;
      const gn = d > 0 ? d : 0;
      const ls = d < 0 ? -d : 0;
      g = (g * (period - 1) + gn) / period;
      l = (l * (period - 1) + ls) / period;
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  };
  const drawdown = (close: Float32Array) => {
    const n = close.length;
    const out = new Float32Array(n);
    if (!n) return out;
    let peak = close[0]!;
    for (let i = 0; i < n; i++) {
      const c = close[i]!;
      if (c > peak) peak = c;
      out[i] = peak === 0 ? 0 : ((c - peak) / peak) * 100;
    }
    return out;
  };
  (self as unknown as Worker).onmessage = (e: MessageEvent) => {
    const { id, job, close, period } = e.data as { id: number; job: string; close: Float32Array; period: number };
    let result: Float32Array;
    if (job === 'ema') result = ema(close, period);
    else if (job === 'rsi') result = rsi(close, period);
    else result = drawdown(close);
    (self as unknown as Worker).postMessage({ id, result }, [result.buffer]);
  };
}

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return null;
  try {
    const src = `(${workerBody.toString()})()`;
    const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    worker = new Worker(url);
    worker.onmessage = (e: MessageEvent) => {
      const { id, result } = e.data as { id: number; result: Float32Array };
      const r = pending.get(id);
      if (r) { pending.delete(id); r(result); }
    };
    return worker;
  } catch {
    return null;
  }
}

function run(job: Job, close: Float32Array, period: number): Promise<Float32Array> {
  const w = ensureWorker();
  if (!w) {
    // Sync fallback — use the main-thread implementations.
    return import('./indicators').then(({ ema, rsi, drawdown }) => {
      const fakeBuf = { length: close.length, time: new Float64Array(0), open: close, high: close, low: close, close, volume: new Float32Array(0) };
      if (job === 'ema') return ema(fakeBuf, period);
      if (job === 'rsi') return rsi(fakeBuf, period);
      return drawdown(fakeBuf);
    });
  }
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    // Copy so we don't transfer the user's array.
    const copy = new Float32Array(close);
    w.postMessage({ id, job, close: copy, period }, [copy.buffer]);
  });
}

export const workerIndicators = {
  ema: (close: Float32Array, period: number) => run('ema', close, period),
  rsi: (close: Float32Array, period = 14) => run('rsi', close, period),
  drawdown: (close: Float32Array) => run('drawdown', close, 0),
};
