import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBuffer } from '../data/buffer';
import { finterionDark } from '../themes';
import { ComparisonInspector, comparisonChange, comparisonIndices, comparisonRows } from './comparison';

const buf = createBuffer([10, 20, 30].map((time, i) => ({
  time, open: 100 + i, high: 110 + i, low: 90 + i, close: 105 + i, volume: 1000 + i,
})));

describe('point comparison', () => {
  it('resolves exact timestamps in selection order, not nearest bars', () => {
    expect(comparisonIndices(buf, [30, 10, 25, 40])).toEqual([2, 0, -1, -1]);
    expect(comparisonIndices(null, [10])).toEqual([-1]);
    expect(comparisonIndices(createBuffer([]), [10])).toEqual([-1]);
  });

  class Element {
    className = '';
    tabIndex = -1;
    title = '';
    children: Element[] = [];
    parentElement?: Element;
    attributes = new Map<string, string>();
    listeners = new Map<string, (event?: unknown) => void>();
    textContent = '';
    capturedPointer?: number;
    style = {
      width: '', display: '', value: '',
      get cssText() { return this.value; },
      set cssText(value: string) {
        this.value = value;
        this.width = /(?:^|;)width:([^;]+)/.exec(value)?.[1] ?? '';
      },
    };
    appendChild(child: Element) { this.children.push(child); child.parentElement = this; return child; }
    replaceChildren(...children: Element[]) {
      this.children = [];
      for (const child of children) this.appendChild(child);
    }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    addEventListener(key: string, value: (event?: unknown) => void) { this.listeners.set(key, value); }
    getBoundingClientRect() { return { width: Number.parseFloat(this.style.width) || 440 }; }
    setPointerCapture(id: number) { this.capturedPointer = id; }
    hasPointerCapture(id: number) { return this.capturedPointer === id; }
    releasePointerCapture() { this.capturedPointer = undefined; }
    all(): Element[] { return [this, ...this.children.flatMap(child => child.all())]; }
  }

  describe('comparison panel resizing', () => {
    afterEach(() => vi.unstubAllGlobals());

    function inspector() {
      vi.stubGlobal('document', { createElement: () => new Element() });
      const resize = vi.fn();
      const ui = new ComparisonInspector(resize);
      const shell = ui.el as unknown as Element;
      shell.parentElement = new Element();
      shell.parentElement.style.width = '1400px';
      const render = (times = [10, 20]) => ui.render({
        times, buf, panels: [{ id: 'price', kind: 'price', weight: 1 }],
        theme: finterionDark, remove: vi.fn(), clear: vi.fn(), close: vi.fn(),
      });
      render();
      const handle = shell.all().find(el => el.attributes.get('role') === 'separator')!;
      return { shell, handle, render, resize };
    }

    const pointer = (clientX: number, pointerId = 1) => ({
      clientX, pointerId, button: 0, preventDefault: vi.fn(),
    });

    it('widens from the left divider and preserves width and values when points change', () => {
      const { shell, handle, render, resize } = inspector();
      expect(shell.style.width).toBe('440px');
      expect(handle.attributes.get('aria-label')).toBe('Resize point comparison');
      handle.listeners.get('pointerdown')!(pointer(1000));
      handle.listeners.get('pointermove')!(pointer(600, 2));
      expect(shell.style.width).toBe('440px');
      handle.listeners.get('pointermove')!(pointer(600));
      expect(shell.style.width).toBe('840px');
      expect(handle.attributes.get('aria-valuenow')).toBe('840');
      handle.listeners.get('pointerup')!(pointer(600));
      expect(handle.capturedPointer).toBeUndefined();
      render([10, 20, 30]);
      expect(shell.style.width).toBe('840px');
      expect(shell.all().map(el => el.textContent)).toEqual(expect.arrayContaining(['105', '106', '107']));
      shell.style.display = 'none';
      render([10, 30]);
      expect(shell.style.width).toBe('840px');
      render([]);
      expect(shell.style.width).toBe('840px');
      expect(resize).toHaveBeenCalledOnce();
      expect(shell.all().filter(el => el.attributes.get('role') === 'separator')).toHaveLength(1);
    });

    it('supports keyboard sizing and reset while reserving chart space', () => {
      const { shell, handle, resize } = inspector();
      const key = (key: string, shiftKey = false) =>
        handle.listeners.get('keydown')!({ key, shiftKey, preventDefault: vi.fn() });
      key('ArrowLeft');
      expect(shell.style.width).toBe('460px');
      key('ArrowRight', true);
      expect(shell.style.width).toBe('410px');
      key('Home');
      expect(shell.style.width).toBe('220px');
      key('End');
      expect(shell.style.width).toBe('1240px');
      expect(handle.attributes.get('aria-valuemax')).toBe('1240');
      shell.parentElement!.style.width = '300px';
      key('End');
      expect(shell.style.width).toBe('140px');
      expect(handle.attributes.get('aria-valuemin')).toBe('140');
      handle.listeners.get('dblclick')!();
      expect(shell.style.width).toBe('440px');
      expect(resize).toHaveBeenCalledTimes(6);
    });

    it('clamps drag sizes and stops resizing on cancellation or lost pointer capture', () => {
      const { shell, handle } = inspector();
      handle.listeners.get('pointerdown')!(pointer(1000));
      handle.listeners.get('pointermove')!(pointer(-1000));
      expect(shell.style.width).toBe('1240px');
      handle.listeners.get('pointermove')!(pointer(2000));
      expect(shell.style.width).toBe('220px');
      handle.listeners.get('pointercancel')!(pointer(2000));
      expect(handle.capturedPointer).toBeUndefined();
      handle.listeners.get('pointermove')!(pointer(600));
      expect(shell.style.width).toBe('220px');
      handle.listeners.get('pointerdown')!(pointer(1000));
      handle.listeners.get('lostpointercapture')!();
      handle.listeners.get('pointermove')!(pointer(600));
      expect(shell.style.width).toBe('220px');
    });
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
