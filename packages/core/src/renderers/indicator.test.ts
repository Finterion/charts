import { describe, expect, it, vi } from 'vitest';
import { resolveTheme } from '../themes';
import { renderIndicator } from './indicator';

function draw(sampleMask?: number[], startIdx = 0, endIdx = 4) {
  const ctx = {
    save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  };
  renderIndicator({
    ctx: ctx as unknown as CanvasRenderingContext2D,
    width: 500, height: 100, viewport: { startIdx, endIdx },
    yMin: 0, yMax: 40, theme: resolveTheme('finterion-dark'),
  }, {
    values: new Float32Array([10, NaN, 20, NaN, 30]), kind: 'line', color: '#fff',
    sampleMask: sampleMask ? new Float32Array(sampleMask) : undefined,
  });
  return ctx;
}

describe('sparsely sampled lines', () => {
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
