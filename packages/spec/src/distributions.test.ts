import { describe, expect, it } from 'vitest';
import { compileSpec, getChartCapabilities, validateSpec, type ChartSpec } from './index';

describe('distribution specs', () => {
  it('compiles self-contained panels with colors, labels and formatting', () => {
    const spec: ChartSpec = {
      version: 1,
      panels: [
        { id: 'assets', kind: 'donut', weight: 1, categories: ['BTC', 'ETH'], values: [3, 1],
          colors: ['#f7931a', '#627eea'], innerRadius: 0.6, centerLabel: 'TRADES', showTotal: true, format: 'fixed0' },
        { id: 'returns', kind: 'boxplot', weight: 1, categories: ['Vector', 'Event'],
          values: [[0.1, -0.2], [0.3]], colors: ['#f7931a', '#627eea'], showPoints: true, format: 'pct1' },
      ],
    };
    const compiled = compileSpec(spec);
    expect(compiled.panels[0]!.donut).toMatchObject({
      values: [3, 1], colors: ['#f7931a', '#627eea'], innerRadius: 0.6, centerLabel: 'TRADES', showTotal: true,
    });
    expect(compiled.panels[0]!.donut!.format!(4)).toBe('4');
    expect(compiled.panels[1]!.boxplot!.format!(0.1)).toBe('10.0%');
    expect(compiled.panels[1]!.boxplot!.showPoints).toBe(true);
    expect(getChartCapabilities().panelKinds).toEqual(expect.arrayContaining(['donut', 'boxplot']));
  });

  it('accepts empty and singleton distributions without time data', () => {
    for (const panel of [
      { kind: 'donut', categories: [], values: [] },
      { kind: 'donut', categories: ['BTC'], values: [0] },
      { kind: 'boxplot', categories: ['empty', 'one'], values: [[], [1]] },
    ]) {
      expect(validateSpec({ version: 1, panels: [{ id: 'test', weight: 1, ...panel }] }).ok).toBe(true);
    }
  });

  it('rejects malformed values, mismatched categories and invalid options', () => {
    for (const panel of [
      { kind: 'donut', categories: ['BTC'], values: [-1] },
      { kind: 'donut', categories: ['BTC'], values: [NaN] },
      { kind: 'donut', categories: ['BTC', 'ETH'], values: [Number.MAX_VALUE, Number.MAX_VALUE] },
      { kind: 'boxplot', categories: ['BTC'], values: [[Infinity]] },
      { kind: 'boxplot', categories: ['BTC'], values: [1] },
      { kind: 'boxplot', categories: ['BTC'], values: [] },
      { kind: 'donut', categories: ['BTC'], values: [1], innerRadius: 0 },
      { kind: 'donut', categories: ['BTC'], values: [1], colors: [] },
      { kind: 'boxplot', categories: ['BTC'], values: [[1]], showPoints: 'yes' },
      { kind: 'donut', categories: ['BTC'], values: [1], format: 'toString' },
    ]) {
      const result = validateSpec({ version: 1, panels: [{ id: 'test', weight: 1, ...panel }] });
      expect(result.ok, JSON.stringify(panel)).toBe(false);
      expect(result.errors.some(error => error.startsWith('panels[0].'))).toBe(true);
    }
  });
});
