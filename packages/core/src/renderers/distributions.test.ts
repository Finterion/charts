import { describe, expect, it, vi } from 'vitest';
import { finterionDark } from '../themes';
import { validateDistributionData } from '../data/distributions';
import { renderDonut } from './donut';
import { boxplotStatistics, renderBoxplot } from './boxplot';

function context() {
  const ctx = {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    rect: vi.fn(), clip: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(),
  };
  return { ctx, canvas: ctx as unknown as CanvasRenderingContext2D };
}

describe('distribution panels', () => {
  it('draws donut slices in proportion to values and keeps empty totals visible', () => {
    const { ctx, canvas } = context();
    renderDonut(canvas, 500, 300, {
      categories: ['BTC', 'ETH'], values: [3, 1], colors: ['#f7931a', '#627eea'],
    }, finterionDark);
    const arcs = ctx.arc.mock.calls;
    expect(arcs).toHaveLength(5);
    expect(arcs[1]![4] - arcs[1]![3]).toBeCloseTo(1.5 * Math.PI);
    expect(arcs[3]![4] - arcs[3]![3]).toBeCloseTo(0.5 * Math.PI);
    expect(ctx.fillText.mock.calls.map(call => call[0])).toEqual(['4', 'TRADES', 'BTC: 3', 'ETH: 1']);
    for (const values of [[], [0, 0]]) {
      const empty = context();
      renderDonut(empty.canvas, 200, 200, {
        categories: values.map((_, i) => String(i)), values,
      }, finterionDark);
      expect(empty.ctx.arc).toHaveBeenCalledOnce();
      expect(empty.ctx.fillText.mock.calls[0]![0]).toBe('0');
    }
  });

  it('uses observed-order quartiles without mutating observations', () => {
    const values = [4, 1, 3, 2];
    expect(boxplotStatistics(values)).toEqual({ min: 1, q1: 2, median: 3, q3: 4, max: 4 });
    expect(values).toEqual([4, 1, 3, 2]);
    expect(boxplotStatistics([7])).toEqual({ min: 7, q1: 7, median: 7, q3: 7, max: 7 });
    expect(boxplotStatistics([])).toBeNull();
  });

  it('renders finite coordinates and deterministic observation jitter for degenerate data', () => {
    for (const values of [[], [[], []], [[7], [7, 7]], [[-Number.MAX_VALUE, Number.MAX_VALUE]]]) {
      const data = { categories: values.map((_, i) => String(i)), values, showPoints: true };
      const first = context();
      const second = context();
      renderBoxplot(first.canvas, 500, 300, data, finterionDark);
      renderBoxplot(second.canvas, 500, 300, data, finterionDark);
      expect(first.ctx.arc.mock.calls).toEqual(second.ctx.arc.mock.calls);
      expect(first.ctx.arc.mock.calls).toHaveLength(values.reduce((total, group) => total + group.length, 0));
      for (const draw of [first.ctx.arc, first.ctx.moveTo, first.ctx.lineTo, first.ctx.strokeRect]) {
        for (const args of draw.mock.calls) {
          for (const arg of args) if (typeof arg === 'number') expect(Number.isFinite(arg)).toBe(true);
        }
      }
    }
  });

  it('rejects malformed distributions before drawing', () => {
    for (const [kind, values] of [
      ['donut', [-1]], ['donut', [Infinity]], ['boxplot', [[NaN]]], ['boxplot', [1]],
    ] as const) {
      expect(validateDistributionData(kind, { categories: ['BTC'], values })).not.toEqual([]);
    }
    expect(validateDistributionData('donut', { categories: [], values: [1] })).not.toEqual([]);
    expect(() => renderDonut(context().canvas, 200, 200, {
      categories: ['BTC'], values: [1], innerRadius: 1,
    }, finterionDark)).toThrow('innerRadius');
    expect(() => renderBoxplot(context().canvas, 200, 200, {
      categories: ['BTC'], values: [[1]], colors: [],
    }, finterionDark)).toThrow('colors');
  });
});
