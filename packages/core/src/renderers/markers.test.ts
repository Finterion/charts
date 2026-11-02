import { describe, expect, it, vi } from 'vitest';
import type { TradeMarker } from '../types';
import { markersForPanel, renderMarkers } from './markers';
import { createBuffer } from '../data/buffer';
import { finterionDark } from '../themes';

const legacy: TradeMarker = { time: 1, price: 100, side: 'buy' };
const price: TradeMarker = { time: 1, price: 100, side: 'sell', panelId: 'price' };
const indicator: TradeMarker = {
  time: 1, price: -2, side: 'buy', panelId: 'z_score', shape: 'circle',
};
const markers = [legacy, price, indicator];

describe('markersForPanel', () => {
  it.each(['plus', 'minus'] as const)('renders %s strokes rather than entry arrows', shape => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
      lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), arc: vi.fn(),
    };
    renderMarkers({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      width: 300, height: 100, viewport: { startIdx: 0, endIdx: 0 },
      yMin: 0, yMax: 200, theme: finterionDark,
    }, createBuffer([{ time: 1, open: 100, high: 100, low: 100, close: 100 }]), [
      { ...legacy, shape },
    ]);
    expect(ctx.moveTo).toHaveBeenCalledWith(145, 50);
    expect(ctx.lineTo).toHaveBeenCalledWith(155, 50);
    expect(ctx.lineTo.mock.calls.length).toBe(shape === 'plus' ? 2 : 1);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('keeps legacy markers on price panels and routes explicit price markers', () => {
    expect(markersForPanel(markers, { id: 'price', kind: 'price' })).toEqual([legacy, price]);
    expect(markersForPanel(markers, { id: 'other', kind: 'price' })).toEqual([legacy]);
  });

  it('routes an indicator marker only to its target', () => {
    expect(markersForPanel(markers, { id: 'z_score', kind: 'indicator' })).toEqual([indicator]);
    expect(markersForPanel(markers, { id: 'stochastic', kind: 'indicator' })).toEqual([]);
  });

  it('never routes markers to non-time panels', () => {
    expect(markersForPanel(markers, { id: 'z_score', kind: 'scatter' })).toEqual([]);
  });
});
