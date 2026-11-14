import { describe, expect, it, vi } from 'vitest';
import { resolveTheme } from '../themes';
import { indicatorExtrema, renderIndicator } from './indicator';

function draw(sampleMask?: number[], startIdx = 0, endIdx = 4, refLines?: number[], refLineColors?: string[]) {
  const strokes: { color: string; width: number }[] = [];
  const ctx = {
    save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    strokeStyle: '', lineWidth: 0, strokes,
  };
  ctx.stroke.mockImplementation(() => { strokes.push({ color: ctx.strokeStyle, width: ctx.lineWidth }); });
  renderIndicator({
    ctx: ctx as unknown as CanvasRenderingContext2D,
    width: 500, height: 100, viewport: { startIdx, endIdx },
    yMin: 0, yMax: 40, theme: resolveTheme('finterion-dark'),
  }, {
    values: new Float32Array([10, NaN, 20, NaN, 30]), kind: 'line', color: '#fff',
    sampleMask: sampleMask ? new Float32Array(sampleMask) : undefined,
    refLines, refLineColors,
  });
  return ctx;
}

describe('sparsely sampled lines', () => {
  it('uses each reference color without changing threshold dashes or the zero baseline', () => {
    const colors = ['#16a34a', '#64748b', '#dc2626'];
    const ctx = draw(undefined, 0, 4, [-2, 0, 2], colors);
    expect(ctx.strokes.slice(0, 3)).toEqual(colors.map(color => ({ color, width: 1.5 })));
    expect(ctx.setLineDash.mock.calls.slice(0, 3)).toEqual([[[5, 4]], [[]], [[5, 4]]]);
  });

  it('draws all three reference levels across the pane with a solid zero baseline', () => {
    const ctx = draw(undefined, 0, 4, [-2, 0, 2]);
    expect(ctx.moveTo.mock.calls.slice(0, 3)).toEqual([[0, 105], [0, 100], [0, 95]]);
    expect(ctx.lineTo.mock.calls.slice(0, 3)).toEqual([[444, 105], [444, 100], [444, 95]]);
    expect(ctx.setLineDash.mock.calls.slice(0, 3)).toEqual([[[5, 4]], [[]], [[5, 4]]]);
    expect(ctx.strokes.slice(0, 3)).toEqual(Array.from({ length: 3 }, () => ({
      color: resolveTheme('finterion-dark').textDim, width: 1.5,
    })));
  });

  it('autoscales the surrounding samples used to draw a zoomed sparse segment', () => {
    expect(indicatorExtrema(
      new Float32Array([10, NaN, 20]), 1, 1, undefined, new Float32Array([1, 0, 1]),
    )).toEqual([10, 20]);
  });

  it('does not bridge recorded missing values when computing sparse ranges', () => {
    expect(indicatorExtrema(
      new Float32Array([10, NaN, NaN, NaN, 20]), 2, 2, undefined, new Float32Array([1, 1, 0, 1, 1]),
    )).toEqual([Infinity, -Infinity]);
  });

  it('connects unobserved timestamps without connecting genuine recorded gaps', () => {
    const ctx = draw([1, 0, 1, 1, 1]);
    expect(ctx.moveTo.mock.calls).toEqual([[50, 75], [450, 25]]);
    expect(ctx.lineTo.mock.calls).toEqual([[250, 50]]);
  });

  it('preserves ordinary gap rendering when no sampling mask is supplied', () => {
    const ctx = draw();
    expect(ctx.moveTo).toHaveBeenCalledTimes(3);
    expect(ctx.lineTo).not.toHaveBeenCalled();
  });

  it('keeps the curve visible when zoomed between recorded samples', () => {
    const ctx = draw([1, 0, 1, 1, 1], 1, 1);
    expect(ctx.moveTo).toHaveBeenCalledWith(-250, 75);
    expect(ctx.lineTo).toHaveBeenCalledWith(750, 50);
  });
});
