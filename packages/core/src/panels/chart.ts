import type { ChartOptions, OHLCBuffer, PanelSpec, ThemeTokens, TradeMarker, Viewport } from '../types';
import { resolveTheme } from '../themes';
import { Panel, isTimePanel } from './panel';
import { attachPanZoom } from '../interactions/panZoom';
import { xCenter } from '../renderers/layout';
import type { TitleStyle } from '../renderers/grid';
import { computeTimeTicks, drawTimeAxis } from '../renderers/grid';
import type { GridStyle } from '../renderers/grid';

export class Chart {
  private container: HTMLElement;
  private root: HTMLDivElement;
  private panelsContainer: HTMLDivElement;
  private eventSurface: HTMLDivElement;
  private rightAxis: HTMLDivElement;
  private bottomAxis: HTMLDivElement;
  private timeAxisCanvas: HTMLCanvasElement;
  private timeAxisCtx: CanvasRenderingContext2D;
  private theme: ThemeTokens;
  private panels: Panel[] = [];
  private buf: OHLCBuffer | null = null;
  private markers: TradeMarker[] = [];
  private viewport: Viewport = { startIdx: 0, endIdx: 0 };
  private hoverIdx = -1;
  private hoverY = -1;
  private hoverPanel = -1;
  private dpr = 1;
  private dirty = { base: true, series: true, overlay: true };
  private rafQueued = false;
  private resizeObserver: ResizeObserver | null = null;
  private detachPanZoom: (() => void) | null = null;
  private panelGap = 0;
  private titleStyle: TitleStyle = {};
  private titleSpace = 0;
  private showTimeAxis = true;
  private gridStyle: GridStyle = 'horizontal';
  private background: string | undefined;
  private gridColor: string | undefined;
  private effectiveTheme: ThemeTokens;
  private static TIME_AXIS_HEIGHT = 28;

  constructor(container: HTMLElement, options: ChartOptions = {}) {
    this.container = container;
    this.theme = resolveTheme(options.theme);
    this.effectiveTheme = this.theme;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:' +
      this.theme.bg +
      ';color:' + this.theme.text + ';font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;border-radius:12px;';

    this.panelsContainer = document.createElement('div');
    this.panelsContainer.style.cssText = 'position:relative;flex:1 1 0;min-height:0;display:flex;flex-direction:column;';

    this.eventSurface = document.createElement('div');
    this.eventSurface.style.cssText = 'position:absolute;top:0;left:0;right:56px;bottom:0;z-index:10;cursor:crosshair;';

    this.rightAxis = document.createElement('div');
    this.rightAxis.style.cssText = 'position:absolute;top:0;right:0;bottom:0;width:56px;z-index:11;cursor:ns-resize;';
    this.rightAxis.title = 'Drag to zoom Y · double-click to reset';

    this.bottomAxis = document.createElement('div');
    this.bottomAxis.style.cssText = `position:relative;flex:0 0 ${Chart.TIME_AXIS_HEIGHT}px;cursor:ew-resize;`;
    this.bottomAxis.title = 'Drag to zoom X · double-click to reset';

    this.timeAxisCanvas = document.createElement('canvas');
    this.timeAxisCanvas.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:block;pointer-events:none;';
    this.timeAxisCtx = this.timeAxisCanvas.getContext('2d')!;
    this.bottomAxis.appendChild(this.timeAxisCanvas);

    container.appendChild(this.root);
    this.root.appendChild(this.panelsContainer);
    this.root.appendChild(this.bottomAxis);
    this.panelsContainer.appendChild(this.eventSurface);
    this.panelsContainer.appendChild(this.rightAxis);

    if (options.panels) this.setPanels(options.panels);
    if (options.markers) this.markers = options.markers;
    if (options.viewport) this.viewport = options.viewport;
    this.applyDisplayOptions(options);

    this.attachEvents();
    this.observeResize();
  }

  setData(buf: OHLCBuffer) {
    const wasFollowing = this.viewport.endIdx >= (this.buf?.length ?? 1) - 1;
    this.buf = buf;
    if (this.viewport.endIdx === 0 && this.viewport.startIdx === 0) {
      const span = Math.min(200, buf.length - 1);
      this.viewport = { startIdx: Math.max(0, buf.length - 1 - span), endIdx: buf.length - 1 };
    } else if (wasFollowing) {
      const span = this.viewport.endIdx - this.viewport.startIdx;
      this.viewport = { startIdx: Math.max(0, buf.length - 1 - span), endIdx: buf.length - 1 };
    }
    this.markDirty('series', 'base');
  }

