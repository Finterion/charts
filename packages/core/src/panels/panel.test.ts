import { afterEach, describe, expect, it, vi } from 'vitest';
import { finterionDark } from '../themes';
import { Panel } from './panel';

class LegendElement {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: LegendElement[] = [];
  textContent = '';
  append(...children: LegendElement[]) { this.children.push(...children); }
  replaceChildren(...children: LegendElement[]) { this.children = children; }
}

describe('Panel collapse controls', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['overlay', 'external'] as const)('collapses multi-series panels without changing series visibility in %s legends', placement => {
    vi.stubGlobal('document', { createElement: () => new LegendElement() });
    const { value } = panel();
    value.legendEl = new LegendElement() as unknown as HTMLDivElement;
    value.collapseEl = new LegendElement() as unknown as HTMLDivElement;
    value.hooks = { canCollapse: () => true, onCollapseToggle: vi.fn(), requestRedraw: vi.fn() };
    value.legendControls = [];
    const toggle = vi.spyOn(value, 'makeCollapseToggle' as never).mockImplementation(() => new LegendElement() as never);
    vi.spyOn(value, 'makeLegendRow' as never).mockImplementation(() => new LegendElement() as never);
    value.syncLegend(finterionDark, 'auto', undefined, placement);
    expect(toggle).toHaveBeenCalledOnce();
    const legend = value.legendEl as unknown as LegendElement;
    expect(value.collapseEl.style.position).toBe(placement === 'overlay' ? 'absolute' : 'static');
    expect((value.collapseEl as unknown as LegendElement).children).toHaveLength(1);
    value['togglePaneCollapsed']();
    value.syncLegend(finterionDark, 'auto', undefined, placement);
    expect(value.collapsed).toBe(true);
    expect(value.hooks.onCollapseToggle).toHaveBeenLastCalledWith('z', true);
    expect(legend.children).toHaveLength(0);
    expect(value.spec.indicator!.hidden).toBeUndefined();
    expect(value.spec.overlays![1]!.hidden).toBe(true);
    value['togglePaneCollapsed']();
    value.syncLegend(finterionDark, 'auto', undefined, placement);
    expect(value.collapsed).toBe(false);
    expect(legend.children.length).toBeGreaterThan(1);
  });

  describe('Panel manual Y ranges', () => {
    it('preserves a box-selected range through viewport changes and supports further Y scaling', () => {
      const { value } = panel();
      value.manualYRange = [-3, -1];
      value.yScale = 1;
      value.computeRange(null, { startIdx: 0, endIdx: 2 });
      expect([value.yMin, value.yMax]).toEqual([-3, -1]);
      value.yScale = 0.5;
      value.computeRange(null, { startIdx: 1, endIdx: 2 });
      expect([value.yMin, value.yMax]).toEqual([-2.5, -1.5]);
      value.manualYRange = null;
      value.yScale = 1;
      value.computeRange(null, { startIdx: 0, endIdx: 1 });
      expect(value.yMin).toBeCloseTo(-2.35);
      expect(value.yMax).toBeCloseTo(1.85);
    });
  });

  it('keeps the collapse control available with legends disabled and never collapses the main panel', () => {
    const { value } = panel();
    value.legendEl = new LegendElement() as unknown as HTMLDivElement;
    value.collapseEl = new LegendElement() as unknown as HTMLDivElement;
    value.legendControls = [];
    value.hooks = { canCollapse: () => true };
    const toggle = vi.spyOn(value, 'makeCollapseToggle' as never).mockImplementation(() => new LegendElement() as never);
    value.syncLegend(finterionDark, false, undefined);
    expect(toggle).toHaveBeenCalledOnce();
    expect(value.legendEl.style.display).toBe('flex');
    value.hooks.canCollapse = () => false;
    value.syncLegend(finterionDark, false, undefined);
    expect(value.legendEl.style.display).toBe('none');
    expect(value.collapseEl.style.display).toBe('none');
  });

  it('draws only the title when collapsed, without Y-axis labels or grid', () => {
    const { value, ctx } = panel();
    value.collapsed = true;
    value.height = 28;
    ctx.clearRect = vi.fn();
    value.drawBase(finterionDark, { startIdx: 0, endIdx: 2 });
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1000, 28);
    expect(ctx.fillText.mock.calls.map(c => c[0])).toEqual(['Z-SCORE (2H)']);
  });
});

function panel() {
  const value = Object.create(Panel.prototype) as Panel;
  value.spec = {
    id: 'z', kind: 'indicator', weight: 1, title: 'Z-score (2h)',
    indicator: { values: new Float32Array([-2, 1.5, NaN]), kind: 'line', color: '#22c55e', label: 'Long Z' },
    overlays: [
      { values: new Float32Array([3, -1, Infinity]), kind: 'line', color: '#a3e635', label: 'Short Z' },
      { values: new Float32Array([99]), kind: 'line', color: '#fff', label: 'Hidden', hidden: true },
      { values: new Float32Array([-2, -2, -2]), kind: 'line', color: '#fff', label: 'Threshold', showHoverValue: false },
    ],
  };
  value.width = 1000;
  value.el = { getBoundingClientRect: () => ({ left: 0 }) } as HTMLDivElement;
  value.legendEl = {
    style: { display: 'flex', right: '60px' },
    getBoundingClientRect: () => ({ left: 850, right: 940, width: 90 }),
  } as unknown as HTMLDivElement;
  const ctx = {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    fillText: vi.fn(), fillStyle: '', font: '', textAlign: '', textBaseline: '',
  };
  value.overlayCtx = ctx as unknown as CanvasRenderingContext2D;
  value.baseCtx = ctx as unknown as CanvasRenderingContext2D;
  return { value, ctx };
}

