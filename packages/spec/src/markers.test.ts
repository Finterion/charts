import { describe, expect, it } from 'vitest';
import { compileSpec, validateSpec } from './index';
import type { ChartSpec } from './index';

function spec(): ChartSpec {
  return {
    version: 1,
    data: {
      bars: { time: [1], open: [1], high: [1], low: [1], close: [1] },
      markers: [{ time: 1, side: 'buy', price: -2, panelId: 'z_score', shape: 'circle' }],
    },
    panels: [{
      id: 'z_score', kind: 'indicator', weight: 1,
      indicator: { values: [-2], kind: 'line', color: '#fff' },
    }],
  };
}

describe('panel-targeted markers', () => {
  it.each(['plus', 'minus'] as const)('preserves %s scale symbols', shape => {
    const input = spec();
    input.data!.markers![0]!.shape = shape;
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).markers![0]!.shape).toBe(shape);
  });

  it.each([true, false])('preserves explicit pane collapse eligibility (%s)', collapsible => {
    const input = spec();
    input.panels[0]!.collapsible = collapsible;
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).panels[0]!.collapsible).toBe(collapsible);
    expect(validateSpec({
      ...input, panels: [{ ...input.panels[0], collapsible: 'yes' }],
    }).ok).toBe(false);
  });

  it('validates and compiles without losing marker fields', () => {
    const input = spec();
    expect(validateSpec(input)).toEqual({ ok: true, errors: [] });
    expect(compileSpec(input).markers).toEqual(input.data!.markers);
  });

  it('rejects missing and non-time panel targets', () => {
    const input = spec();
    input.data!.markers![0]!.panelId = 'missing';
    expect(validateSpec(input).ok).toBe(false);
    input.panels = [{ id: 'missing', kind: 'scatter', weight: 1, points: [{ x: 1, y: 1 }] }];
    expect(validateSpec(input).ok).toBe(false);
  });

  it('rejects unsupported shapes', () => {
    const input = spec();
    const marker = { ...input.data!.markers![0], shape: 'triangle' };
    expect(validateSpec({ ...input, data: { ...input.data, markers: [marker] } }).ok).toBe(false);
  });
});