  setPanels(panels: PanelSpec[]) {
    for (const p of this.panels) p.destroy();
    this.panels = panels.map((s) => new Panel(s));
    for (const p of this.panels) this.panelsContainer.appendChild(p.el);
    // Move event surface + axes to top within panelsContainer.
    this.panelsContainer.appendChild(this.eventSurface);
    this.panelsContainer.appendChild(this.rightAxis);
    this.applyPanelGap();
    this.applyTitleSpace();
    this.applyTimeAxisVisibility();
    this.markDirty('base', 'series', 'overlay');
    this.requestResize();
  }

  /** Update display options (panel gap, title styling) at runtime. */
  setDisplayOptions(options: Pick<ChartOptions, 'panelGap' | 'titleColor' | 'titlePadding' | 'titleFontSize' | 'titleSpace' | 'showTimeAxis' | 'gridStyle' | 'background' | 'gridColor'>) {
    this.applyDisplayOptions(options);
    this.markDirty('base');
    this.requestResize();
  }

  private applyDisplayOptions(options: ChartOptions) {
    if (options.panelGap !== undefined) this.panelGap = options.panelGap;
    if (options.titleSpace !== undefined) this.titleSpace = options.titleSpace;
    if (options.showTimeAxis !== undefined) this.showTimeAxis = options.showTimeAxis;
    if (options.gridStyle !== undefined) this.gridStyle = options.gridStyle;
    if (options.background !== undefined) this.background = options.background;
    if (options.gridColor !== undefined) this.gridColor = options.gridColor;
    const next: TitleStyle = { ...this.titleStyle };
    if (options.titleColor !== undefined) next.color = options.titleColor;
    if (options.titleFontSize !== undefined) next.fontSize = options.titleFontSize;
    if (options.titlePadding !== undefined) {
      if (options.titlePadding.top !== undefined) next.paddingTop = options.titlePadding.top;
      if (options.titlePadding.left !== undefined) next.paddingLeft = options.titlePadding.left;
    }
    this.titleStyle = next;
    this.recomputeEffectiveTheme();
    this.applyBackground();
    this.applyPanelGap();
    this.applyTitleSpace();
    this.applyTimeAxisVisibility();
  }

  private recomputeEffectiveTheme() {
    this.effectiveTheme = {
      ...this.theme,
      ...(this.gridColor !== undefined ? { grid: this.gridColor } : {}),
      ...(this.background !== undefined ? { bg: this.background } : {}),
    };
  }

  private applyBackground() {
    this.root.style.background = this.background ?? this.theme.bg;
  }

  private applyPanelGap() {
    for (let i = 0; i < this.panels.length; i++) {
      this.panels[i]!.el.style.marginTop = i === 0 ? '0' : `${this.panelGap}px`;
    }
  }

  private applyTitleSpace() {
    for (const p of this.panels) p.headerHeight = this.titleSpace;
  }

  private applyTimeAxisVisibility() {
    const hasTime = this.hasTimePanel();
    this.bottomAxis.style.display = (this.showTimeAxis && hasTime) ? 'block' : 'none';
    this.rightAxis.style.display = hasTime ? 'block' : 'none';
    this.eventSurface.style.display = hasTime ? 'block' : 'none';
    this.eventSurface.style.right = hasTime ? '56px' : '0';
  }

  private hasTimePanel(): boolean {
    return this.panels.some((p) => isTimePanel(p.spec.kind));
  }

  updatePanel(id: string, partial: Partial<PanelSpec>) {
    const p = this.panels.find((x) => x.spec.id === id);
    if (!p) return;
    p.spec = { ...p.spec, ...partial };
    this.markDirty('series', 'base');
  }

  setMarkers(markers: TradeMarker[]) {
    this.markers = markers;
    this.markDirty('series');
  }

  setTheme(theme: ChartOptions['theme']) {
    this.theme = resolveTheme(theme);
    this.recomputeEffectiveTheme();
    this.applyBackground();
    this.root.style.color = this.theme.text;
    this.markDirty('base', 'series', 'overlay');
  }

