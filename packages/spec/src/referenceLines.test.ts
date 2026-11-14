import { describe, expect, it } from 'vitest';
import { compileSpec, CHART_SPEC_SCHEMA, type ChartSpec } from './index';

function spec(): ChartSpec {
  return {
    version: 1,
    data: { bars: { time: [1, 2, 3], open: [1, 1, 1], high: [1, 1, 1], low: [1, 1, 1], close: [1, 1, 1] } },
    panels: [{
      id: 'z', kind: 'indicator', weight: 1,
      indicator: {
        values: [-2, null, 2], kind: 'line', color: '#fff',
        refLines: [-2, 0, 2], refLineColors: ['#16a34a', '#64748b', '#dc2626'],
      },
    }],
  };
}

describe('reference line colors', () => {
  it('compiles colors and preserves missing indicator values', () => {
    const series = compileSpec(spec()).panels[0]!.indicator!;
    expect(series.refLineColors).toEqual(['#16a34a', '#64748b', '#dc2626']);
    expect(series.refLines).toEqual([-2, 0, 2]);
    expect(Number.isNaN(series.values[1])).toBe(true);
    expect(CHART_SPEC_SCHEMA.$defs.indicatorSeries.properties).toHaveProperty('refLineColors');
  });

  it('rejects missing thresholds and mismatched or empty colors', () => {
    const input = spec();
    const panel = input.panels[0]!;
    if (panel.kind !== 'indicator') throw new Error('Expected indicator fixture');
    const series = panel.indicator;
    for (const colors of [['#fff'], ['#fff', '', '#fff']]) {
      series.refLineColors = colors;
      expect(() => compileSpec(input)).toThrow('one color per reference line');
    }
    series.refLineColors = ['#fff', '#fff', '#fff'];
    delete series.refLines;
    expect(() => compileSpec(input)).toThrow('one color per reference line');
  });
});
