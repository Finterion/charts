import { describe, expect, it } from 'vitest';
import { compileSpec, CHART_SPEC_SCHEMA, type ChartSpec } from './index';

describe('pinned indicator outputs', () => {
  const spec: ChartSpec = {
    version: 1,
    data: {
      bars: { time: [1, 2], open: [1, 1], high: [1, 1], low: [1, 1], close: [1, 1] },
      columns: { raw: [12345.123456789, null] },
    },
    panels: [{
      id: 'trend', kind: 'price', weight: 1,
      outputs: [
        { id: 'value', label: 'SuperTrend', values: { column: 'raw' } },
        { id: 'trend', label: 'Trend classification', values: [0, null] },
      ],
    }],
  };

  it('compiles column and inline outputs at full precision with missing values', () => {
    const outputs = compileSpec(spec).panels[0]!.outputs!;
    expect(outputs[0]!.values).toBeInstanceOf(Float64Array);
    expect(outputs[0]!.values[0]).toBe(12345.123456789);
    expect(outputs[1]!.values[0]).toBe(0);
    expect(Number.isNaN(outputs[0]!.values[1])).toBe(true);
    expect(Number.isNaN(outputs[1]!.values[1])).toBe(true);
    expect(CHART_SPEC_SCHEMA.$defs.panelBase.properties).toHaveProperty('outputs');
  });

  it('rejects unknown output columns explicitly', () => {
    const input = structuredClone(spec);
    input.panels[0]!.outputs![0]!.values = { column: 'missing' };
    expect(() => compileSpec(input)).toThrow('Unknown output column reference');
  });

  it('preserves millisecond source timestamps and genuine metadata gaps from inline and column references', () => {
    const input = structuredClone(spec);
    input.data!.columns!.source = [Date.parse('2020-03-09'), null];
    input.panels[0]!.outputSourceTime = { column: 'source' };
    input.panels[0]!.outputAvailableAt = [Date.parse('2020-03-10'), null];
    const panel = compileSpec(input).panels[0]!;
    expect(panel.outputSourceTime![0]).toBe(Date.parse('2020-03-09'));
    expect(panel.outputAvailableAt![0]).toBe(Date.parse('2020-03-10'));
    expect(Number.isNaN(panel.outputSourceTime![1])).toBe(true);
    expect(Number.isNaN(panel.outputAvailableAt![1])).toBe(true);
    expect(CHART_SPEC_SCHEMA.$defs.panelBase.properties).toHaveProperty('outputSourceTime');
    expect(CHART_SPEC_SCHEMA.$defs.panelBase.properties).toHaveProperty('outputAvailableAt');
  });
});
