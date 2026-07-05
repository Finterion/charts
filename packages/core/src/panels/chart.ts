import type { BrandingOptions, ChartOptions, OHLCBuffer, PanelSpec, ThemeTokens, TradeMarker, Viewport } from '../types';
import { resolveTheme } from '../themes';
import { Panel, isTimePanel, type LegendMode, type PanelHooks } from './panel';
import { attachPanZoom } from '../interactions/panZoom';
import { xCenter } from '../renderers/layout';
import type { TitleStyle } from '../renderers/grid';
import { computeTimeTicks, drawTimeAxis, resolveTimeFormatter } from '../renderers/grid';
import type { GridStyle } from '../renderers/grid';

/**
 * Default Finterion brand mark + wordmark used by the "Powered by" badge.
 *
 * The geometric mark on the left keeps its blue/yellow gradients (works on any
 * background). The wordmark uses `fill="currentColor"` so it inherits the
 * badge `color` option and adapts to dark vs. light themes automatically.
 */
const DEFAULT_FINTERION_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1522.56 312.4" width="78" height="16" aria-label="Finterion" style="display:block;flex:none">' +
  '<defs>' +
  '<linearGradient id="fcm1" x1="0" y1="75.89" x2="215.29" y2="75.89" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0052ff"/><stop offset="1" stop-color="#009eff"/></linearGradient>' +
  '<linearGradient id="fcm2" x1="0" y1="205.31" x2="174.51" y2="205.31" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0052ff"/><stop offset="1" stop-color="#009eff"/></linearGradient>' +
  '<linearGradient id="fcy1" x1="14.24" y1="290.09" x2="14.28" y2="290.09" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#dba203"/><stop offset="1" stop-color="#ffc000"/></linearGradient>' +
  '<linearGradient id="fcy2" x1="10.68" y1="272.08" x2="97.5" y2="272.08" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#dba203"/><stop offset="1" stop-color="#ffc000"/></linearGradient>' +
  '</defs>' +
  '<g fill="currentColor">' +
  '<path d="M426.55,66.95v-22.71h-136.36v232.84h38.25v-94.48h80.88c7.68,0,13.91-6.23,13.91-13.91v-22.66h-94.78v-65.19h84.21c7.68,0,13.91-6.23,13.91-13.91Z"/>' +
  '<path d="M453.49,110.76v166.32h35.9V110.76h-35.9ZM487.74,46.91c-4.45-4.66-9.88-6.96-16.33-6.96s-11.83,2.3-16.28,6.96c-4.46,4.45-6.66,9.78-6.66,15.98s2.2,11.62,6.66,16.28c4.66,4.45,10.09,6.66,16.28,6.66s11.52-2.2,15.98-6.66c4.66-4.66,6.96-10.09,6.96-16.28s-2.2-11.52-6.61-15.98Z"/>' +
  '<path d="M652.72,124.9c-11.62-12.29-27.09-18.43-46.39-18.43-23.3,0-40.45,8.55-51.56,25.6v-21.3h-35.9v166.32h35.9v-89.15c0-15.72,3.79-27.65,11.32-35.74,7.53-8.09,17.87-12.14,30.93-12.14,11.52,0,20.64,3.33,27.29,9.99,6.66,6.66,9.99,16.18,9.99,28.57v98.47h35.9v-102.11c0-21.1-5.84-37.74-17.46-50.08Z"/>' +
  '<path d="M976.14,194.23c0-24.37-7.83-45.11-23.61-62.17-15.72-17.05-35.69-25.6-59.86-25.6-25.96,0-47.01,8.4-63.19,25.24-16.44,16.9-24.63,37.59-24.63,62.22s8.35,46.24,24.99,62.88c16.85,16.39,38.66,24.58,65.49,24.58,32.36,0,56.63-12.08,72.82-36.25l-29.6-17.31c-9.73,13.77-24.07,20.64-42.91,20.64-13.93,0-25.65-3.43-35.08-10.29-9.42-6.86-15.46-16.54-18.13-28.93h132.37c.87-5.53,1.33-10.55,1.33-15ZM842.13,179.94c2.41-12.65,8.09-22.58,16.95-29.9,8.86-7.32,19.97-11.01,33.23-11.01,12.24,0,22.58,3.58,31.13,10.65,8.5,7.12,14.03,17.21,16.44,30.26h-97.75Z"/>' +
  '<path d="M1037.02,138.72v-27.96h-35.95v166.32h35.95v-83.83c0-17.05,5.07-29.29,15.26-36.56,10.45-7.58,22.17-9.99,35.95-9.99v-35.95c-25.04,0-42.14,7.32-51.21,27.96Z"/>' +
  '<path d="M1108.2,110.76v166.32h35.9V110.76h-35.9ZM1142.41,46.91c-4.4-4.66-9.83-6.96-16.28-6.96s-11.83,2.3-16.28,6.96c-4.46,4.45-6.66,9.78-6.66,15.98s2.2,11.62,6.66,16.28c4.66,4.45,10.09,6.66,16.28,6.66s11.52-2.2,15.98-6.66c4.66-4.66,6.96-10.09,6.96-16.28s-2.2-11.52-6.66-15.98Z"/>' +
  '<path d="M1319.68,131.71c-16.85-16.85-37.58-25.24-62.16-25.24s-45.37,8.4-62.22,25.24c-17.05,17.1-25.6,37.84-25.6,62.22s8.55,45.11,25.6,62.22c16.85,16.85,37.59,25.24,62.22,25.24s45.32-8.4,62.16-25.24c17.1-17.1,25.6-37.84,25.6-62.22s-8.5-45.11-25.6-62.22ZM1294.44,231.51c-9.99,9.99-22.33,14.95-36.92,14.95s-26.93-4.97-36.92-14.95c-9.99-9.99-15-22.53-15-37.59s5.02-27.6,15-37.59c9.99-9.99,22.28-14.95,36.92-14.95s26.93,4.97,36.92,14.95c9.93,9.99,14.95,22.53,14.95,37.59s-5.02,27.6-14.95,37.59Z"/>' +
  '<path d="M1505.1,124.9c-11.62-12.29-27.09-18.43-46.39-18.43-23.3,0-40.45,8.55-51.56,25.6v-21.3h-35.9v166.32h35.9v-89.15c0-15.72,3.79-27.65,11.32-35.74,7.53-8.09,17.87-12.14,30.93-12.14,11.52,0,20.64,3.33,27.29,9.99,6.66,6.66,9.99,16.18,9.99,28.57v98.47h35.9v-102.11c0-21.1-5.84-37.74-17.46-50.08Z"/>' +
  '<path d="M794.92,110.76h-41.27v-46.55l-35.9,10.65v35.9h-30.62v34.62h93.88c7.68,0,13.91-6.23,13.91-13.91v-20.71Z"/>' +
  '<path d="M753.64,145.38l-35.9,10.82v69.01c0,21.71,5.99,36.61,17.97,44.7,11.93,8.09,31.7,10.5,59.19,7.17v-32.26c-9.11.41-16.69.46-22.79.15-6.09-.36-10.7-2-13.83-5.02-3.12-2.97-4.66-7.89-4.66-14.75v-79.83Z"/>' +
  '</g>' +
  '<path fill="url(#fcm1)" d="M215.29,0v75.78c0,7.65-5.04,14.38-12.38,16.53L0,151.77v-75.78c0-7.65,5.04-14.38,12.38-16.53L215.29,0Z"/>' +
  '<path fill="url(#fcm2)" d="M12.39,168.02c-7.34,2.15-12.39,8.88-12.39,16.53v80.48c0,10.45,5.57,19.88,14.24,25.04-7.82-18.36-4.58-33.26,28-42.13l55.25-16.18,64.62-18.91c7.34-2.15,12.39-8.88,12.39-16.54v-75.78L12.39,168.02Z"/>' +
  '<path fill="url(#fcy1)" d="M14.25,290.09l.04.02s-.03-.02-.04-.03c0,0,0,0,0,.01Z"/>' +
  '<path fill="url(#fcy2)" d="M42.25,247.95c-32.57,8.87-35.82,23.75-28.02,42.1l.05.05h0c4.44,1.93,8.99,3.58,13.63,4.94l57.94,16.97c5.82,1.71,11.65-2.66,11.65-8.72v-71.53l-55.25,16.18Z"/>' +
  '</svg>';

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
  private interactive = true;
  private timeFormatter: ((t: number) => string) | undefined = undefined;
  private panelGap = 0;
  private titleStyle: TitleStyle = {};
  private titleSpace = 0;
  private showTimeAxis = true;
  private gridStyle: GridStyle = 'horizontal';
  private background: string | undefined;
  private gridColor: string | undefined;
  private effectiveTheme: ThemeTokens;
  private legendMode: LegendMode = 'auto';
  private legendPosition: 'overlay' | 'right' | 'bottom' = 'overlay';
  private legendWidth = 200;
  private legendMaxHeight = 120;
  private legendSidebar: HTMLDivElement;
  private chartCol: HTMLDivElement;
  private initialFit: 'recent' | 'all' = 'recent';
  /** Initial viewport as a percentage of the buffer (`(0, 100]`). `undefined` = fall back to `initialFit`. */
  private initialZoom: number | undefined = undefined;
  /** "Powered by Finterion" attribution badge element. `null` when hidden. */
  private brandingEl: HTMLAnchorElement | HTMLDivElement | null = null;
  /** Dedicated row below the time axis that hosts the badge. `null` when hidden. */
  private brandingRow: HTMLDivElement | null = null;
  /** Resolved branding config; `null` means hidden. */
  private branding: BrandingOptions | null = {};
  private onSeriesVisibilityChange: ChartOptions['onSeriesVisibilityChange'];
  private onPaneCollapseChange: ChartOptions['onPaneCollapseChange'];
  private static TIME_AXIS_HEIGHT = 28;
  /** Height (in px) a collapsed pane occupies — just enough for the title row + toggle. */
  private static COLLAPSED_PANE_HEIGHT = 28;

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

    // Inner column that holds the panels and the bottom time axis. The
    // sidebar (for `legendPosition: 'right' | 'bottom'`) is rendered as a
    // sibling of this column inside `root`.
    this.chartCol = document.createElement('div');
    this.chartCol.style.cssText = 'position:relative;flex:1 1 0;min-width:0;min-height:0;display:flex;flex-direction:column;';

    this.legendSidebar = document.createElement('div');
    this.legendSidebar.className = 'finterion-legend-sidebar';
    // Hidden by default; activated by `applyLegendPosition()` when needed.
    this.legendSidebar.style.cssText = 'display:none;';

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
    this.root.appendChild(this.chartCol);
    this.root.appendChild(this.legendSidebar);
    this.chartCol.appendChild(this.panelsContainer);
    this.chartCol.appendChild(this.bottomAxis);
    this.panelsContainer.appendChild(this.eventSurface);
    this.panelsContainer.appendChild(this.rightAxis);

    if (options.initialFit) this.initialFit = options.initialFit;
    if (options.initialZoom !== undefined && Number.isFinite(options.initialZoom) && options.initialZoom > 0) {
      // Clamp to (0, 100] — a percentage of the buffer to show.
      this.initialZoom = Math.min(100, options.initialZoom);
    }
    if (options.panels) this.setPanels(options.panels);
    if (options.markers) this.markers = options.markers;
    if (options.viewport) this.viewport = options.viewport;
    this.applyDisplayOptions(options);
    this.applyBranding(options.branding);
    if (options.interactive === false) {
      this.interactive = false;
      this.eventSurface.style.cursor = 'default';
    }
    if (options.timeFormat !== undefined) {
      this.timeFormatter = resolveTimeFormatter(options.timeFormat);
    }

    this.attachEvents();
    this.observeResize();
  }

  setData(buf: OHLCBuffer) {
    const wasFollowing = this.viewport.endIdx >= (this.buf?.length ?? 1) - 1;
    this.buf = buf;
    if (this.viewport.endIdx === 0 && this.viewport.startIdx === 0) {
      let span: number;
      if (this.initialZoom !== undefined) {
        // Percentage-of-buffer semantics: 100 = all bars, 50 = last half, etc.
        span = Math.max(1, Math.min(buf.length - 1, Math.round((buf.length - 1) * this.initialZoom / 100)));
      } else {
        span = this.initialFit === 'all'
          ? buf.length - 1
          : Math.min(200, buf.length - 1);
      }
      this.viewport = { startIdx: Math.max(0, buf.length - 1 - span), endIdx: buf.length - 1 };
    } else if (wasFollowing) {
      const span = this.viewport.endIdx - this.viewport.startIdx;
      this.viewport = { startIdx: Math.max(0, buf.length - 1 - span), endIdx: buf.length - 1 };
    }
    this.markDirty('series', 'base');
  }

  setPanels(panels: PanelSpec[]) {
    for (const p of this.panels) p.destroy();
    this.panels = panels.map((s, i) => {
      const panel = new Panel(s);
      panel.hooks = this.makePanelHooks(i);
      return panel;
    });
    for (const p of this.panels) this.panelsContainer.appendChild(p.el);
    // Move event surface + axes to top within panelsContainer.
    this.panelsContainer.appendChild(this.eventSurface);
    this.panelsContainer.appendChild(this.rightAxis);
    // Reparent legends into whichever host the current legendPosition wants.
    this.attachLegends();
    this.applyPanelGap();
    this.applyTitleSpace();
    this.applyCollapsedFlex();
    this.applyTimeAxisVisibility();
    this.markDirty('base', 'series', 'overlay');
    this.requestResize();
  }

  /**
   * Configure the legend sidebar (right/bottom) or hide it (overlay) and
   * place each panel's legend element into the right host.
   */
  private applyLegendPosition() {
    if (this.legendPosition === 'right') {
      this.root.style.flexDirection = 'row';
      this.legendSidebar.style.cssText =
        `display:flex;flex:0 0 ${this.legendWidth}px;min-width:0;` +
        `flex-direction:column;gap:8px;padding:12px 12px 12px 16px;` +
        `border-left:1px solid ${this.theme.grid};` +
        `overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;` +
        `color:${this.theme.textDim};font-size:11px;`;
    } else if (this.legendPosition === 'bottom') {
      this.root.style.flexDirection = 'column';
      this.legendSidebar.style.cssText =
        `display:flex;flex:0 0 auto;max-height:${this.legendMaxHeight}px;` +
        `flex-direction:column;gap:6px;padding:10px 16px;` +
        `border-top:1px solid ${this.theme.grid};` +
        `overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;` +
        `color:${this.theme.textDim};font-size:11px;`;
    } else {
      this.root.style.flexDirection = 'column';
      this.legendSidebar.style.display = 'none';
      this.legendSidebar.replaceChildren();
    }
    this.attachLegends();
  }

  /**
   * Reparent each `panel.legendEl` to the right host depending on
   * `legendPosition`. Idempotent — safe to call after panels change or after
   * the position changes.
   *
   * In external mode we only render section headings when there are 2+ panels
   * — for the common single-panel case the surrounding card header already
   * describes what the chart is, and a duplicate heading just adds noise.
   */
  private attachLegends() {
    if (this.legendPosition === 'overlay' || !this.panels.length) {
      // Overlay legends live ABOVE the event surface so toggle clicks land
      // on the buttons rather than starting a pan.
      for (const p of this.panels) this.panelsContainer.appendChild(p.legendEl);
      return;
    }
    this.legendSidebar.replaceChildren();
    const showHeadings = this.panels.length > 1;
    this.panels.forEach((p, i) => {
      const section = document.createElement('div');
      section.className = 'finterion-legend-section';
      section.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;';
      if (showHeadings && p.spec.title) {
        const heading = document.createElement('div');
        heading.textContent = p.spec.title;
        heading.style.cssText =
          'font-family:"JetBrains Mono",ui-monospace,monospace;' +
          'font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;' +
          `color:${this.theme.textDim};margin:${i === 0 ? '0' : '8px'} 0 4px;`;
        section.appendChild(heading);
      }
      section.appendChild(p.legendEl);
      this.legendSidebar.appendChild(section);
    });
  }

  /** Update display options (panel gap, title styling) at runtime. */
  setDisplayOptions(options: Pick<ChartOptions, 'panelGap' | 'titleColor' | 'titlePadding' | 'titleFontSize' | 'titleSpace' | 'showTimeAxis' | 'gridStyle' | 'background' | 'gridColor' | 'showLegend' | 'legendPosition' | 'legendWidth' | 'legendMaxHeight' | 'onSeriesVisibilityChange' | 'onPaneCollapseChange'>) {
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
    if (options.showLegend !== undefined) this.legendMode = options.showLegend;
    if (options.legendPosition !== undefined) this.legendPosition = options.legendPosition;
    if (options.legendWidth !== undefined) this.legendWidth = options.legendWidth;
    if (options.legendMaxHeight !== undefined) this.legendMaxHeight = options.legendMaxHeight;
    this.applyLegendPosition();
    if (options.onSeriesVisibilityChange !== undefined) {
      this.onSeriesVisibilityChange = options.onSeriesVisibilityChange;
    }
    if (options.onPaneCollapseChange !== undefined) {
      this.onPaneCollapseChange = options.onPaneCollapseChange;
    }
    if (options.onSeriesVisibilityChange !== undefined || options.onPaneCollapseChange !== undefined) {
      // Re-bind hooks on existing panels so they pick up the new callback.
      this.rebindPanelHooks();
    }
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
    // Re-render the badge so its color tracks the current theme (unless the
    // user pinned an explicit `color` in the branding config).
    if (this.branding) this.applyBranding(this.branding);
  }

  /**
   * Render (or remove) the "Powered by Finterion" attribution badge.
   *
   * Pass `false` to hide. The opt-out is honor-system: removing the badge
   * is permitted only under the trademark policy in the LICENSE.
   */
  private applyBranding(input: ChartOptions['branding']) {
    // Resolve config.
    if (input === false) {
      this.branding = null;
    } else if (input === undefined || input === true) {
      this.branding = {};
    } else {
      this.branding = { ...input };
    }

    // Tear down existing badge if present.
    if (this.brandingEl) {
      this.brandingEl.remove();
      this.brandingEl = null;
    }
    if (this.brandingRow) {
      this.brandingRow.remove();
      this.brandingRow = null;
    }
    if (!this.branding) return;

    const cfg = this.branding;
    const text = cfg.text ?? 'Powered by';
    const svgOrName = cfg.svg ?? DEFAULT_FINTERION_LOGO_SVG;
    const href = cfg.href === undefined ? 'https://finterion.com' : cfg.href;
    const position = cfg.position ?? 'bottom-left';
    const opacity = cfg.opacity ?? 1;
    const color = cfg.color ?? this.effectiveTheme.textDim;

    // The badge lives in its own dedicated row below the time axis so it
    // never overlaps chart data or axis labels. The `position` enum is
    // collapsed to left/right alignment within that row (top-* values are
    // treated as their bottom-* equivalents — the row is always at the
    // bottom for visual consistency).
    const alignRight = position === 'bottom-right' || position === 'top-right';

    const row = document.createElement('div');
    row.style.cssText = [
      'position:relative',
      'z-index:20',
      'flex:0 0 20px',
      'display:flex',
      'align-items:center',
      `justify-content:${alignRight ? 'flex-end' : 'flex-start'}`,
      'padding:0 8px',
      'pointer-events:auto',
      'user-select:none',
    ].join(';') + ';';

    const tag = href ? 'a' : 'div';
    const el = document.createElement(tag) as HTMLAnchorElement | HTMLDivElement;
    if (href && el instanceof HTMLAnchorElement) {
      el.href = href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
    el.setAttribute(
      'style',
      [
        'display:inline-flex',
        'align-items:center',
        'gap:5px',
        'line-height:1',
        'cursor:' + (href ? 'pointer' : 'default'),
        'text-decoration:none',
        `color:${color}`,
        `opacity:${opacity}`,
        'transition:opacity 120ms ease-out',
      ].join(';') + ';',
    );
    // The "Powered by" prefix is muted; the logo sits at full saturation
    // and is nudged up ~1px so its visual centre lines up with the text
    // baseline (the SVG paths' bounding box sits slightly low).
    el.innerHTML =
      `<span style="opacity:0.65;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;line-height:1">${this.escapeHtml(text)}</span>` +
      `<span style="display:inline-flex;align-items:center;transform:translateY(-1.5px)">${svgOrName}</span>`;
    el.addEventListener('mouseenter', () => { el.style.opacity = String(Math.min(1, opacity + 0.15)); });
    el.addEventListener('mouseleave', () => { el.style.opacity = String(opacity); });

    row.appendChild(el);
    this.brandingEl = el;
    this.brandingRow = row;
    this.chartCol.appendChild(row);
  }

  private escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]!));
  }

  private makePanelHooks(panelIndex: number): PanelHooks {
    return {
      onLegendToggle: (panelId, seriesId, hidden) => {
        this.onSeriesVisibilityChange?.(panelId, seriesId, hidden);
      },
      onCollapseToggle: (panelId, collapsed) => {
        this.applyCollapsedFlex();
        this.applyTimeAxisVisibility();
        this.requestResize();
        this.onPaneCollapseChange?.(panelId, collapsed);
      },
      canCollapse: () => panelIndex > 0,
      requestRedraw: () => this.markDirty('base', 'series'),
    };
  }

  private rebindPanelHooks() {
    this.panels.forEach((p, i) => { p.hooks = this.makePanelHooks(i); });
  }

  private applyCollapsedFlex() {
    for (const p of this.panels) {
      if (p.collapsed) {
        p.el.style.flex = `0 0 ${Chart.COLLAPSED_PANE_HEIGHT}px`;
      } else {
        p.el.style.flex = `${p.spec.weight} 1 0`;
      }
    }
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
    if (this.branding) this.applyBranding(this.branding);
    this.markDirty('base', 'series', 'overlay');
  }

  setViewport(vp: Viewport) {
    this.viewport = vp;
    this.markDirty('base', 'series', 'overlay');
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  /**
   * Swap the time-axis label formatter at runtime. Pass a format string
   * (`'MMM YYYY'`, `'duration'`, ...), a callback, or `undefined` to revert
   * to the built-in adaptive formatter.
   */
  setTimeFormat(fmt: ChartOptions['timeFormat']) {
    this.timeFormatter = fmt === undefined ? undefined : resolveTimeFormatter(fmt);
    this.markDirty('base', 'overlay');
  }

  destroy() {
    this.detachPanZoom?.();
    this.resizeObserver?.disconnect();
    for (const p of this.panels) p.destroy();
    this.root.remove();
  }

  // ---- internals ----

  private attachEvents() {
    if (this.interactive) {
      this.detachPanZoom = attachPanZoom(this.eventSurface, {
        getDataLength: () => this.buf?.length ?? 0,
        getViewport: () => this.viewport,
        setViewport: (vp) => this.setViewport(vp),
        getWidth: () => this.eventSurface.getBoundingClientRect().width,
      });
    }

    this.eventSurface.addEventListener('pointermove', (e) => this.onMove(e));
    this.eventSurface.addEventListener('pointerleave', () => {
      this.hoverIdx = -1;
      this.hoverY = -1;
      this.hoverPanel = -1;
      this.markDirty('overlay');
    });

    if (this.interactive) {
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

    for (const p of this.panels) if (!p.collapsed) p.computeRange(this.buf, this.viewport);

    if (this.dirty.base) {
      // Compute vertical tick xs (in CSS px relative to panel canvas width)
      // once per base draw, used for `gridStyle: 'full'` and the time axis.
      const verticalXs = this.hasTimePanel() ? this.computeVerticalGridXs() : [];
      const external = this.legendPosition !== 'overlay';
      const placement = external ? 'external' : 'overlay';
      for (const p of this.panels) {
        p.drawBase(this.effectiveTheme, this.viewport, this.titleStyle, this.gridStyle, verticalXs, external);
        p.syncLegend(this.effectiveTheme, this.legendMode, this.titleStyle, placement);
      }
      this.drawTimeAxisCanvas();
    }
    if (this.dirty.series) {
      for (const p of this.panels) {
        if (p.collapsed) {
          // Clear any stale series pixels so a collapsed pane shows only its title row.
          p.seriesCtx.clearRect(0, 0, p.width, p.height);
          continue;
        }
        p.drawSeries(this.effectiveTheme, this.viewport, this.buf, this.markers);
      }
    }
    if (this.dirty.overlay || this.dirty.series) {
      for (let i = 0; i < this.panels.length; i++) {
        const p = this.panels[i]!;
        if (p.collapsed) {
          p.overlayCtx.clearRect(0, 0, p.width, p.height);
          continue;
        }
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
      this.timeFormatter,
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
    const rawTime = this.buf.time[i]!;
    // Honor the user's `timeFormat` when present so `timeFormat: 'duration'`
    // and other overrides drive the tooltip's first line too (otherwise a
    // duration-axis chart would show a nonsensical epoch-based ISO date).
    const timeLabel = this.timeFormatter
      ? this.timeFormatter(rawTime)
      : new Date(rawTime).toISOString().replace('T', ' ').slice(0, 16);
    const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const lines = [
      timeLabel,
      `O ${fmt(this.buf.open[i]!)}   H ${fmt(this.buf.high[i]!)}`,
      `L ${fmt(this.buf.low[i]!)}   C ${fmt(this.buf.close[i]!)}`,
    ];
    return lines;
  }
}

export function createChart(container: HTMLElement, options?: ChartOptions): Chart {
  return new Chart(container, options);
}