describe('Panel sparse indicator autoscaling', () => {
  function sampledPanel() {
    const { value } = panel();
    value.manualYRange = null;
    value.yScale = 1;
    value.spec.indicator = {
      kind: 'line', color: '#fff',
      values: new Float32Array([10, NaN, 20]), sampleMask: new Float32Array([1, 0, 1]),
    };
    value.spec.overlays = [];
    return value;
  }

  it('includes surrounding observations when zoomed between sparse samples', () => {
    const value = sampledPanel();
    value.computeRange(null, { startIdx: 1, endIdx: 1 });
    expect([value.yMin, value.yMax]).toEqual([9, 21]);
  });

  it('keeps reference levels visible when autoscaling a narrow Z-score range', () => {
    const value = sampledPanel();
    delete value.spec.indicator!.sampleMask;
    value.spec.indicator!.values = new Float32Array([-0.5, 0, 0.5]);
    value.spec.indicator!.refLines = [-2, 0, 2];
    value.computeRange(null, { startIdx: 1, endIdx: 1 });
    expect([value.yMin, value.yMax]).toEqual([-2.4, 2.4]);
    value.spec.indicator!.values = new Float32Array([-3, 0, 4]);
    value.computeRange(null, { startIdx: 0, endIdx: 2 });
    expect(value.yMin).toBeCloseTo(-3.7);
    expect(value.yMax).toBeCloseTo(4.7);
  });

  it('includes visible sparse overlays even when the primary series has a recorded gap', () => {
    const value = sampledPanel();
    value.spec.indicator!.values.fill(NaN);
    value.spec.overlays = [{ kind: 'line', color: '#fff', values: new Float32Array([100, NaN, 100]),
      sampleMask: new Float32Array([1, 0, 1]) }];
    value.computeRange(null, { startIdx: 1, endIdx: 1 });
    expect(value.yMin).toBeLessThan(100);
    expect(value.yMax).toBeGreaterThan(100);
    expect(value.yMin).toBeGreaterThan(0);
    value.spec.overlays[0]!.hidden = true;
    value.computeRange(null, { startIdx: 1, endIdx: 1 });
    expect([value.yMin, value.yMax]).toEqual([-0.1, 1.1]);
  });

  it('preserves explicit and manual ranges', () => {
    const value = sampledPanel();
    value.spec.indicator!.refLines = [-100, 100];
    value.spec.indicator!.yRange = [0, 50];
    value.computeRange(null, { startIdx: 1, endIdx: 1 });
    expect([value.yMin, value.yMax]).toEqual([0, 50]);
    value.manualYRange = [20, 40];
    value.computeRange(null, { startIdx: 1, endIdx: 1 });
    expect([value.yMin, value.yMax]).toEqual([20, 40]);
  });
});

