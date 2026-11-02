import { describe, expect, it } from 'vitest';
import { validateCanvasSpec, type ChartCanvasSpec } from './canvas';
import { decodeSpec, encodeSpec } from './index';

const canvas = (): ChartCanvasSpec => ({
  version: 1, kind: 'canvas', title: 'Symbols',
  charts: {
    BTC: { version: 1, panels: [{ id: 'h', kind: 'histogram', weight: 1, values: [1, 2] }] },
    ETH: { version: 1, panels: [{ id: 'h', kind: 'histogram', weight: 1, values: [2, 3] }] },
  },
});

describe('Chart canvas contract', () => {
  it.each(['dropdown', 'tabs', 'multiselect', 'checkboxes'] as const)('supports %s in both layouts', type => {
    for (const layout of ['single', 'grid'] as const) {
      const spec = { ...canvas(), layout, selector: { type, label: 'Symbol' }, selected: ['ETH'] };
      expect(validateCanvasSpec(spec)).toEqual({ ok: true, errors: [] });
    }
  });
  it('accepts an empty grid selection and optional sizes', () => {
    expect(validateCanvasSpec({ ...canvas(), layout: 'grid', selected: [], columns: 2, chartHeight: 720, layoutToggle: false }).ok).toBe(true);
  });
  it.each([
    { charts: {} }, { title: '' }, { columns: 0 }, { chartHeight: 1.5 },
    { layout: 'invalid' }, { selector: { type: 'unknown' } }, { selected: ['missing'] },
    { selected: ['BTC', 'BTC'] }, { layoutToggle: 'yes' }, { extra: true },
    { charts: { bad: { version: 2, panels: [] } } },
  ])('rejects malformed canvases %o', change => {
    expect(validateCanvasSpec({ ...canvas(), ...change }).ok).toBe(false);
  });
  it('roundtrips through the URL codec', () => {
    const spec = canvas();
    expect(decodeSpec(encodeSpec(spec))).toEqual(spec);
  });
});
