import type { HeatmapData, ThemeTokens } from '../types';
import { axisColors, divergingScale } from './colors';

const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';

export function renderHeatmap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: HeatmapData,
  theme: ThemeTokens,
) {
  const { line, text } = axisColors(theme);
  const padL = 44;
  const padR = 8;
  const padT = 6;
  const padB = data.xLabel ? 26 : 18;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);
  const rows = data.rows.length;
  const cols = data.cols.length;
  if (rows === 0 || cols === 0) return;
  const cellW = innerW / cols;
  const cellH = innerH / rows;

  // Auto-range.
  let max = 0;
  for (const row of data.values)
    for (const v of row)
      if (v !== null && v !== undefined && Number.isFinite(v)) max = Math.max(max, Math.abs(v));
  const range = data.range ?? max ?? 1;
  const scale = data.colorScale ?? divergingScale;
  const fmt = data.format ?? ((v: number) => v.toFixed(1));

  ctx.save();
  ctx.font = FONT;
  ctx.fillStyle = text;

  // y-axis labels (rows).
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < rows; r++) {
    ctx.fillText(data.rows[r] ?? '', padL - 6, padT + r * cellH + cellH / 2);
  }

  // x-axis labels (cols).
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let c = 0; c < cols; c++) {
    ctx.fillText(data.cols[c] ?? '', padL + c * cellW + cellW / 2, padT + innerH + 4);
  }

  // Cells + cell labels.
  for (let r = 0; r < rows; r++) {
    const rowData = data.values[r];
    if (!rowData) continue;
    for (let c = 0; c < cols; c++) {
      const v = rowData[c];
      const x = padL + c * cellW;
      const y = padT + r * cellH;
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      const t = range > 0 ? v / range : 0;
      ctx.fillStyle = scale(t);
      ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      // Cell label.
      const intensity = Math.min(1, Math.abs(t));
      ctx.fillStyle = intensity > 0.6 ? '#ffffff' : theme.text;
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(v), x + cellW / 2, y + cellH / 2);
    }
  }

  // Frame.
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.strokeRect(padL + 0.5, padT + 0.5, innerW, innerH);

  // Axis labels.
  if (data.xLabel) {
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(data.xLabel, padL + innerW / 2, height - 4);
  }
  if (data.yLabel) {
    ctx.save();
    ctx.translate(12, padT + innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(data.yLabel, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
