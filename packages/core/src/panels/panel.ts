import type { IndicatorSeries, OHLCBuffer, PanelKind, PanelSpec, ThemeTokens, TradeMarker, Viewport } from '../types';
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

/** Callbacks the chart provides to each panel for legend interactivity. */
export interface PanelHooks {
  onLegendToggle?: (panelId: string, seriesId: string, hidden: boolean) => void;
  onCollapseToggle?: (panelId: string, collapsed: boolean) => void;
  /** Schedule a redraw on the chart (called when the user toggles a series). */
  requestRedraw?: () => void;
  /** True if this panel can be collapsed (every non-first panel by default). */
  canCollapse?: () => boolean;
}

/** Resolved legend mode passed in from the chart on every draw. */
export type LegendMode = boolean | 'auto';

export class Panel {
  spec: PanelSpec;
  el: HTMLDivElement;
  base: HTMLCanvasElement;
  series: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  legendEl: HTMLDivElement;
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
  /** True when collapsed via the title toggle — chart will skip rendering data. */
  collapsed = false;
  /** Provided by the parent chart so legend toggles can notify the host and request redraws. */
  hooks: PanelHooks = {};

  constructor(spec: PanelSpec) {
    this.spec = spec;
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:relative;flex:' + spec.weight + ' 1 0;min-height:0;';
    this.base = mkCanvas();
    this.series = mkCanvas();
    this.overlay = mkCanvas();
    this.overlay.style.pointerEvents = 'none';
    // The legend lives OUTSIDE panel.el so it can sit above the chart's
    // pan/zoom event surface in z-order. The chart attaches it to
    // panelsContainer in setPanels().
    this.legendEl = mkLegend();
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
    suppressTitle = false,
  ) {
    const ctx = this.baseCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    // Title is drawn in the header band (full canvas coords).
    if (this.spec.title && !suppressTitle) {
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
      if (this.spec.overlays) for (const o of this.spec.overlays) if (!o.hidden) renderIndicator(layout, o);
      if (markers.length) renderMarkers(layout, buf, markers);
    } else if (this.spec.kind === 'indicator' && this.spec.indicator) {
      const layout: PanelLayout = { ctx, width: this.width, height: dataHeight, viewport, yMin: this.yMin, yMax: this.yMax, theme };
      if (!this.spec.indicator.hidden) renderIndicator(layout, this.spec.indicator);
      if (this.spec.overlays) for (const o of this.spec.overlays) if (!o.hidden) renderIndicator(layout, o);
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

  /**
   * (Re)build the inline legend for this panel based on the current spec and
   * resolved legend mode. Idempotent: safe to call on every base draw — the
   * DOM is only mutated when the visible signature changes.
   */
  /**
   * (Re)build the inline legend for this panel based on the current spec and
   * resolved legend mode. Three layouts are produced:
   *
   *  1. **Pane collapse toggle.** When the panel has exactly one toggleable
   *     thing and is allowed to collapse (i.e. not the first pane), the eye
   *     button next to the title controls the entire pane's visibility rather
   *     than a single series.
   *  2. **Inline single-series toggle.** When there's exactly one toggleable
   *     thing but collapse is not allowed (first pane), a bare eye button
   *     (no colour swatch) is placed next to the title.
   *  3. **Vertical multi-series legend.** When there are two or more
   *     toggleable series, they stack in the top-right with swatch + label +
   *     eye per row.
   *
   * Idempotent: the DOM is only mutated when the visible signature changes.
   */
  syncLegend(
    theme: ThemeTokens,
    mode: LegendMode,
    titleStyle: TitleStyle | undefined,
    placement: 'overlay' | 'external' = 'overlay',
  ) {
    const series = collectLegendSeries(this.spec);
    // `toggleable` always wins when set:
    //   - `false`: hide regardless of mode
    //   - `true`:  show regardless of mode
    // For the rest, fall back to the chart-level `mode`.
    const visible = series.filter((s) => {
      const t = s.series.toggleable;
      if (t === false) return false;
      if (t === true) return mode !== false;
      if (mode === false) return false;
      if (mode === true) return true;
      return !!s.series.label; // 'auto'
    });
    if (!visible.length) {
      if (this.legendEl.style.display !== 'none') this.legendEl.style.display = 'none';
      this.legendEl.replaceChildren();
      this.legendEl.dataset['sig'] = '';
      return;
    }
    const padTop = titleStyle?.paddingTop ?? 8;
    const padLeft = titleStyle?.paddingLeft ?? 8;
    const fontSize = titleStyle?.fontSize ?? 11;
    const panelTop = this.el.offsetTop;
    const panelLeft = this.el.offsetLeft;
    const panelWidth = this.el.offsetWidth;
    const canCollapse = !!this.hooks.canCollapse?.();
    const single = visible.length === 1;

    // Choose layout. In external (sidebar) mode every series gets a full row
    // — no pane-collapse shortcut, no inline single-series shortcut, since
    // the legend no longer overlaps the title.
    const mode2: 'collapse' | 'single' | 'multi' | 'list' =
      placement === 'external'
        ? 'list'
        : single && canCollapse
          ? 'collapse'
          : single
            ? 'single'
            : 'multi';

    if (mode2 === 'list') {
      // External — laid out by the parent sidebar. Reset all absolute
      // positioning so it flows normally inside its host.
      this.legendEl.style.position = 'static';
      this.legendEl.style.flexDirection = 'column';
      this.legendEl.style.alignItems = 'stretch';
      this.legendEl.style.gap = '2px';
      this.legendEl.style.top = '';
      this.legendEl.style.left = '';
      this.legendEl.style.right = '';
    } else if (mode2 === 'multi') {
      // Top-right of the data area (above the right-axis gutter).
      this.legendEl.style.position = 'absolute';
      const parent = this.legendEl.parentElement;
      const parentW = parent?.clientWidth ?? panelWidth;
      const rightGutter = parentW - (panelLeft + panelWidth) + 60; // 56px axis + 4px breathing room
      this.legendEl.style.flexDirection = 'column';
      this.legendEl.style.alignItems = 'flex-end';
      this.legendEl.style.gap = '2px';
      this.legendEl.style.top = `${panelTop + padTop}px`;
      this.legendEl.style.left = '';
      this.legendEl.style.right = `${rightGutter}px`;
    } else {
      // Inline next to the title (top-left).
      this.legendEl.style.position = 'absolute';
      this.legendEl.style.flexDirection = 'row';
      this.legendEl.style.alignItems = 'center';
      this.legendEl.style.gap = '8px';
      this.legendEl.style.top = `${panelTop + padTop}px`;
      this.legendEl.style.right = '';
      const titleWidth = this.spec.title ? this.measureTitle(this.spec.title, fontSize) : 0;
      const gap = this.spec.title ? 8 : 0;
      this.legendEl.style.left = `${panelLeft + padLeft + titleWidth + gap}px`;
    }

    this.legendEl.style.display = 'flex';
    this.legendEl.style.color = theme.textDim;

    // Cheap signature so we don't rebuild the DOM every frame.
    const sig = visible
      .map((s) => `${s.id}|${s.series.label ?? ''}|${s.series.metric ?? ''}|${s.series.color}|${s.series.hidden ? 1 : 0}|${s.series.toggleable === undefined ? 'u' : s.series.toggleable ? 't' : 'f'}`)
      .join('§') + `|m=${mode2}|fs=${fontSize}|t=${this.spec.title ?? ''}|c=${this.collapsed ? 1 : 0}`;
    if (this.legendEl.dataset['sig'] === sig) return;
    this.legendEl.dataset['sig'] = sig;

    let rows: HTMLElement[];
    if (mode2 === 'collapse') {
      rows = [this.makeCollapseToggle(theme, fontSize)];
    } else if (mode2 === 'single') {
      rows = [this.makeBareToggle(visible[0]!.id, visible[0]!.series, theme, fontSize)];
    } else {
      // 'multi' and 'list' both render full swatch + label + eye rows.
      const external = mode2 === 'list';
      rows = visible.map((s) => this.makeLegendRow(s.id, s.series, theme, fontSize, external));
    }
    this.legendEl.replaceChildren(...rows);
  }

  /**
   * Measure the rendered width of the panel title in CSS pixels so the inline
   * legend can sit immediately to its right. Uses the same font / transform
   * as `drawTitle`.
   */
  private measureTitle(title: string, fontSize: number): number {
    const ctx = this.baseCtx;
    ctx.save();
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const w = ctx.measureText(title.toUpperCase()).width;
    ctx.restore();
    return w;
  }

  private makeLegendRow(
    seriesId: string,
    s: IndicatorSeries,
    theme: ThemeTokens,
    fontSize: number,
    external = false,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = external
      ? `display:flex;align-items:center;gap:8px;font-size:${fontSize}px;line-height:${fontSize + 6}px;` +
        `font-family:Inter,system-ui,sans-serif;user-select:none;` +
        `padding:2px 4px;border-radius:3px;min-width:0;`
      : `display:flex;align-items:center;gap:6px;font-size:${fontSize}px;line-height:${fontSize + 3}px;` +
        `font-family:ui-monospace,SFMono-Regular,Menlo,monospace;user-select:none;`;
    row.style.opacity = s.hidden ? '0.45' : '1';

    const swatch = document.createElement('span');
    const swatchStyle = s.kind === 'histogram'
      ? `display:inline-block;flex:0 0 auto;width:10px;height:10px;background:${s.color};border-radius:2px;`
      : external
        ? `display:inline-block;flex:0 0 auto;width:10px;height:2px;background:${s.color};border-radius:1px;`
        : `display:inline-block;width:10px;height:2px;background:${s.color};border-radius:1px;`;
    swatch.style.cssText = swatchStyle;

    const label = document.createElement('span');
    label.textContent = s.label ?? seriesId;
    label.style.cssText = external
      ? 'flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      : 'white-space:nowrap;';

    const btn = this.makeEyeButton(s.hidden ?? false, theme, () => this.toggleSeriesVisibility(seriesId));

    row.appendChild(swatch);
    row.appendChild(label);
    if (s.metric) {
      const metric = document.createElement('span');
      metric.textContent = s.metric;
      metric.style.cssText = external
        ? `flex:0 0 auto;font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;` +
          `font-size:${fontSize}px;color:${theme.text};text-align:right;`
        : `font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;` +
          `font-size:${fontSize}px;color:${theme.text};`;
      row.appendChild(metric);
    }
    row.appendChild(btn);
    return row;
  }

  /** Bare eye-only button placed next to the title for single-series panels. */
  private makeBareToggle(seriesId: string, s: IndicatorSeries, theme: ThemeTokens, _fontSize: number): HTMLElement {
    return this.makeEyeButton(s.hidden ?? false, theme, () => this.toggleSeriesVisibility(seriesId));
  }

  /** Bare eye-only button that collapses/expands the entire pane. */
  private makeCollapseToggle(theme: ThemeTokens, _fontSize: number): HTMLElement {
    return this.makeEyeButton(this.collapsed, theme, () => this.togglePaneCollapsed(), this.collapsed ? 'Expand pane' : 'Collapse pane');
  }

  private makeEyeButton(off: boolean, theme: ThemeTokens, onClick: () => void, titleText?: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = titleText ?? (off ? 'Show' : 'Hide');
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-pressed', off ? 'true' : 'false');
    btn.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;padding:0;margin:0;border:0;background:transparent;color:${theme.textDim};cursor:pointer;border-radius:3px;`;
    btn.innerHTML = off ? EYE_OFF_SVG : EYE_ON_SVG;
    btn.addEventListener('mouseenter', () => { btn.style.color = theme.text; });
    btn.addEventListener('mouseleave', () => { btn.style.color = theme.textDim; });
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onClick();
    });
    return btn;
  }

  private toggleSeriesVisibility(seriesId: string) {
    const target = findLegendSeries(this.spec, seriesId);
    if (!target) return;
    target.hidden = !target.hidden;
    // Force the next syncLegend to rebuild this row (state changed).
    this.legendEl.dataset['sig'] = '';
    this.hooks.onLegendToggle?.(this.spec.id, seriesId, !!target.hidden);
    this.hooks.requestRedraw?.();
  }

  private togglePaneCollapsed() {
    this.collapsed = !this.collapsed;
    this.legendEl.dataset['sig'] = '';
    this.hooks.onCollapseToggle?.(this.spec.id, this.collapsed);
    this.hooks.requestRedraw?.();
  }

  destroy() {
    this.legendEl.remove();
    this.el.remove();
  }
}

const EYE_ON_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>';
const EYE_OFF_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5C1.6 6.6 1 8 1 8s2.5 4.5 7 4.5c1.4 0 2.6-.3 3.7-.8M6.2 4c.6-.1 1.2-.2 1.8-.2 4.5 0 7 4.2 7 4.2s-.7 1.2-2 2.4"/><path d="M6.5 6.5a2 2 0 0 0 2.8 2.8"/><path d="M2 14L14 2"/></svg>';

interface LegendEntry { id: string; series: IndicatorSeries }

function collectLegendSeries(spec: PanelSpec): LegendEntry[] {
  const out: LegendEntry[] = [];
  if (spec.kind === 'indicator' && spec.indicator) {
    out.push({ id: seriesIdFor(spec.indicator, 'main'), series: spec.indicator });
  }
  if (spec.overlays) {
    spec.overlays.forEach((o, i) => {
      out.push({ id: seriesIdFor(o, `overlay-${i}`), series: o });
    });
  }
  return out;
}

function findLegendSeries(spec: PanelSpec, seriesId: string): IndicatorSeries | undefined {
  return collectLegendSeries(spec).find((e) => e.id === seriesId)?.series;
}

function seriesIdFor(s: IndicatorSeries, fallback: string): string {
  return s.id ?? s.label ?? fallback;
}

function mkCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:absolute;inset:0;display:block;';
  return c;
}

function mkLegend(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'finterion-legend';
  // z-index 12 sits above panelsContainer's eventSurface (10) and rightAxis
  // (11) so the eye-toggle buttons receive clicks. pointer-events:auto on the
  // legend itself, while leaving the rest of the panel area clickable for
  // pan/zoom (since the legend is a small, narrowly-positioned element).
  el.style.cssText = 'position:absolute;display:none;flex-direction:column;gap:2px;z-index:12;pointer-events:auto;';
  return el;
}