describe('Panel hovered indicator values', () => {
  it('shows raw outputs, including unplotted classifications, without losing precision or filling gaps', () => {
    const { value } = panel();
    const output = { style: {}, textContent: '', setAttribute: vi.fn(), tabIndex: -1 };
    value.outputsEl = output as unknown as HTMLDivElement;
    value.collapseEl = { style: { display: 'none' } } as HTMLDivElement;
    value.spec.outputs = [
      { id: 'raw', label: 'SuperTrend', values: new Float64Array([12345.123456789, NaN]) },
      { id: 'trend', label: 'Trend classification', values: new Float64Array([0, NaN]) },
    ];
    value.spec.kind = 'price';
    value.syncPinnedOutputs(finterionDark, 0, '2026-01-01T00:00:00.000Z');
    expect(output.textContent).toBe('2026-01-01T00:00:00.000Z  |  SuperTrend: 12345.123456789  |  Trend classification: 0');
    expect(output.style).toHaveProperty('cssText', expect.stringContaining('overflow-x:auto'));
    expect(output.setAttribute).toHaveBeenCalledWith('aria-label', 'Pinned outputs for Z-score (2h)');
    value.syncPinnedOutputs(finterionDark, 1, 'next');
    expect(output.textContent).toBe('next  |  SuperTrend: n/a  |  Trend classification: n/a');
    value.syncPinnedOutputs(finterionDark, -1, '');
    expect(output.style).toHaveProperty('display', 'none');
  });

  it('falls back to plotted outputs including hidden series and both band bounds', () => {
    const { value } = panel();
    const output = { style: {}, textContent: '', setAttribute: vi.fn() };
    value.outputsEl = output as unknown as HTMLDivElement;
    value.collapseEl = { style: { display: 'none' } } as HTMLDivElement;
    value.spec.overlays![0]!.lowerValues = new Float32Array([1]);
    value.syncPinnedOutputs(finterionDark, 0, 'time');
    expect(output.textContent).toContain('Short Z (lower): 1');
    expect(output.textContent).toContain('Hidden: 99');
    expect(output.textContent).not.toContain('Threshold');
    value.collapsed = true;
    value.syncPinnedOutputs(finterionDark, 0, 'time');
    expect(output.style).toHaveProperty('display', 'none');
  });

  it('labels the completed source candle separately from the clicked timestamp and retains missing metadata', () => {
    const { value } = panel();
    const output = { style: {}, textContent: '', setAttribute: vi.fn() };
    value.outputsEl = output as unknown as HTMLDivElement;
    value.collapseEl = { style: { display: 'none' } } as HTMLDivElement;
    value.spec.outputSourceTime = new Float64Array([Date.parse('2020-03-09'), NaN]);
    value.spec.outputAvailableAt = new Float64Array([Date.parse('2020-03-10'), NaN]);
    value.syncPinnedOutputs(finterionDark, 0, '2020-03-10T19:00:00.000Z');
    expect(output.textContent).toContain('2020-03-10T19:00:00.000Z  |  source candle: 2020-03-09T00:00:00.000Z');
    expect(output.textContent).toContain('available after: 2020-03-10T00:00:00.000Z');
    value.syncPinnedOutputs(finterionDark, 1, 'next');
    expect(output.textContent).toContain('source candle: n/a  |  available after: n/a');
  });

  it('draws crosshair lines without a floating OHLC tooltip', () => {
    const { value, ctx } = panel();
    value.height = 200;
    value.headerHeight = 20;
    const overlay = {
      ...ctx, clearRect: vi.fn(), translate: vi.fn(), setLineDash: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    };
    value.overlayCtx = overlay as unknown as CanvasRenderingContext2D;
    value.drawOverlay(finterionDark, { startIdx: 0, endIdx: 2 }, { idx: 1, y: 100 });
    expect(overlay.lineTo).toHaveBeenCalledWith(500, 180);
    expect(overlay.lineTo).toHaveBeenCalledWith(1000, 80);
    expect(overlay.fillText).not.toHaveBeenCalled();
  });
  it('shows only the number beside a titled single-series panel, excluding thresholds', () => {
    const { value, ctx } = panel();
    value.spec.overlays![0]!.hidden = true;
    value.drawHoverValues(finterionDark, 0);
    expect(ctx.fillText.mock.calls.map(c => c[0])).toEqual(['-2.0000']);
    ctx.fillText.mockClear();
    value.drawHoverValues(finterionDark, 2);
    expect(ctx.fillText.mock.calls.map(c => c[0])).toEqual(['n/a']);
  });
  it('shows every visible series at the shared cursor index, beside the title', () => {
    const { value, ctx } = panel();
    value.drawHoverValues(finterionDark, 0);
    expect(ctx.fillText.mock.calls.map(c => c[0])).toEqual(['Long Z: -2.0000', 'Short Z: 3.0000']);
    expect(ctx.fillText.mock.calls[0]!.slice(1)).toEqual([104, 8]);
    expect(ctx.rect).toHaveBeenCalledWith(104, 8, 738, 15);
    ctx.fillText.mockClear();
    value.drawHoverValues(finterionDark, 1);
    expect(ctx.fillText.mock.calls.map(c => c[0])).toEqual(['Long Z: 1.5000', 'Short Z: -1.0000']);
    value.drawHoverValues(finterionDark, -1);
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });

  it('does not invent values for warmup gaps, nonfinite data or out-of-range bars', () => {
    const { value, ctx } = panel();
    for (const index of [2, 20]) {
      ctx.fillText.mockClear();
      value.drawHoverValues(finterionDark, index);
      expect(ctx.fillText.mock.calls.map(c => c[0])).toEqual(['Long Z: n/a', 'Short Z: n/a']);
    }
  });

  it('respects title styling and avoids the inline eye control', () => {
    const { value, ctx } = panel();
    value.legendEl.style.right = '';
    value.legendEl.getBoundingClientRect = () => ({ left: 100, right: 130, width: 30 } as DOMRect);
    value.drawHoverValues(finterionDark, 0, { fontSize: 14, paddingTop: 4, paddingLeft: 10 });
    expect(ctx.fillText.mock.calls[0]!.slice(1)).toEqual([138, 4]);
    expect(ctx.font).toContain('14px');
  });

  it('starts at the header edge with an external legend and skips collapsed or non-time panels', () => {
    const { value, ctx } = panel();
    value.drawHoverValues(finterionDark, 0, {}, true);
    expect(ctx.fillText.mock.calls[0]!.slice(1)).toEqual([8, 8]);
    ctx.fillText.mockClear();
    value.collapsed = true;
    value.drawHoverValues(finterionDark, 0);
    value.collapsed = false;
    value.spec.kind = 'scatter';
    value.drawHoverValues(finterionDark, 0);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
