import { describe, expect, it } from 'vitest';
import { compileSpec, validateSpec, CHART_SPEC_SCHEMA, type ChartSpec } from './index';

function spec(): ChartSpec {
  return {
    version: 1,
    data: {
      bars: { time: [1], open: [1], high: [1], low: [1], close: [1] },
      decisions: [{
        id: 'evaluation', time: 1, panelId: 'z', value: -2, action: 'none',
        card: { title: 'Evaluation', status: 'future_status', groups: [] },
      }],
    },
    panels: [{
      id: 'z', weight: 1, kind: 'indicator',
      indicator: { values: [-2], kind: 'line', color: '#fff' },
    }],
  };
}

describe('JSON decision contract', () => {
  it.each(['scale_in', 'scale_out', 'stop_loss', 'take_profit'] as const)('preserves %s classifications', signalType => {
    const input = spec();
    Object.assign(input.data!.decisions![0]!, { signalType, eventType: 'trigger' });
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).decisions![0]).toMatchObject({ signalType, eventType: 'trigger' });
    const malformed = structuredClone(input);
    Object.assign(malformed.data!.decisions![0]!, { eventType: 'typo' });
    expect(validateSpec(malformed).ok).toBe(false);
  });

  it('compiles sparse line sampling without filling missing values', () => {
    const input = spec();
    const panel = input.panels[0]!;
    if (panel.kind !== 'indicator') throw new Error('Expected indicator fixture');
    input.data!.columns = { sampled: [1] };
    panel.indicator.sampleMask = { column: 'sampled' };
    expect(compileSpec(input).panels[0]!.indicator!.sampleMask).toEqual(new Float32Array([1]));
    for (const mask of [[0, 1], [null], [2]]) {
      panel.indicator.sampleMask = mask;
      expect(() => compileSpec(input)).toThrow('sampleMask requires');
    }
    panel.indicator.sampleMask = [1];
    panel.indicator.kind = 'area';
    expect(() => compileSpec(input)).toThrow('sampleMask requires');
  });
  it('round-trips inspector attributes and validates all optional fields', () => {
    const input = spec();
    const card = input.data!.decisions![0]!.card;
    Object.assign(card, {
      reason: null, strength: .4, position: 'Long - 1 open entries / limit 3',
      reasonDescription: 'Entry blocked by a recorded cooldown.',
      qualification: 'All group thresholds',
    });
    card.groups = [{
      id: 'primary', title: 'Primary', minimumScore: 1, minimumMatches: 1,
      aggregation: 'max', rules: [{
        id: 'r', label: 'Rule', weight: -2, points: 0, required: true,
      }],
    }];
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).decisions![0]!.card).toEqual(card);
    card.strength = 1.1;
    expect(validateSpec(input).ok).toBe(false);
    card.strength = .4;
    card.groups[0]!.minimumMatches = .5;
    expect(validateSpec(input).ok).toBe(false);
    card.groups[0]!.minimumMatches = 1;
    card.groups[0]!.rules[0]!.required = 'yes' as never;
    expect(validateSpec(input).ok).toBe(false);
  });
  it('preserves recorded card and group scoring capacity and rejects invalid maxima', () => {
    const input = spec();
    const card = input.data!.decisions![0]!.card;
    card.score = 3;
    card.maximumScore = 4;
    card.groups = [{
      id: 'primary', title: 'Primary', score: 3, maximumScore: 3, rules: [],
    }, {
      id: 'secondary', title: 'Secondary', score: 0, maximumScore: 1, rules: [],
    }];
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).decisions![0]!.card).toEqual(card);
    card.maximumScore = -1;
    expect(validateSpec(input).ok).toBe(false);
    card.maximumScore = 4;
    card.groups[0]!.maximumScore = Infinity;
    expect(validateSpec(input).ok).toBe(false);
  });
  it('retains optional per-rule points capacity for visual evidence sections', () => {
    const input = spec();
    input.data!.decisions![0]!.card.groups = [{
      id: 'secondary', title: 'Secondary', rules: [{
        id: 'rsi', label: 'RSI', matched: false, value: 80, points: 0, maximumPoints: 2,
      }],
    }];
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).decisions![0]!.card.groups[0]!.rules[0]!.maximumPoints).toBe(2);
    input.data!.decisions![0]!.card.groups[0]!.rules[0]!.maximumPoints = -2;
    expect(validateSpec(input).ok).toBe(false);
  });
  it('preserves the hover-value opt-out independently of series visibility', () => {
    const input = spec();
    input.panels[0]!.overlays = [{
      values: [-2], kind: 'line', color: '#fff', label: 'Threshold',
      showHoverValue: false,
    }];
    expect(validateSpec(input).ok).toBe(true);
    const overlay = compileSpec(input).panels[0]!.overlays![0]!;
    expect(overlay.showHoverValue).toBe(false);
    expect(overlay.hidden).toBeUndefined();
  });
  it('compiles the scrollable chart height separately from the inspector height', () => {
    const input = spec();
    input.display = { chartMinHeight: 1600 };
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).options.chartMinHeight).toBe(1600);
    input.display.chartMinHeight = -1;
    expect(validateSpec(input).ok).toBe(false);
  });
  it('compiles decisions into the core options and React/embed routing output', () => {
    const input = spec();
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).decisions).toEqual(input.data!.decisions);
    expect(compileSpec(input).options.decisions).toEqual(input.data!.decisions);
    expect(CHART_SPEC_SCHEMA.properties.data.properties.decisions.items.$ref).toBe('#/$defs/decision');
  });
  it('rejects malformed decisions before rendering', () => {
    const input = spec();
    input.data!.decisions![0]!.card.groups = null as never;
    input.data!.decisions![0]!.panelId = 'missing';
    expect(validateSpec(input).errors.join(' ')).toMatch(/groups/);
    expect(() => compileSpec(input)).toThrow(/panelId/);
  });
  it('retains explicit group outcomes independent of mixed rule results', () => {
    const input = spec();
    input.data!.decisions![0]!.card.groups = [{
      id: 'primary', title: 'Any primary', matched: true,
      rules: [{ id: 'a', label: 'Primary', matched: true }, { id: 'b', label: 'Alternative', matched: false }],
    }];
    expect(validateSpec(input).ok).toBe(true);
    expect(compileSpec(input).decisions![0]!.card.groups[0]!.matched).toBe(true);
  });
});
