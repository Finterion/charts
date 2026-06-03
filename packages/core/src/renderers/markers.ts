import type { OHLCBuffer, TradeMarker } from '../types';
import type { PanelLayout } from './layout';
import { xCenter, yPos } from './layout';
import { indexAtTime } from '../data/buffer';

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

    const offset = 16 * dir;
    ctx.beginPath();
    ctx.moveTo(x, y + offset);
    ctx.lineTo(x - 6, y + offset + 10 * dir);
    ctx.lineTo(x + 6, y + offset + 10 * dir);
    ctx.closePath();
    ctx.fill();

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
