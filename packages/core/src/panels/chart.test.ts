import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBuffer } from '../data/buffer';
import { attachPanZoom } from '../interactions/panZoom';
import { xCenter } from '../renderers/layout';
import type { Viewport } from '../types';
import { Panel } from './panel';
import { Chart } from './chart';
import { DecisionIndex } from './decisions';
import type { DecisionAnnotation } from '../types';

vi.mock('../interactions/panZoom', () => ({
  attachPanZoom: vi.fn(() => () => {}),
}));

function element(width: number, top = 20, height = 400): HTMLDivElement {
  const el: Pick<HTMLDivElement, 'getBoundingClientRect' | 'addEventListener' | 'style'> = {
    getBoundingClientRect: () => ({
      x: 100, y: top, left: 100, top, right: 100 + width,
      bottom: top + height, width, height, toJSON: () => ({}),
    }),
    addEventListener: vi.fn(),
    style: {} as CSSStyleDeclaration,
  };
  return el as HTMLDivElement;
}

function chartForHover(width: number, viewport: Viewport): Chart {
  // Exercise real event handlers without constructing canvases in Node.
  const chart = Object.create(Chart.prototype) as Chart;
  chart['panelsContainer'] = element(width);
  chart['eventSurface'] = element(width - 56);
  chart['panels'] = ['z', 'lower'].map((id, i) => ({
    width, height: 200, headerHeight: 20, yMin: -4, yMax: 0,
    yScale: 1, manualYRange: null,
    spec: { id, kind: 'indicator', weight: 1 }, el: element(width, 20 + i * 200, 200),
  } as Panel));
  chart['interactive'] = true;
  chart['buf'] = createBuffer(Array.from({ length: 1000 }, (_, time) => ({
    time, open: 1, high: 1, low: 1, close: 1,
  })));
  chart['viewport'] = viewport;
  chart['comparisonTimes'] = [];
  chart['markDirty'] = vi.fn();
  return chart;
}

