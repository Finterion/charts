import type { DonutData, ThemeTokens } from '../types';
import { assertDistributionData } from '../data/distributions';

export function categoryColor(index: number, colors: string[] | undefined, theme: ThemeTokens): string {
  return colors?.[index] ?? [theme.accent, theme.up, theme.down, '#a78bfa', '#fbbf24', '#22d3ee'][index % 6]!;
}

export function renderDonut(
  ctx: CanvasRenderingContext2D, width: number, height: number, data: DonutData, theme: ThemeTokens,
) {
  assertDistributionData('donut', data);
  if (width <= 0 || height <= 0) return;
  const fmt = data.format ?? ((v: number) => String(v));
  const total = data.values.reduce((sum, v) => sum + v, 0);
  const stacked = width < 360;
  const legendHeight = Math.min(height * 0.45, data.categories.length * 18);
  const plotW = stacked ? width : width * 0.55;
  const plotH = stacked ? height - legendHeight : height;
  const cx = plotW / 2;
  const cy = plotH / 2;
  const radius = Math.max(1, Math.min(plotW, plotH) / 2 - 12);
  const inner = radius * (data.innerRadius ?? 0.55);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  // A neutral ring remains visible for empty and all-zero datasets.
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = radius - inner;
  ctx.beginPath();
  ctx.arc(cx, cy, (radius + inner) / 2, 0, Math.PI * 2);
  ctx.stroke();
  let angle = -Math.PI / 2;
  if (total > 0) {
    data.values.forEach((value, i) => {
      if (value === 0) return;
      const end = angle + (value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angle, end);
      ctx.arc(cx, cy, inner, end, angle, true);
      ctx.closePath();
      ctx.fillStyle = categoryColor(i, data.colors, theme);
      ctx.fill();
      angle = end;
    });
  }
  ctx.fillStyle = theme.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px ui-monospace, monospace';
  if (data.showTotal !== false) ctx.fillText(fmt(total), cx, cy - 7, Math.max(1, inner * 1.8));
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = theme.textDim;
  ctx.fillText(data.centerLabel ?? 'TRADES', cx, cy + (data.showTotal === false ? 0 : 13), Math.max(1, inner * 1.8));
  const legendX = stacked ? 12 : plotW + 8;
  const legendY = stacked ? plotH : Math.max(12, (height - data.categories.length * 18) / 2);
  ctx.textAlign = 'left';
  data.categories.forEach((label, i) => {
    const y = legendY + i * 18;
    ctx.fillStyle = categoryColor(i, data.colors, theme);
    ctx.fillRect(legendX, y - 4, 8, 8);
    ctx.fillStyle = theme.text;
    ctx.fillText(`${label}: ${fmt(data.values[i]!)}`, legendX + 14, y, Math.max(1, width - legendX - 20));
  });
  ctx.restore();
}
