import { describe, it, expect } from 'vitest';
import { alignByDuration } from './buffer';

describe('alignByDuration', () => {
  it('returns an empty result for zero curves', () => {
    const out = alignByDuration([]);
    expect(out.time.length).toBe(0);
    expect(out.values).toEqual([]);
    expect(out.barIntervalMs).toBe(86_400_000);
  });

  it('uses the longest curve to size the synthetic axis', () => {
    const out = alignByDuration(
      [
        { values: [1, 2, 3] },
        { values: [1, 2, 3, 4, 5] },
        { values: [1, 2] },
      ],
      { barIntervalMs: 1000 },
    );
    expect(out.time.length).toBe(5);
    expect(Array.from(out.time)).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(out.barIntervalMs).toBe(1000);
  });

  it('right-pads shorter curves with NaN (default padValue)', () => {
    const out = alignByDuration(
      [{ values: [1, 2, 3, 4] }, { values: [10, 20] }],
      { barIntervalMs: 1000 },
    );
    const [a, b] = out.values;
    expect(Array.from(a!)).toEqual([1, 2, 3, 4]);
    expect(b![0]).toBe(10);
    expect(b![1]).toBe(20);
    expect(Number.isNaN(b![2])).toBe(true);
    expect(Number.isNaN(b![3])).toBe(true);
  });

  it('honors an explicit padValue', () => {
    const out = alignByDuration(
      [{ values: [1, 2, 3] }, { values: [7] }],
      { barIntervalMs: 1, padValue: 0 },
    );
    expect(Array.from(out.values[1]!)).toEqual([7, 0, 0]);
  });

  it('infers bar spacing from the longest curves times when barIntervalMs is omitted', () => {
    // curve A: 3 samples at 500ms apart
    // curve B: 5 samples at 1000ms apart  ← longest, wins
    const out = alignByDuration([
      { values: [1, 2, 3], times: [0, 500, 1000] },
      { values: [1, 2, 3, 4, 5], times: [0, 1000, 2000, 3000, 4000] },
    ]);
    expect(out.barIntervalMs).toBe(1000);
    expect(Array.from(out.time)).toEqual([0, 1000, 2000, 3000, 4000]);
  });

  it('falls back to 1 day (86_400_000 ms) when no curve has usable timestamps', () => {
    const out = alignByDuration([{ values: [1, 2, 3] }, { values: [4, 5] }]);
    expect(out.barIntervalMs).toBe(86_400_000);
    expect(out.time[1]).toBe(86_400_000);
  });

  it('accepts a Float32Array as input values', () => {
    const src = new Float32Array([1.5, 2.5, 3.5]);
    const out = alignByDuration([{ values: src }], { barIntervalMs: 1 });
    expect(out.values[0]).toBeInstanceOf(Float32Array);
    expect(Array.from(out.values[0]!)).toEqual([1.5, 2.5, 3.5]);
  });

  it('preserves input curve order', () => {
    const out = alignByDuration(
      [
        { values: [1] },
        { values: [1, 2, 3] }, // longest, but still index 1
        { values: [1, 2] },
      ],
      { barIntervalMs: 1 },
    );
    expect(out.values.length).toBe(3);
    expect(out.values[0]![0]).toBe(1);
    expect(out.values[1]![2]).toBe(3);
    expect(out.values[2]![1]).toBe(2);
  });
});
