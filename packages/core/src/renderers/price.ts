import type { OHLCBuffer, SeriesType } from '../types';
import type { PanelLayout } from './layout';
import { bandWidth, xCenter, yPos } from './layout';

export function priceExtrema(buf: OHLCBuffer, startIdx: number, endIdx: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  const s = Math.max(0, startIdx);
  const e = Math.min(buf.length - 1, endIdx);
  for (let i = s; i <= e; i++) {
    const lo = buf.low[i]!;
    const hi = buf.high[i]!;
    if (lo < min) min = lo;
    if (hi > max) max = hi;
  }
  return [min, max];
}

export function renderPrice(layout: PanelLayout, buf: OHLCBuffer, type: SeriesType) {
  if (type === 'candles') drawCandles(layout, buf);
  else if (type === 'line') drawLine(layout, buf);
  else drawArea(layout, buf);
}

function drawCandles(layout: PanelLayout, buf: OHLCBuffer) {
  const { ctx, width, height, viewport, yMin, yMax, theme } = layout;
  const bw = bandWidth(viewport, width);
  const candleW = Math.max(1, Math.min(bw * 0.7, 14));
  const halfW = candleW / 2;
  const s = Math.max(0, viewport.startIdx);
  const e = Math.min(buf.length - 1, viewport.endIdx);

  ctx.save();
  for (let i = s; i <= e; i++) {
    const o = buf.open[i]!;
    const h = buf.high[i]!;
    const l = buf.low[i]!;
    const c = buf.close[i]!;
    const x = xCenter(i, viewport, width);
    const yH = yPos(h, yMin, yMax, height);
    const yL = yPos(l, yMin, yMax, height);
    const yO = yPos(o, yMin, yMax, height);
    const yC = yPos(c, yMin, yMax, height);
    const up = c >= o;
    const color = up ? theme.up : theme.down;
    const glow = up ? theme.upGlow : theme.downGlow;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yH);
    ctx.lineTo(x, yL);
    ctx.stroke();

    const top = Math.min(yO, yC);
    const bot = Math.max(yO, yC);
    const bodyH = Math.max(1, bot - top);
    const grad = ctx.createLinearGradient(x - halfW, top, x - halfW, bot);
    grad.addColorStop(0, color);
    grad.addColorStop(1, glow);
    ctx.fillStyle = grad;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.fillRect(x - halfW, top, candleW, bodyH);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawLine(layout: PanelLayout, buf: OHLCBuffer) {
  const { ctx, width, height, viewport, yMin, yMax, theme } = layout;
  const s = Math.max(0, viewport.startIdx);
  const e = Math.min(buf.length - 1, viewport.endIdx);

  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.shadowColor = theme.accentGlow;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = s; i <= e; i++) {
    const x = xCenter(i, viewport, width);
    const y = yPos(buf.close[i]!, yMin, yMax, height);
    if (i === s) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawArea(layout: PanelLayout, buf: OHLCBuffer) {
  const { ctx, width, height, viewport, yMin, yMax, theme } = layout;
  const s = Math.max(0, viewport.startIdx);
  const e = Math.min(buf.length - 1, viewport.endIdx);

  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, theme.accentGlow);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(xCenter(s, viewport, width), height);
  for (let i = s; i <= e; i++) {
    ctx.lineTo(xCenter(i, viewport, width), yPos(buf.close[i]!, yMin, yMax, height));
  }
  ctx.lineTo(xCenter(e, viewport, width), height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = theme.accent;
  ctx.shadowColor = theme.accentGlow;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = s; i <= e; i++) {
    const x = xCenter(i, viewport, width);
    const y = yPos(buf.close[i]!, yMin, yMax, height);
    if (i === s) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}