  setViewport(vp: Viewport) {
    this.viewport = vp;
    this.markDirty('base', 'series', 'overlay');
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  destroy() {
    this.detachPanZoom?.();
    this.resizeObserver?.disconnect();
    for (const p of this.panels) p.destroy();
    this.root.remove();
  }

  // ---- internals ----

  private attachEvents() {
    this.detachPanZoom = attachPanZoom(this.eventSurface, {
      getDataLength: () => this.buf?.length ?? 0,
      getViewport: () => this.viewport,
      setViewport: (vp) => this.setViewport(vp),
      getWidth: () => this.eventSurface.getBoundingClientRect().width,
    });

    this.eventSurface.addEventListener('pointermove', (e) => this.onMove(e));
    this.eventSurface.addEventListener('pointerleave', () => {
      this.hoverIdx = -1;
      this.hoverY = -1;
      this.hoverPanel = -1;
      this.markDirty('overlay');
    });

    this.attachAxisDrag(this.rightAxis, 'y');
    this.attachAxisDrag(this.bottomAxis, 'x');
    this.rightAxis.addEventListener('dblclick', () => {
      for (const p of this.panels) p.yScale = 1;
      this.markDirty('base', 'series');
    });
    this.bottomAxis.addEventListener('dblclick', () => {
      const n = this.buf?.length ?? 0;
      if (!n) return;
      const span = Math.min(200, n - 1);
      this.setViewport({ startIdx: Math.max(0, n - 1 - span), endIdx: n - 1 });
    });
  }

  private attachAxisDrag(target: HTMLElement, axis: 'x' | 'y') {
    let dragging = false;
    let startCoord = 0;
    let startSpan = 0;
    let startVp: Viewport = { startIdx: 0, endIdx: 0 };
    let startScale = 1;
    let panelIdx = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      target.setPointerCapture(e.pointerId);
      if (axis === 'x') {
        startCoord = e.clientX;
        startVp = { ...this.viewport };
        startSpan = startVp.endIdx - startVp.startIdx;
      } else {
        startCoord = e.clientY;
        const rect = target.getBoundingClientRect();
        const y = e.clientY - rect.top;
        // Find which panel this y falls in.
        let acc = 0;
        panelIdx = 0;
        for (let i = 0; i < this.panels.length; i++) {
          const h = this.panels[i]!.height;
          if (y >= acc && y <= acc + h) { panelIdx = i; break; }
          acc += h;
        }
        startScale = this.panels[panelIdx]?.yScale ?? 1;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      if (axis === 'x') {
        const dx = e.clientX - startCoord;
        // Drag right shrinks the visible window (zoom in); drag left expands (zoom out).
        const factor = Math.exp(dx / 200);
        const newSpan = Math.max(10, Math.min((this.buf?.length ?? 1) - 1, Math.round(startSpan * factor)));
        const endIdx = startVp.endIdx;
        const startIdx = Math.max(0, endIdx - newSpan);
        this.setViewport({ startIdx, endIdx });
      } else {
        const dy = e.clientY - startCoord;
        // Drag down expands range (zoom out); drag up compresses (zoom in).
        const factor = Math.exp(dy / 200);
        const newScale = Math.max(0.05, Math.min(20, startScale * factor));
        const p = this.panels[panelIdx];
        if (p) {
          p.yScale = newScale;
          this.markDirty('base', 'series');
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try { target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    target.addEventListener('pointerdown', onDown);
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  private onMove(e: PointerEvent) {
    if (!this.buf) return;
    const rect = this.eventSurface.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const span = this.viewport.endIdx - this.viewport.startIdx + 1;
    const band = rect.width / span;
    const idx = Math.round(this.viewport.startIdx + (x - band / 2) / band);
    this.hoverIdx = Math.max(0, Math.min(this.buf.length - 1, idx));
    this.hoverY = y;

    let acc = 0;
    this.hoverPanel = 0;
    for (let i = 0; i < this.panels.length; i++) {
      const h = this.panels[i]!.height;
      if (y >= acc && y <= acc + h) { this.hoverPanel = i; break; }
      acc += h;
    }
    this.markDirty('overlay');
  }

  private observeResize() {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.requestResize());
    this.resizeObserver.observe(this.root);
  }

  private requestResize() {
    this.markDirty('base', 'series', 'overlay');
    this.scheduleDraw();
  }

  private markDirty(...layers: ('base' | 'series' | 'overlay')[]) {
    for (const l of layers) this.dirty[l] = true;
    this.scheduleDraw();
  }

  private scheduleDraw() {
    if (this.rafQueued) return;
    this.rafQueued = true;
    if (typeof requestAnimationFrame === 'undefined') {
      this.draw();
      this.rafQueued = false;
      return;
    }
    requestAnimationFrame(() => {
      this.rafQueued = false;
      this.draw();
    });
  }

  private draw() {
    if (!this.panels.length) return;
    let resized = false;
    for (const p of this.panels) if (p.resize(this.dpr)) resized = true;
    this.resizeTimeAxis();
    if (resized) this.dirty = { base: true, series: true, overlay: true };

    for (const p of this.panels) p.computeRange(this.buf, this.viewport);

    if (this.dirty.base) {
      // Compute vertical tick xs (in CSS px relative to panel canvas width)
      // once per base draw, used for `gridStyle: 'full'` and the time axis.
      const verticalXs = this.hasTimePanel() ? this.computeVerticalGridXs() : [];
      for (const p of this.panels) p.drawBase(this.effectiveTheme, this.viewport, this.titleStyle, this.gridStyle, verticalXs);
      this.drawTimeAxisCanvas();
    }
    if (this.dirty.series) {
      for (const p of this.panels) p.drawSeries(this.effectiveTheme, this.viewport, this.buf, this.markers);
    }
    if (this.dirty.overlay || this.dirty.series) {
      for (let i = 0; i < this.panels.length; i++) {
        const p = this.panels[i]!;
        const cross = { idx: this.hoverIdx, y: this.hoverPanel === i ? this.hoverY - this.panelTop(i) : -1 };
        const tooltip = i === 0 && this.hoverIdx >= 0 ? this.buildTooltip() : null;
        p.drawOverlay(this.effectiveTheme, this.viewport, cross, tooltip);
      }
    }
    this.dirty = { base: false, series: false, overlay: false };
    void xCenter;
  }

  private resizeTimeAxis() {
    if (!this.showTimeAxis || !this.hasTimePanel()) return;
    // Measure the *parent* (bottomAxis), not the canvas itself — once we set
    // canvas.style.width explicitly, getBoundingClientRect on the canvas would
    // return that pinned width forever and the canvas would never grow with
    // the container.
    const rect = this.bottomAxis.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    const w = Math.max(1, Math.round(cssW * this.dpr));
    const h = Math.max(1, Math.round(cssH * this.dpr));
    if (this.timeAxisCanvas.width !== w || this.timeAxisCanvas.height !== h) {
      this.timeAxisCanvas.width = w;
      this.timeAxisCanvas.height = h;
      this.timeAxisCanvas.style.width = cssW + 'px';
      this.timeAxisCanvas.style.height = cssH + 'px';
      this.timeAxisCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.dirty.base = true;
    }
  }

  private drawTimeAxisCanvas() {
    if (!this.showTimeAxis || !this.buf || !this.hasTimePanel()) return;
    const cssW = this.timeAxisCanvas.width / this.dpr;
    const cssH = this.timeAxisCanvas.height / this.dpr;
    drawTimeAxis(
      this.timeAxisCtx,
      cssW,
      cssH,
      this.viewport,
      this.buf.time,
      this.effectiveTheme,
    );
  }

  /**
   * Compute the x positions (CSS px relative to the first panel's canvas
   * width) of the time-axis ticks. Used to anchor vertical grid lines so they
   * line up exactly with the time-axis labels.
   */
  private computeVerticalGridXs(): number[] {
    if (!this.buf || this.gridStyle !== 'full' || this.panels.length === 0) return [];
    const refWidth = this.panels[0]!.width;
    if (refWidth <= 0) return [];
    return computeTimeTicks(this.viewport, this.buf.time, refWidth).map((t) => t.x);
  }

  private panelTop(idx: number): number {
    let acc = 0;
    for (let i = 0; i < idx; i++) acc += this.panels[i]!.height;
    return acc;
  }

  private buildTooltip(): string[] {
    if (!this.buf || this.hoverIdx < 0) return [];
    const i = this.hoverIdx;
    const t = new Date(this.buf.time[i]!);
    const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const lines = [
      t.toISOString().replace('T', ' ').slice(0, 16),
      `O ${fmt(this.buf.open[i]!)}   H ${fmt(this.buf.high[i]!)}`,
      `L ${fmt(this.buf.low[i]!)}   C ${fmt(this.buf.close[i]!)}`,
    ];
    return lines;
  }
}

export function createChart(container: HTMLElement, options?: ChartOptions): Chart {
  return new Chart(container, options);
}
