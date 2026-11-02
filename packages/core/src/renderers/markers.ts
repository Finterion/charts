import type { OHLCBuffer, PanelSpec, TradeMarker } from '../types';
import type { PanelLayout } from './layout';
import { xCenter, yPos } from './layout';
import { indexAtTime } from '../data/buffer';

export function markersForPanel(markers: TradeMarker[], panel: Pick<PanelSpec, 'id' | 'kind'>): TradeMarker[] {
  if (panel.kind !== 'price' && panel.kind !== 'indicator') return [];
  return markers.filter((marker) => marker.panelId === undefined
    ? panel.kind === 'price'
    : marker.panelId === panel.id);
}

export function renderMarkers(layout: PanelLayout, buf: OHLCBuffer, markers: TradeMarker[]) {
  if (!markers.length) return;
  const { ctx, width, height, viewport, yMin, yMax, theme } = layout;
  ctx.save();
  for (const m of markers) {
    const i = indexAtTime(buf, m.time);
    if (i < viewport.startIdx || i > viewport.endIdx) continue;
    const x = xCenter(i, viewport, width);
    const y = yPos(m.price, yMin, yMax, height);
    const buy = m.side === 'buy';
    const color = buy ? theme.up : theme.down;
    const glow = buy ? theme.upGlow : theme.downGlow;
    const dir = buy ? 1 : -1;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.5;

    if (m.shape === 'plus' || m.shape === 'minus') {
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      if (m.shape === 'plus') {
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
      }
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    const circle = m.shape === 'circle';
    const sign = m.shape === 'plus' || m.shape === 'minus';
    const offset = circle || sign ? 0 : 16 * dir;
    if (!sign) {
      ctx.beginPath();
      if (circle) {
        ctx.arc(x, y, 4, 0, Math.PI * 2);
      } else {
        ctx.moveTo(x, y + offset);
        ctx.lineTo(x - 6, y + offset + 10 * dir);
        ctx.lineTo(x + 6, y + offset + 10 * dir);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    if (m.label) {
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = buy ? 'top' : 'bottom';
      ctx.fillStyle = theme.text;
      ctx.fillText(m.label, x, y + offset + 14 * dir);
    }
  }
  ctx.restore();
}
