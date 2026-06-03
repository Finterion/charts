import type { OHLCBuffer, PanelKind, PanelSpec, ThemeTokens, TradeMarker, Viewport } from '../types';
import type { CrosshairState } from '../renderers/crosshair';
import { drawCrosshair, drawTooltip } from '../renderers/crosshair';
import { drawGrid, drawTitle, type GridStyle, type TitleStyle } from '../renderers/grid';
import { renderPrice, priceExtrema } from '../renderers/price';
import { renderIndicator, indicatorExtrema } from '../renderers/indicator';
import { renderMarkers } from '../renderers/markers';
import { renderHeatmap } from '../renderers/heatmap';
import { renderHBar } from '../renderers/hbar';
import { renderValueHistogram } from '../renderers/histogramValue';
import { renderScatter } from '../renderers/scatter';
import type { PanelLayout } from '../renderers/layout';
import { pad } from '../renderers/layout';

/** True if a panel kind shares the OHLC time viewport with the rest of the chart. */
export function isTimePanel(kind: PanelKind): boolean {
  return kind === 'price' || kind === 'indicator';
}

export class Panel {
  spec: PanelSpec;
  el: HTMLDivElement;
  base: HTMLCanvasElement;
  series: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  baseCtx: CanvasRenderingContext2D;
  seriesCtx: CanvasRenderingContext2D;
  overlayCtx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  yMin = 0;
  yMax = 1;
  /** Pixels reserved at the top of the panel for the title (data is not drawn there). */
  headerHeight = 0;
  /** User-applied Y zoom factor (1 = autoscale, >1 = compressed/zoomed-out, <1 = expanded). */
  yScale = 1;

  constructor(spec: PanelSpec) {
    this.spec = spec;
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:relative;flex:' + spec.weight + ' 1 0;min-height:0;';
    this.base = mkCanvas();
    this.series = mkCanvas();
    this.overlay = mkCanvas();
    this.overlay.style.pointerEvents = 'none';
    this.el.appendChild(this.base);
    this.el.appendChild(this.series);
    this.el.appendChild(this.overlay);
    this.baseCtx = this.base.getContext('2d')!;
    this.seriesCtx = this.series.getContext('2d')!;
    this.overlayCtx = this.overlay.getContext('2d')!;
  }

  /** Returns true if the canvas was actually resized (and thus cleared). */
  resize(dpr: number): boolean {
    const rect = this.el.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w === this.base.width && h === this.base.height && rect.width === this.width && rect.height === this.height) {
      return false;
    }
    this.width = rect.width;
    this.height = rect.height;
    for (const c of [this.base, this.series, this.overlay]) {
      c.width = w;
      c.height = h;
      c.style.width = rect.width + 'px';
      c.style.height = rect.height + 'px';
      c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return true;
  }

  computeRange(buf: OHLCBuffer | null, viewport: Viewport) {
    if (this.spec.kind === 'price' && buf) {
      const [lo, hi] = priceExtrema(buf, viewport.startIdx, viewport.endIdx);
      [this.yMin, this.yMax] = pad(lo, hi, 0.05);
    } else if (this.spec.kind === 'indicator' && this.spec.indicator) {
      if (this.spec.indicator.yRange) {
        [this.yMin, this.yMax] = this.spec.indicator.yRange;
      } else {
        const [lo, hi] = indicatorExtrema(
          this.spec.indicator.values,
          viewport.startIdx,
          viewport.endIdx,
          this.spec.indicator.lowerValues,
        );
        [this.yMin, this.yMax] = pad(lo, hi, 0.1);
      }
    }
    if (this.yScale !== 1) {
      const mid = (this.yMin + this.yMax) / 2;
      const half = ((this.yMax - this.yMin) / 2) * this.yScale;
      this.yMin = mid - half;
      this.yMax = mid + half;
    }
  }

  drawBase(
    theme: ThemeTokens,
    viewport: Viewport,
    titleStyle?: TitleStyle,
    gridStyle: GridStyle = 'horizontal',
    verticalGridXs: number[] = [],
  ) {
    const ctx = this.baseCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    // Title is drawn in the header band (full canvas coords).
    if (this.spec.title) {
      const style: TitleStyle = { ...titleStyle };
      if (this.spec.titleColor) style.color = this.spec.titleColor;
      const titleLayout: PanelLayout = { ctx, width: this.width, height: this.height, viewport, yMin: this.yMin, yMax: this.yMax, theme };
      drawTitle(titleLayout, this.spec.title, style);
    }
    // Time-based panels share the chart-wide grid; non-time panels draw their
    // own axes inside their renderer.
    if (!isTimePanel(this.spec.kind)) return;
    const dataHeight = Math.max(1, this.height - this.headerHeight);
    ctx.save();
    ctx.translate(0, this.headerHeight);
    const layout: PanelLayout = { ctx, width: this.width, height: dataHeight, viewport, yMin: this.yMin, yMax: this.yMax, theme };
    drawGrid(layout, gridStyle, verticalGridXs);
    ctx.restore();
  }

  drawSeries(theme: ThemeTokens, viewport: Viewport, buf: OHLCBuffer | null, markers: TradeMarker[]) {
    const ctx = this.seriesCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    const dataHeight = Math.max(1, this.height - this.headerHeight);
    ctx.save();
    ctx.translate(0, this.headerHeight);
    if (this.spec.kind === 'price' && buf) {
      const layout: PanelLayout = { ctx, width: this.width, height: dataHeight, viewport, yMin: this.yMin, yMax: this.yMax, theme };
      renderPrice(layout, buf, this.spec.type ?? 'candles');
      if (this.spec.overlays) for (const o of this.spec.overlays) renderIndicator(layout, o);
      if (markers.length) renderMarkers(layout, buf, markers);
    } else if (this.spec.kind === 'indicator' && this.spec.indicator) {
      const layout: PanelLayout = { ctx, width: this.width, height: dataHeight, viewport, yMin: this.yMin, yMax: this.yMax, theme };
      renderIndicator(layout, this.spec.indicator);
      if (this.spec.overlays) for (const o of this.spec.overlays) renderIndicator(layout, o);
    } else if (this.spec.kind === 'heatmap' && this.spec.heatmap) {
      renderHeatmap(ctx, this.width, dataHeight, this.spec.heatmap, theme);
    } else if (this.spec.kind === 'hbar' && this.spec.hbar) {
      renderHBar(ctx, this.width, dataHeight, this.spec.hbar, theme);
    } else if (this.spec.kind === 'histogram' && this.spec.histogram) {
      renderValueHistogram(ctx, this.width, dataHeight, this.spec.histogram, theme);
    } else if (this.spec.kind === 'scatter' && this.spec.scatter) {
      renderScatter(ctx, this.width, dataHeight, this.spec.scatter, theme);
    }
    ctx.restore();
  }

  drawOverlay(theme: ThemeTokens, viewport: Viewport, cross: CrosshairState, tooltip: string[] | null) {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!isTimePanel(this.spec.kind)) return;
    const dataHeight = Math.max(1, this.height - this.headerHeight);
    const adjusted = { idx: cross.idx, y: cross.y >= 0 ? cross.y - this.headerHeight : -1 };
    ctx.save();
    ctx.translate(0, this.headerHeight);
    drawCrosshair(ctx, this.width, dataHeight, viewport, theme, adjusted, tooltip != null);
    ctx.restore();
    if (tooltip) drawTooltip(ctx, this.width, theme, tooltip);
  }

  destroy() {
    this.el.remove();
  }
}

function mkCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:absolute;inset:0;display:block;';
  return c;
}
