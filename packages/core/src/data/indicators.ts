import type { OHLCBuffer } from '../types';

export function ema(buf: OHLCBuffer, period: number): Float32Array {
  const n = buf.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  const k = 2 / (period + 1);
  out[0] = buf.close[0]!;
  for (let i = 1; i < n; i++) {
    out[i] = buf.close[i]! * k + out[i - 1]! * (1 - k);
  }
  return out;
}

export function rsi(buf: OHLCBuffer, period = 14): Float32Array {
  const n = buf.length;
  const out = new Float32Array(n);
  if (n < 2) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period && i < n; i++) {
    const d = buf.close[i]! - buf.close[i - 1]!;
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < n; i++) {
    const d = buf.close[i]! - buf.close[i - 1]!;
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function drawdown(buf: OHLCBuffer): Float32Array {
  const n = buf.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  let peak = buf.close[0]!;
  for (let i = 0; i < n; i++) {
    const c = buf.close[i]!;
    if (c > peak) peak = c;
    out[i] = peak === 0 ? 0 : ((c - peak) / peak) * 100;
  }
  return out;
}
