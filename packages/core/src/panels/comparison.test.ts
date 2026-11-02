import { describe, expect, it } from 'vitest';
import { createBuffer } from '../data/buffer';
import { comparisonChange, comparisonIndices, comparisonRows } from './comparison';

const buf = createBuffer([10, 20, 30].map((time, i) => ({
  time, open: 100 + i, high: 110 + i, low: 90 + i, close: 105 + i, volume: 1000 + i,
})));

describe('point comparison', () => {
  it('resolves exact timestamps in selection order, not nearest bars', () => {
    expect(comparisonIndices(buf, [30, 10, 25, 40])).toEqual([2, 0, -1, -1]);
    expect(comparisonIndices(null, [10])).toEqual([-1]);
    expect(comparisonIndices(createBuffer([]), [10])).toEqual([-1]);
  });

  it('keeps timestamps anchored when the buffer shifts or appends', () => {
    const shifted = createBuffer([20, 30, 40].map(time => ({
      time, open: 1, high: 1, low: 1, close: 1,
    })));
    expect(comparisonIndices(shifted, [30, 10, 20])).toEqual([1, -1, 0]);
  });

  it('includes OHLCV, overlays and both band bounds, including hidden series', () => {
    const rows = comparisonRows({
      id: 'price', kind: 'price', weight: 1,
      overlays: [{
        label: 'Channel', kind: 'band', color: 'blue', hidden: true,
        values: new Float32Array([120, NaN, 122]), lowerValues: new Float32Array([80, 81, 82]),
      }],
    }, buf, [2, 0, 1, -1]);
    expect(rows.map(row => row.label)).toEqual([
      'Open', 'High', 'Low', 'Close', 'Volume', 'Channel (hidden) upper', 'Channel (hidden) lower',
    ]);
    expect(rows[3]!.values).toEqual([107, 105, 106, null]);
    expect(rows[4]!.values).toEqual([1002, 1000, 1001, null]);
    expect(rows[5]!.values).toEqual([122, 120, null, null]);
    expect(rows[6]!.values).toEqual([82, 80, 81, null]);
  });

  it('includes indicator and overlay values with stable fallback names and explicit missing values', () => {
    expect(comparisonRows({
      id: 'indicator', kind: 'indicator', weight: 1,
      indicator: { id: 'RSI', kind: 'line', color: 'red', values: new Float32Array([0, Infinity]) },
      overlays: [{ kind: 'line', color: 'blue', values: new Float32Array([10]) }],
    }, buf, [0, 1, 2])).toEqual([
      { label: 'RSI', values: [0, null, null] },
      { label: 'Overlay 1', values: [10, null, null] },
    ]);
  });

  it.each([
    [120, 100, { absolute: 20, percent: 20 }],
    [-5, -10, { absolute: 5, percent: 50 }],
    [5, 0, { absolute: 5, percent: null }],
    [0, 0, { absolute: 0, percent: null }],
    [0, 10, { absolute: -10, percent: -100 }],
    [null, 10, null],
    [10, null, null],
  ])('computes changes for value %s and baseline %s', (value, baseline, expected) => {
    expect(comparisonChange(value, baseline)).toEqual(expected);
  });
});