describe('Chart pointer coordinates', () => {
  function interactiveChart() {
    const chart = chartForHover(1000, { startIdx: 100, endIdx: 299 });
    chart['rightAxis'] = element(56);
    chart['bottomAxis'] = element(1000);
    chart['attachAxisDrag'] = vi.fn();
    chart['initialYScale'] = 2;
    chart['attachEvents']();
    const fire = (type: string, event: Partial<WheelEvent>) => {
      const calls = vi.mocked(chart['rightAxis'].addEventListener).mock.calls;
      const listener = calls.find(([name]) => name === type)![1] as EventListener;
      const value = { clientX: 1070, clientY: 100, deltaY: -100, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...event };
      listener(value as WheelEvent);
      return value;
    };
    return { chart, fire };
  }

  it('zooms only the hovered Y-axis without a modifier and blocks plot/page wheel handling', () => {
    const { chart, fire } = interactiveChart();
    const event = fire('wheel', {});
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(chart['panels'].map(panel => panel.yScale)).toEqual([0.85, 1]);
    expect(chart.getViewport()).toEqual({ startIdx: 100, endIdx: 299 });
    expect(chart['initialYScale']).toBeNull();
    fire('wheel', { clientY: 300, deltaY: 100 });
    expect(chart['panels'].map(panel => panel.yScale)).toEqual([0.85, 1.18]);
    expect(chart['markDirty']).toHaveBeenCalledWith('base', 'series', 'overlay');
  });

  it('ignores axis headers, gaps, collapsed/non-time panels and horizontal-only scroll', () => {
    const { chart, fire } = interactiveChart();
    expect(fire('wheel', { clientY: 30 }).preventDefault).not.toHaveBeenCalled();
    expect(fire('wheel', { deltaY: 0 }).preventDefault).not.toHaveBeenCalled();
    chart['panels'][0]!.collapsed = true;
    expect(fire('wheel', {}).preventDefault).not.toHaveBeenCalled();
    chart['panels'][1]!.spec.kind = 'heatmap';
    expect(fire('wheel', { clientY: 300 }).preventDefault).not.toHaveBeenCalled();
    expect(chart['panels'].map(panel => panel.yScale)).toEqual([1, 1]);
  });

  it('keeps Y zoom within its limits and double-click clears selected vertical ranges', () => {
    const { chart, fire } = interactiveChart();
    const panel = chart['panels'][0]!;
    panel.yScale = 0.05;
    fire('wheel', {});
    expect(panel.yScale).toBe(0.05);
    panel.yScale = 20;
    fire('wheel', { deltaY: 100 });
    expect(panel.yScale).toBe(20);
    panel.manualYRange = [-3, -2];
    fire('dblclick', {});
    expect(panel.yScale).toBe(1);
    expect(panel.manualYRange).toBeNull();
  });

  it('box-zooms only the starting panel and excludes its title, Y axis and Compare mode', () => {
    const { chart } = interactiveChart();
    const calls = vi.mocked(attachPanZoom).mock.calls;
    const options = calls[calls.length - 1]![1];
    const getRegion = options.getBoxZoomRegion!;
    expect(getRegion({ clientX: 300, clientY: 30 } as PointerEvent)).toBeNull();
    expect(getRegion({ clientX: 1070, clientY: 100 } as PointerEvent)).toBeNull();
    const region = getRegion({ clientX: 300, clientY: 100 } as PointerEvent)!;
    expect(region).toMatchObject({ left: 100, top: 40, width: 944, height: 180 });
    region.onZoom({ left: 200, top: 45, width: 300, height: 90 });
    expect(chart['panels'][0]!.manualYRange).toEqual([-3, -1]);
    expect(chart['panels'][0]!.yScale).toBe(1);
    expect(chart['panels'][1]!.manualYRange).toBeNull();
    chart['comparing'] = true;
    expect(getRegion({ clientX: 300, clientY: 100 } as PointerEvent)).toBeNull();
  });

  it('preserves manual Y zoom when matching panels are rebuilt', () => {
    const chart = chartForHover(1000, { startIdx: 100, endIdx: 299 });
    chart['initialYScale'] = null;
    const panel = chart['panels'][0]!;
    panel.spec.collapsible = true;
    panel.collapsed = true;
    panel.yScale = 0.5;
    panel.manualYRange = [-3, -1];
    for (const value of chart['panels']) value.destroy = vi.fn();
    Object.assign(chart['panelsContainer'], { appendChild: vi.fn() });
    chart['placeTimeAxis'] = vi.fn();
    chart['attachLegends'] = vi.fn();
    chart['applyPanelGap'] = vi.fn();
    chart['applyTitleSpace'] = vi.fn();
    chart['applyCollapsedFlex'] = vi.fn();
    chart['applyTimeAxisVisibility'] = vi.fn();
    chart['renderComparison'] = vi.fn();
    chart['requestResize'] = vi.fn();
    vi.stubGlobal('document', {
      createElement: () => ({ style: {}, appendChild: vi.fn(), remove: vi.fn(), getContext: () => ({}) }),
    });
    try {
      chart.setPanels([panel.spec]);
      expect(chart['panels'][0]!.yScale).toBe(0.5);
      expect(chart['panels'][0]!.manualYRange).toEqual([-3, -1]);
      expect(chart['panels'][0]!.collapsed).toBe(true);
      chart.setPanels([{ id: 'new', kind: 'price', weight: 1 }]);
      expect(chart['panels'][0]!.manualYRange).toBeNull();
      expect(chart['panels'][0]!.yScale).toBe(1);
      expect(chart['panels'][0]!.collapsed).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lets an explicitly collapsible first panel collapse while preserving default eligibility', () => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    const first = chart['panels'][0]!;
    const second = chart['panels'][1]!;
    expect(chart['makePanelHooks'](0).canCollapse?.()).toBe(false);
    expect(chart['makePanelHooks'](1).canCollapse?.()).toBe(true);
    first.spec.collapsible = true;
    second.spec.collapsible = false;
    expect(chart['makePanelHooks'](0).canCollapse?.()).toBe(true);
    expect(chart['makePanelHooks'](1).canCollapse?.()).toBe(false);
    chart['applyTimeAxisVisibility'] = vi.fn();
    chart['requestResize'] = vi.fn();
    chart['onPaneCollapseChange'] = vi.fn();
    first.collapsed = true;
    chart['makePanelHooks'](0).onCollapseToggle?.(first.spec.id, true);
    expect(first.el.style.flex).toBe('0 0 28px');
    expect(chart['applyTimeAxisVisibility']).toHaveBeenCalledOnce();
    expect(chart['onPaneCollapseChange']).toHaveBeenLastCalledWith(first.spec.id, true);
    first.collapsed = false;
    chart['makePanelHooks'](0).onCollapseToggle?.(first.spec.id, false);
    expect(first.el.style.flex).toBe('1 1 0');
  });

  it.each([
    ['none', 'recorded', '#ffffff'],
    ['entry', 'recorded', '#22c55e'],
    ['none', 'not_triggered', '#94a3b8'],
    ['entry', 'rejected', '#f59e0b'],
  ] as const)('highlights the snapped %s dot on the overlay, respecting the panel header', (action, status, color) => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    const panel = chart['panels'][0]!;
    const ctx = {
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(), beginPath: vi.fn(),
      rect: vi.fn(), clip: vi.fn(), arc: vi.fn(), stroke: vi.fn(),
      strokeStyle: '', lineWidth: 0,
    };
    panel.overlayCtx = ctx as unknown as CanvasRenderingContext2D;
    panel.resize = vi.fn(() => false);
    panel.computeRange = vi.fn();
    panel.drawOverlay = vi.fn();
    panel.drawHoverValues = vi.fn();
    chart['panels'] = [panel];
    chart['resizeTimeAxis'] = vi.fn();
    chart['dirty'] = { base: false, series: false, overlay: true };
    chart['hoverDecision'] = {
      bar: 100, panel: 0,
      decision: {
        id: 'halo', time: 100, panelId: 'z', value: -2, action,
        card: { title: 'Highlighted point', status, groups: [] },
      },
    };
    chart['hoverIdx'] = 100;
    chart['draw']();
    expect(panel.drawHoverValues).toHaveBeenLastCalledWith(
      chart['effectiveTheme'], 100, chart['titleStyle'], true,
    );
    expect(ctx.translate).toHaveBeenCalledWith(0, 20);
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 1000, 180);
    expect(ctx.arc).toHaveBeenCalledWith(100.5, 90, 7, 0, Math.PI * 2);
    expect(ctx.strokeStyle).toBe(color);
    ctx.arc.mockClear();
    chart['hoverDecision'] = null;
    chart['selectedDecision'] = {
      bar: 100, panel: 0,
      decision: {
        id: 'selected', time: 100, panelId: 'z', value: -2, action,
        card: { title: 'Selected point', status: 'recorded', groups: [] },
      },
    };
    chart['dirty'].overlay = true;
    chart['draw']();
    expect(ctx.arc).toHaveBeenCalledWith(100.5, 90, 7, 0, Math.PI * 2);
    ctx.arc.mockClear();
    chart['selectedDecision'] = null;
    chart['dirty'].overlay = true;
    chart['draw']();
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  class ControlElement {
    style: Record<string, string> = {};
    attributes = new Map<string, string>();
    children: ControlElement[] = [];
    listeners = new Map<string, () => void | Promise<void>>();
    textContent = '';
    type = '';
    checked = false;
    disabled = false;
    open = false;
    id = '';
    getBoundingClientRect = () => ({ left: 0, right: 1000, top: 0, height: 600, bottom: 600 });
    focus = vi.fn();
    remove = vi.fn();
    requestFullscreen = vi.fn(async () => {});
    showModal = vi.fn(() => { this.open = true; });
    close = vi.fn(() => { this.open = false; this.listeners.get('close')?.(); });
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    addEventListener(name: string, listener: () => void | Promise<void>) { this.listeners.set(name, listener); }
    append(...children: ControlElement[]) { this.children.push(...children); }
    appendChild(child: ControlElement) { this.children.push(child); return child; }
    replaceChildren(...children: ControlElement[]) { this.children = children; }
    click() { return this.listeners.get('click')?.(); }
    dispatch(name: string, event: unknown) {
      const listener = this.listeners.get(name);
      if (listener) Reflect.apply(listener, this, [event]);
    }
  }

  describe('Chart display controls', () => {
    afterEach(() => vi.unstubAllGlobals());

    function controls() {
      const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
      const doc = {
        createElement: () => new ControlElement(),
        fullscreenElement: null as ControlElement | null, fullscreenEnabled: true,
        exitFullscreen: vi.fn(async () => {}),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
      };
      vi.stubGlobal('document', doc);
      vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 800 });
      const toolbar = new ControlElement();
      const frame = new ControlElement();
      chart['chartControls'] = toolbar as unknown as HTMLDivElement;
      chart['frame'] = frame as unknown as HTMLDivElement;
      chart['requestResize'] = vi.fn();
      chart['panels'].forEach((panel, index) => {
        panel.collapsed = false;
        panel.hooks = chart['makePanelHooks'](index);
        panel.legendEl = { dataset: {} } as HTMLDivElement;
        panel.setCollapsed = Panel.prototype.setCollapsed;
      });
      chart['hiddenDecisionTypes'] = new Set();
      chart['decisions'] = ([
        ['entry', 'long'], ['exit', 'long'], ['entry', 'short'], ['exit', 'short'], ['none', 'long'],
      ] as const).map(([action, direction], i) => ({
        id: String(i), time: 100, panelId: 'z', value: -2, action, direction,
        card: { title: `${action} ${direction}`, status: 'recorded', groups: [] },
      }));
      const setDecisions = vi.fn();
      chart['decisionInspector'] = { setDecisions } as never;
      chart['createChartControls']();
      chart['syncDecisionLegend']();
      return { chart, toolbar, frame, doc, setDecisions };
    }

    it('filters scaling and protective phases independently across rendering and inspection', () => {
      const { chart, setDecisions } = controls();
      const source = chart['decisions'][0]!;
      chart['decisions'] = [
        { ...source, id: 'scale-in', signalType: 'scale_in' },
        { ...source, id: 'scale-out', action: 'exit', signalType: 'scale_out' },
        { ...source, id: 'sl-trigger', action: 'exit', signalType: 'stop_loss', eventType: 'trigger' },
        { ...source, id: 'sl-fill', action: 'exit', signalType: 'stop_loss', eventType: 'fill' },
      ];
      chart['syncDecisionLegend']();
      const legend = chart['panels'][0]!.legendControls;
      expect(legend.map(c => c.id)).toEqual(expect.arrayContaining([
        'decision:scale_in:long', 'decision:scale_out:long',
        'decision:stop_loss:long:trigger', 'decision:stop_loss:long:fill',
      ]));
      legend.find(c => c.id === 'decision:stop_loss:long:trigger')!.onToggle();
      expect(chart['decisionIndex'].nearest(100).map(d => d.id)).toEqual(['scale-in', 'scale-out', 'sl-fill']);
      expect(setDecisions).toHaveBeenLastCalledWith(chart['decisions'].filter(d => d.id !== 'sl-trigger'));
    });

    it('filters each decision type consistently from rendering, hit testing and inspector choices', async () => {
      const { chart, toolbar, setDecisions } = controls();
      expect(toolbar.children.map(c => c.attributes.get('aria-label'))).toEqual([
        'X axis placement', 'Compare points', 'Panel visibility', 'Enter fullscreen', 'Hide toolbar',
      ]);
      expect(toolbar.children.map(c => c.attributes.get('aria-pressed'))).toEqual([undefined, 'false', undefined, 'false', undefined]);
      for (let i = 0; i < 5; i++) {
        chart['panels'][0]!.legendControls[i]!.onToggle();
        chart['syncDecisionLegend']();
        expect(chart['panels'][0]!.legendControls[i]!.hidden).toBe(true);
        expect(chart['decisionIndex'].nearest(100)).toEqual(chart['decisions'].slice(i + 1));
        expect(setDecisions).toHaveBeenLastCalledWith(chart['decisions'].slice(i + 1));
      }
      expect(chart['decisionIndex'].hitTest({
        width: 1000, height: 180, viewport: chart.getViewport(), yMin: -4, yMax: 0,
      }, 'z', 100.5, 90)).toBeNull();
      expect(chart['hoverDecision']).toBeNull();
      chart['panels'][0]!.legendControls[0]!.onToggle();
      expect(chart['decisionIndex'].nearest(100)).toEqual([chart['decisions'][0]]);
      chart['refreshDecisionIndex']();
      expect(chart['decisionIndex'].nearest(100)).toHaveLength(1);
    });

    it('previews panel choices without moving the axis, then applies the selected panel or bottom', async () => {
      const { chart, toolbar } = controls();
      const after = vi.fn();
      chart['panels'][1]!.el.after = after;
      chart['bottomAxis'] = element(1000);
      chart['rightAxis'] = element(56);
      const appendChild = vi.fn();
      chart['chartCol'] = { appendChild } as unknown as HTMLDivElement;
      chart['requestResize'] = vi.fn();
      await toolbar.children[0]!.click();
      const dialog = chart['timeAxisDialog'] as unknown as ControlElement;
      expect(dialog.open).toBe(true);
      expect(toolbar.children[0]!.attributes.get('aria-expanded')).toBe('true');
      expect(after).not.toHaveBeenCalled();
      const choices = dialog.children[2]!;
      expect(choices.children.map(c => c.children[1]!.textContent)).toEqual([
        'Bottom of chart', 'Below z', 'Below lower',
      ]);
      const lower = choices.children[2]!.children[0]!;
      lower.checked = true;
      lower.listeners.get('change')?.();
      await dialog.children[3]!.children[1]!.click();
      expect(after).toHaveBeenLastCalledWith(chart['bottomAxis']);
      expect(chart['bottomAxis'].style.zIndex).toBe('12');
      expect(chart['showTimeAxis']).toBe(true);
      expect(chart['timeAxisPanelId']).toBe('lower');
      expect(dialog.open).toBe(false);
      expect(toolbar.children[0]!.attributes.get('aria-expanded')).toBe('false');
      await toolbar.children[0]!.click();
      expect(dialog.children[2]!.children[2]!.children[0]!.checked).toBe(true);
      const bottom = dialog.children[2]!.children[0]!.children[0]!;
      bottom.checked = true;
      bottom.listeners.get('change')?.();
      await dialog.children[3]!.children[1]!.click();
      expect(appendChild).toHaveBeenLastCalledWith(chart['bottomAxis']);
      expect(chart['requestResize']).toHaveBeenCalledTimes(2);
    });

    it('cancels without changing placement and ignores non-time panels', async () => {
      const { chart, toolbar } = controls();
      chart['timeAxisPanelId'] = 'z';
      chart['panels'][1]!.spec.kind = 'hbar';
      await toolbar.children[0]!.click();
      const dialog = chart['timeAxisDialog'] as unknown as ControlElement;
      expect(dialog.children[2]!.children).toHaveLength(2);
      await dialog.children[3]!.children[0]!.click();
      expect(chart['timeAxisPanelId']).toBe('z');
      expect(toolbar.children[0]!.focus).toHaveBeenCalledOnce();
      await toolbar.children[0]!.click();
      const escape = { key: 'Escape', preventDefault: vi.fn() };
      dialog.dispatch('keydown', escape);
      expect(dialog.open).toBe(false);
      expect(escape.preventDefault).toHaveBeenCalledOnce();
      expect(chart['timeAxisPanelId']).toBe('z');
    });

    it('returns to bottom if the selected panel is removed or no longer time-based', () => {
      const { chart } = controls();
      chart['bottomAxis'] = element(1000);
      const appendChild = vi.fn();
      chart['chartCol'] = { appendChild } as unknown as HTMLDivElement;
      chart['timeAxisPanelId'] = 'missing';
      chart['placeTimeAxis']();
      expect(chart['timeAxisPanelId']).toBeNull();
      expect(appendChild).toHaveBeenLastCalledWith(chart['bottomAxis']);
    });

    it('shows readable hints on pointer hover and keyboard focus, including the collapsed toolbar button', () => {
      const { chart, toolbar } = controls();
      const tooltip = chart['toolTooltip'] as unknown as ControlElement;
      for (const button of [...toolbar.children, chart['showToolbarButton'] as unknown as ControlElement]) {
        expect(button.attributes.get('aria-description')).toBeTruthy();
        for (const [show, hide] of [['pointerenter', 'pointerleave'], ['focus', 'blur']]) {
          button.listeners.get(show!)?.();
          expect(tooltip.style.display).toBe('block');
          expect(tooltip.textContent).toBe(button.attributes.get('aria-description'));
          expect(button.attributes.get('aria-describedby')).toBe(tooltip.id);
          button.listeners.get(hide!)?.();
          expect(tooltip.style.display).toBe('none');
          expect(button.attributes.has('aria-describedby')).toBe(false);
        }
      }
    });

    it('hides and restores the toolbar without changing active tools or selected timestamps', async () => {
      const { chart, toolbar } = controls();
      chart['requestResize'] = vi.fn();
      chart['comparing'] = true;
      chart['timeAxisPanelId'] = 'lower';
      chart['comparisonTimes'] = [100, 200];
      const showButton = chart['showToolbarButton'] as unknown as ControlElement;
      await toolbar.children[4]!.click();
      expect(toolbar.style.display).toBe('none');
      expect(showButton.style.display).toBe('flex');
      expect(showButton.attributes.get('aria-expanded')).toBe('false');
      expect(showButton.focus).toHaveBeenCalledOnce();
      await showButton.click();
      expect(toolbar.style.display).toBe('flex');
      expect(showButton.style.display).toBe('none');
      expect(toolbar.children[4]!.attributes.get('aria-expanded')).toBe('true');
      expect(toolbar.children[0]!.focus).toHaveBeenCalledOnce();
      expect(chart['comparing']).toBe(true);
      expect(chart['timeAxisPanelId']).toBe('lower');
      expect(chart['comparisonTimes']).toEqual([100, 200]);
      expect(chart['requestResize']).toHaveBeenCalledTimes(2);
    });

    it('toggles comparison and restores the decision inspector without clearing points', async () => {
      const { chart, toolbar } = controls();
      chart['comparisonTimes'] = [100, 200];
      chart['decisionInspector'] = {
        container: new ControlElement(), el: new ControlElement(),
      } as never;
      chart['decisionInspector'].el.style.display = 'none';
      const render = vi.fn();
      chart['comparisonInspector'] = {
        el: new ControlElement() as unknown as HTMLDivElement, render,
      };
      chart['requestResize'] = vi.fn();
      await toolbar.children[1]!.click();
      expect(toolbar.children[1]!.attributes.get('aria-pressed')).toBe('true');
      expect(chart['decisionInspector'].container.style.display).toBe('none');
      expect(render).toHaveBeenLastCalledWith(expect.objectContaining({ times: [100, 200] }));
      await toolbar.children[1]!.click();
      expect(toolbar.children[1]!.attributes.get('aria-pressed')).toBe('false');
      expect(chart['comparisonInspector'].el.style.display).toBe('none');
      expect(chart['decisionInspector'].container.style.display).toBe('flex');
      expect(chart['decisionInspector'].el.style.display).toBe('none');
      expect(chart['comparisonTimes']).toEqual([100, 200]);
    });

    it('applies multiple panel choices using the same eye-toggle hooks and restores focus', async () => {
      const { chart, toolbar } = controls();
      chart['panels'][0]!.spec.collapsible = true;
      chart['applyTimeAxisVisibility'] = vi.fn();
      chart['onPaneCollapseChange'] = vi.fn();
      await toolbar.children[2]!.click();
      const dialog = chart['panelVisibilityDialog'] as unknown as ControlElement;
      expect(dialog.open).toBe(true);
      expect(toolbar.children[2]!.attributes.get('aria-expanded')).toBe('true');
      await dialog.children[2]!.children[1]!.click(); // Hide all (preview only).
      expect(chart['panels'].map(p => p.collapsed)).toEqual([false, false]);
      await dialog.children[4]!.children[1]!.click();
      expect(chart['panels'].map(p => p.collapsed)).toEqual([true, true]);
      expect(chart['onPaneCollapseChange']).toHaveBeenCalledTimes(2);
      expect(chart['panels'][0]!.el.style.flex).toBe('0 0 28px');
      expect(chart['markDirty']).toHaveBeenCalledWith('base', 'series');
      expect(dialog.open).toBe(false);
      expect(toolbar.children[2]!.focus).toHaveBeenCalledOnce();
      await toolbar.children[2]!.click();
      expect(dialog.children[3]!.children.map(row => row.children[0]!.checked)).toEqual([false, false]);
      await dialog.children[2]!.children[0]!.click(); // Show all.
      await dialog.children[4]!.children[1]!.click();
      expect(chart['panels'].map(p => p.collapsed)).toEqual([false, false]);
    });

    it('respects non-collapsible panels and cancels visibility changes with Cancel or Escape', async () => {
      const { chart, toolbar } = controls();
      await toolbar.children[2]!.click();
      const dialog = chart['panelVisibilityDialog'] as unknown as ControlElement;
      const choices = dialog.children[3]!;
      expect(choices.children[0]!.children[0]!.disabled).toBe(true);
      expect(choices.children[0]!.children[1]!.textContent).toContain('always visible');
      await dialog.children[2]!.children[1]!.click();
      expect(choices.children[0]!.children[0]!.checked).toBe(true);
      expect(choices.children[1]!.children[0]!.checked).toBe(false);
      await dialog.children[4]!.children[0]!.click();
      expect(chart['panels'].map(p => p.collapsed)).toEqual([false, false]);
      await toolbar.children[2]!.click();
      const escape = { key: 'Escape', preventDefault: vi.fn() };
      dialog.dispatch('keydown', escape);
      expect(dialog.open).toBe(false);
      expect(chart['panels'].map(p => p.collapsed)).toEqual([false, false]);
      expect(escape.preventDefault).toHaveBeenCalledOnce();
    });

    it('enters and exits browser fullscreen, including Escape synchronization and cleanup', async () => {
      const { chart, toolbar, frame, doc } = controls();
      await toolbar.children[3]!.click();
      expect(frame.requestFullscreen).toHaveBeenCalledOnce();
      doc.fullscreenElement = frame;
      const changed = doc.addEventListener.mock.calls.find(([name]) => name === 'fullscreenchange')![1];
      changed();
      expect(toolbar.children[3]!.attributes.get('aria-label')).toBe('Exit fullscreen');
      expect(toolbar.children[3]!.attributes.get('aria-pressed')).toBe('true');
      await toolbar.children[3]!.click();
      expect(doc.exitFullscreen).toHaveBeenCalledOnce();
      doc.fullscreenElement = null; // Browser Escape also dispatches fullscreenchange.
      changed();
      expect(toolbar.children[3]!.attributes.get('aria-label')).toBe('Enter fullscreen');
      expect(toolbar.children[3]!.attributes.get('aria-pressed')).toBe('false');
      expect(chart['requestResize']).toHaveBeenCalledTimes(2);
      chart['panels'].forEach(panel => { panel.destroy = vi.fn(); });
      chart.destroy();
      expect(doc.removeEventListener).toHaveBeenCalledWith('fullscreenchange', changed);
      expect(frame.remove).toHaveBeenCalledOnce();
    });

    it('reports unsupported or denied fullscreen without losing chart state', async () => {
      const { chart, toolbar, frame, doc } = controls();
      doc.fullscreenEnabled = false;
      await toolbar.children[3]!.click();
      const status = chart['fullscreenStatus'] as unknown as ControlElement;
      expect(status.style.display).toBe('block');
      expect(status.textContent).toContain('blocked by the notebook host');
      expect(frame.requestFullscreen).not.toHaveBeenCalled();
      doc.fullscreenEnabled = true;
      frame.requestFullscreen.mockRejectedValueOnce(new Error('Permission denied'));
      await toolbar.children[3]!.click();
      expect(status.textContent).toContain('Permission denied');
      expect(chart.getViewport()).toEqual({ startIdx: 0, endIdx: 999 });
      await toolbar.children[3]!.click();
      expect(status.style.display).toBe('none');
    });


    it('keeps panel coordinates correct when a time axis or gap separates panels', () => {
      const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
      chart['panels'][1]!.el = element(1000, 248, 200);
      expect(chart['panelTop'](1)).toBe(228);
      chart['onMove']({ clientX: 200, clientY: 260 } as PointerEvent);
      expect(chart['hoverPanel']).toBe(1);
    });

    it('retains shared X zoom when dragging the relocated axis', () => {
      const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
      const target = element(1000);
      target.setPointerCapture = vi.fn();
      target.releasePointerCapture = vi.fn();
      const listeners = new Map<string, (event: PointerEvent) => void>();
      target.addEventListener = vi.fn((name: string, handler: EventListenerOrEventListenerObject) => {
        listeners.set(name, handler as (event: PointerEvent) => void);
      }) as typeof target.addEventListener;
      chart['attachAxisDrag'](target, 'x');
      listeners.get('pointerdown')!({ clientX: 200, pointerId: 1 } as PointerEvent);
      listeners.get('pointermove')!({ clientX: 100, pointerId: 1 } as PointerEvent);
      expect(chart.getViewport()).toEqual({ startIdx: 393, endIdx: 999 });
      listeners.get('pointerup')!({ pointerId: 1 } as PointerEvent);
      expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    });
  });

  it('magnetically snaps both crosshair coordinates onto nearby decision dots', () => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    const decision: DecisionAnnotation = {
      id: 'snap', time: 100, panelId: 'z', value: -2, action: 'none',
      card: { title: 'Snap target', status: 'no_decision', groups: [] },
    };
    chart['decisions'] = [decision];
    chart['decisionIndex'] = new DecisionIndex([decision], chart['buf']);
    const show = vi.fn();
    chart['decisionInspector'] = { show } as never;
    chart['onMove']({ clientX: 208.5, clientY: 133 } as PointerEvent);
    expect(chart['hoverIdx']).toBe(100);
    expect(chart['hoverY']).toBe(110);
    expect(chart['hoverDecision']?.decision).toBe(decision);
    expect(chart['eventSurface'].style.cursor).toBe('pointer');
    expect(show).toHaveBeenLastCalledWith([decision]);
    chart['onMove']({ clientX: 214.5, clientY: 130 } as PointerEvent);
    expect(chart['hoverDecision']).toBeNull();
    expect(chart['eventSurface'].style.cursor).toBe('crosshair');
    expect(show).toHaveBeenLastCalledWith([]);
    chart['eventSurface'].style.cursor = 'grabbing';
    chart['onMove']({ clientX: 208.5, clientY: 133, buttons: 1 } as PointerEvent);
    expect(chart['hoverDecision']).toBeNull();
    expect(chart['eventSurface'].style.cursor).toBe('grabbing');
  });

  it.each([0, 200])('uses the actual panel bounds after scrolling %i pixels', scroll => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    chart['panelsContainer'] = element(1000, 20 - scroll);
    chart['panels'][0]!.el = element(1000, 20 - scroll, 200);
    chart['panels'][1]!.el = element(1000, 244 - scroll, 200);
    const decision: DecisionAnnotation = {
      id: 'lower', time: 100, panelId: 'lower', value: -2, action: 'entry',
      card: { title: 'Lower panel', status: 'approved', groups: [] },
    };
    chart['decisions'] = [decision];
    chart['decisionIndex'] = new DecisionIndex([decision], chart['buf']);
    chart['decisionInspector'] = { show: vi.fn() } as never;
    chart['onMove']({ clientX: 208.5, clientY: 357 - scroll } as PointerEvent);
    expect(chart['hoverDecision']?.decision).toBe(decision);
    expect(chart['hoverPanel']).toBe(1);
    expect(chart['hoverY'] - chart['panelTop'](1)).toBe(110);
  });
  it('updates the inspector at the hovered bar and shows no evaluation on gaps', () => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    const decision: DecisionAnnotation = {
      id: 'evaluation', time: 100, panelId: 'z', value: -2, action: 'none',
      card: { title: 'Evidence', status: 'no_decision', groups: [] },
    };
    chart['decisions'] = [decision];
    chart['decisionIndex'] = new DecisionIndex([decision], chart['buf']);
    const show = vi.fn();
    chart['decisionInspector'] = { show } as never;
    chart['onMove']({ clientX: 100 + xCenter(100, chart.getViewport(), 1000), clientY: 70 } as PointerEvent);
    expect(show).toHaveBeenLastCalledWith([decision]);
    chart['onMove']({ clientX: 100 + xCenter(101, chart.getViewport(), 1000), clientY: 70 } as PointerEvent);
    expect(show).toHaveBeenLastCalledWith([]);
  });

  it('pins only on clicks, not pointerdown or pan drags', () => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    chart['interactive'] = false;
    const clearSelection = vi.fn();
    chart['decisionInspector'] = { clearSelection } as never;
    chart['attachEvents']();
    const calls = vi.mocked(chart['eventSurface'].addEventListener).mock.calls;
    const fire = (type: string, x: number) => {
      for (const [event, listener] of calls) if (event === type) {
        (listener as (e: unknown) => void)({ clientX: x, clientY: 70 });
      }
    };
    fire('pointerdown', 150);
    expect(clearSelection).not.toHaveBeenCalled();
    fire('pointermove', 180);
    fire('click', 180);
    expect(clearSelection).not.toHaveBeenCalled();
    fire('pointerdown', 200);
    fire('click', 200);
    expect(clearSelection).toHaveBeenCalledOnce();
    fire('pointerdown', 200);
    fire('pointercancel', 200);
    fire('click', 200);
    expect(clearSelection).toHaveBeenCalledOnce();
  });

  it('selects multiple timestamps across panels and toggles duplicates without pinning decisions', () => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    chart['interactive'] = false;
    chart['comparing'] = true;
    chart['renderComparison'] = vi.fn();
    const select = vi.fn();
    chart['decisionInspector'] = { select } as never;
    chart['attachEvents']();
    const calls = vi.mocked(chart['eventSurface'].addEventListener).mock.calls;
    const fire = (type: string, x: number, y = 70) => {
      for (const [event, listener] of calls) if (event === type)
        (listener as (e: unknown) => void)({ clientX: x, clientY: y, buttons: 0 });
    };
    const click = (index: number, y: number) => {
      const x = 100 + xCenter(index, chart.getViewport(), 1000);
      fire('pointerdown', x, y);
      fire('click', x, y);
    };
    click(100, 70);
    click(200, 270);
    click(300, 70);
    expect(chart['comparisonTimes']).toEqual([100, 200, 300]);
    click(200, 70);
    expect(chart['comparisonTimes']).toEqual([100, 300]);
    click(100, 270);
    expect(chart['comparisonTimes']).toEqual([300]);
    expect(select).not.toHaveBeenCalled();
    fire('pointerdown', 400);
    fire('pointermove', 450);
    fire('click', 450);
    fire('pointerdown', 500);
    fire('pointercancel', 500);
    fire('click', 500);
    expect(chart['comparisonTimes']).toEqual([300]);
  });

  it('does not select padded bars, panel headers, gaps, collapsed or non-time panels', () => {
    const chart = chartForHover(1000, { startIdx: -100, endIdx: 1099 });
    chart['renderComparison'] = vi.fn();
    chart['toggleComparisonPoint']({ clientX: 101, clientY: 70 });
    chart['toggleComparisonPoint']({ clientX: 1090, clientY: 70 });
    chart['toggleComparisonPoint']({ clientX: 600, clientY: 25 });
    chart['panels'][1]!.el = element(1000, 248, 200);
    chart['toggleComparisonPoint']({ clientX: 600, clientY: 230 });
    chart['panels'][1]!.collapsed = true;
    chart['toggleComparisonPoint']({ clientX: 600, clientY: 300 });
    chart['panels'][1]!.collapsed = false;
    chart['panels'][1]!.spec.kind = 'scatter';
    chart['toggleComparisonPoint']({ clientX: 600, clientY: 300 });
    expect(chart['comparisonTimes']).toEqual([]);
  });

  it('keeps selected timestamps on data updates and discards only removed timestamps', () => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    chart['comparisonTimes'] = [30, 10, 20];
    chart['refreshDecisionIndex'] = vi.fn();
    chart['renderComparison'] = vi.fn();
    chart.setData(createBuffer([20, 30, 40].map(time => ({
      time, open: 1, high: 1, low: 1, close: 1,
    }))));
    expect(chart['comparisonTimes']).toEqual([30, 20]);
    expect(chart['renderComparison']).toHaveBeenCalled();
  });

  it('draws numbered selected-point guides across all time panels', () => {
    const chart = chartForHover(1000, { startIdx: 200, endIdx: 299 });
    chart['comparisonTimes'] = [250, 100];
    chart['comparing'] = true;
    chart['effectiveTheme'] = { accent: '#60a5fa' } as never;
    chart['resizeTimeAxis'] = vi.fn();
    chart['dirty'] = { base: false, series: false, overlay: true };
    const contexts = chart['panels'].map(panel => {
      const ctx = {
        save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(),
        beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
      };
      panel.overlayCtx = ctx as unknown as CanvasRenderingContext2D;
      panel.resize = vi.fn(() => false);
      panel.computeRange = vi.fn();
      panel.drawOverlay = vi.fn();
      panel.drawHoverValues = vi.fn();
      return ctx;
    });
    chart['draw']();
    for (const ctx of contexts) {
      expect(ctx.moveTo).toHaveBeenCalledTimes(1);
      expect(ctx.moveTo).toHaveBeenCalledWith(505, 20);
      expect(ctx.lineTo).toHaveBeenCalledTimes(1);
      expect(ctx.lineTo).toHaveBeenCalledWith(505, 200);
      expect(ctx.fillText).toHaveBeenCalledTimes(1);
      expect(ctx.fillText).toHaveBeenCalledWith('P1', 509, 24);
    }
  });

  it('keeps the clicked dot selected through hover and pointerleave, switches dots and clears on empty chart clicks', () => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    chart['interactive'] = false;
    const items: DecisionAnnotation[] = [100, 200].map(time => ({
      id: String(time), time, panelId: 'z', value: -2, action: 'entry',
      card: { title: String(time), status: 'recorded', groups: [] },
    }));
    chart['decisions'] = items;
    chart['decisionIndex'] = new DecisionIndex(items, chart['buf']);
    const select = vi.fn(), clearSelection = vi.fn();
    chart['decisionInspector'] = { show: vi.fn(), select, clearSelection } as never;
    chart['attachEvents']();
    const calls = vi.mocked(chart['eventSurface'].addEventListener).mock.calls;
    const fire = (type: string, x: number, y = 130) => {
      for (const [event, listener] of calls) if (event === type)
        (listener as (e: unknown) => void)({ clientX: x, clientY: y, buttons: 0 });
    };
    const click = (x: number) => {
      fire('pointerdown', x);
      fire('click', x);
    };
    click(200.5);
    expect(select).toHaveBeenLastCalledWith([items[0]], items[0]);
    expect(chart['selectedDecision']?.decision).toBe(items[0]);
    fire('pointermove', 300.5);
    expect(chart['hoverDecision']?.decision).toBe(items[1]);
    expect(chart['selectedDecision']?.decision).toBe(items[0]);
    fire('pointerleave', 800);
    expect(chart['hoverDecision']).toBeNull();
    expect(chart['selectedDecision']?.decision).toBe(items[0]);
    click(300.5);
    expect(chart['selectedDecision']?.decision).toBe(items[1]);
    click(300.5);
    expect(chart['selectedDecision']?.decision).toBe(items[1]);
    click(800);
    expect(chart['selectedDecision']).toBeNull();
    expect(clearSelection).toHaveBeenCalledOnce();
    click(800);
    expect(chart['selectedDecision']).toBeNull();
  });

  it.each([
    [1000, { startIdx: 0, endIdx: 999 }, 100],
    [1000, { startIdx: 0, endIdx: 999 }, 500],
    [1000, { startIdx: 0, endIdx: 999 }, 900],
    [640, { startIdx: 200, endIdx: 299 }, 250],
    [1280, { startIdx: 200, endIdx: 299 }, 270],
  ])('tracks bar centers at width %i and viewport %o', (width, viewport, index) => {
    const chart = chartForHover(width, viewport);
    const x = xCenter(index, viewport, width);
    chart['onMove']({ clientX: 100 + x, clientY: 270 } as PointerEvent);

    expect(chart['hoverIdx']).toBe(index);
    expect(xCenter(chart['hoverIdx'], viewport, width)).toBeCloseTo(x);
    expect(chart['hoverPanel']).toBe(1);
    expect(chart['hoverY']).toBe(250);
  });

  it('snaps to the nearest bar without a systematic horizontal offset', () => {
    const viewport = { startIdx: 200, endIdx: 299 };
    const chart = chartForHover(1000, viewport);
    const x = xCenter(250, viewport, 1000) + 3;
    chart['onMove']({ clientX: 100 + x, clientY: 70 } as PointerEvent);

    expect(chart['hoverIdx']).toBe(250);
    expect(Math.abs(xCenter(chart['hoverIdx'], viewport, 1000) - x)).toBe(3);
  });

  it('uses the canvas width for pan and wheel-zoom coordinates too', () => {
    const chart = chartForHover(1000, { startIdx: 0, endIdx: 999 });
    chart['interactive'] = true;
    chart['rightAxis'] = element(56);
    chart['bottomAxis'] = element(1000);
    chart['attachAxisDrag'] = vi.fn();
    chart['attachEvents']();

    const calls = vi.mocked(attachPanZoom).mock.calls;
    const options = calls[calls.length - 1]![1];
    expect(options.getWidth()).toBe(1000);
    chart['chartScrollContainer'] = { scrollHeight: 1600, clientHeight: 720 } as HTMLDivElement;
    expect(options.requireZoomModifier?.()).toBe(true);
    chart['chartScrollContainer'] = { scrollHeight: 720, clientHeight: 720 } as HTMLDivElement;
    expect(options.requireZoomModifier?.()).toBe(false);
    expect(options.canStartPan?.({ clientX: 200.5, clientY: 130 } as PointerEvent)).toBe(true);
    const decision: DecisionAnnotation = {
      id: 'click', time: 100, panelId: 'z', value: -2, action: 'entry',
      card: { title: 'Click target', status: 'approved', groups: [] },
    };
    chart['decisions'] = [decision];
    chart['decisionIndex'] = new DecisionIndex([decision], chart['buf']);
    expect(options.canStartPan?.({ clientX: 200.5, clientY: 130 } as PointerEvent)).toBe(false);
    expect(options.canStartPan?.({ clientX: 200.5, clientY: 70 } as PointerEvent)).toBe(true);
    chart['comparing'] = true;
    expect(options.canStartPan?.({ clientX: 200.5, clientY: 70 } as PointerEvent)).toBe(false);
  });
});
