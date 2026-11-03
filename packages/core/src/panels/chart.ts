import type { BrandingOptions, ChartOptions, DecisionAnnotation, OHLCBuffer, PanelSpec, ThemeTokens, TradeMarker, Viewport } from '../types';
import { DecisionIndex, DecisionInspector, decisionColor, decisionTypeKey, decisionTypeLabel, decisionX, renderDecisions, validateDecisions, type DecisionHit } from './decisions';
import { resolveTheme } from '../themes';
import { Panel, isTimePanel, type LegendMode, type PanelHooks } from './panel';
import { attachPanZoom } from '../interactions/panZoom';
import { xCenter, yPos } from '../renderers/layout';
import type { TitleStyle } from '../renderers/grid';
import { computeTimeTicks, drawTimeAxis, resolveTimeFormatter } from '../renderers/grid';
import type { GridStyle } from '../renderers/grid';
import { ComparisonInspector, comparisonIndices } from './comparison';

let nextControlsId = 0;

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
  private frame: HTMLDivElement;
  private chartScrollContainer: HTMLDivElement;
  private decisionInspector: DecisionInspector;
  private decisions: DecisionAnnotation[] = [];
  private decisionIndex = new DecisionIndex([], null);
  private hiddenDecisionTypes = new Set<string>();
  private chartControls: HTMLDivElement;
  private showToolbarButton!: HTMLButtonElement;
  private comparisonInspector: ComparisonInspector;
  private compareButton!: HTMLButtonElement;
  private comparing = false;
  private comparisonTimes: number[] = [];
  private timeAxisPanelId: string | null = null;
  private timeAxisDialog!: HTMLDialogElement;
  private timeAxisButton!: HTMLButtonElement;
  private panelVisibilityDialog!: HTMLDialogElement;
  private panelVisibilityButton!: HTMLButtonElement;
  private fullscreenButton!: HTMLButtonElement;
  private fullscreenStatus!: HTMLDivElement;
  private detachFullscreen: (() => void) | null = null;
  private toolTooltip!: HTMLDivElement;
  private viewport: Viewport = { startIdx: 0, endIdx: 0 };
  private hoverIdx = -1;
  private hoverY = -1;
  private hoverPanel = -1;
  private hoverDecision: (DecisionHit & { panel: number }) | null = null;
  private selectedDecision: (DecisionHit & { panel: number }) | null = null;
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
  /** Initial X-axis zoom as a percentage of the buffer. `undefined` = fall back to `initialFit`. */
  private initialZoomX: number | undefined = undefined;
  /** Initial Y-axis zoom as a percentage of the data range. `undefined` = fit. */
  private initialZoomY: number | undefined = undefined;
  /**
   * Y-scale factor applied to every newly-created panel until the user
   * interacts with the y-axis (drag or double-click). Used by `initialZoom`
   * y-values `!= 100` to persist vertical scaling that survives React
   * re-mounting the panels via `setPanels`. `null` = no initial y-scale.
   */
  private initialYScale: number | null = null;
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
    this.rightAxis.title = 'Scroll or drag to zoom Y · double-click to reset';
    this.eventSurface.title = 'Drag to pan · Shift + drag to box zoom · Escape to cancel';

    this.bottomAxis = document.createElement('div');
    this.bottomAxis.style.cssText = `position:relative;flex:0 0 ${Chart.TIME_AXIS_HEIGHT}px;cursor:ew-resize;`;
    this.bottomAxis.title = 'Drag to zoom X · double-click to reset';

    this.timeAxisCanvas = document.createElement('canvas');
    this.timeAxisCanvas.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:block;pointer-events:none;';
    this.timeAxisCtx = this.timeAxisCanvas.getContext('2d')!;
    this.bottomAxis.appendChild(this.timeAxisCanvas);

    this.frame = document.createElement('div');
    this.frame.className = 'finterion-chart-frame';
    this.frame.style.cssText = `position:relative;display:flex;flex-direction:row;width:100%;height:100%;min-height:0;overflow:hidden;background:${this.theme.bg};color:${this.theme.text};`;
    this.root.style.flex = '1 1 0';
    this.root.style.minWidth = '0';
    this.chartScrollContainer = document.createElement('div');
    this.chartScrollContainer.setAttribute('role', 'region');
    this.chartScrollContainer.setAttribute('aria-label', 'Chart panels');
    this.chartScrollContainer.tabIndex = 0;
    this.chartScrollContainer.style.cssText = 'flex:1 1 0;min-width:0;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;';
    this.decisionInspector = new DecisionInspector(() => this.requestResize());
    this.comparisonInspector = new ComparisonInspector();
    container.appendChild(this.frame);
    this.frame.append(this.chartScrollContainer, this.decisionInspector.container, this.comparisonInspector.el);
    this.chartScrollContainer.appendChild(this.root);
    this.root.appendChild(this.chartCol);
    this.root.appendChild(this.legendSidebar);
    this.chartControls = document.createElement('div');
    this.chartControls.className = 'finterion-chart-tools';
    this.chartControls.setAttribute('role', 'toolbar');
    this.chartControls.setAttribute('aria-label', 'Chart display controls');
    this.chartControls.setAttribute('aria-orientation', 'vertical');
    this.chartControls.style.cssText = 'display:flex;flex-direction:column;flex:0 0 48px;box-sizing:border-box;gap:8px;padding:8px 5px;align-items:center;overflow-y:auto;border-right:1px solid;font-size:12px;';
    this.frame.prepend(this.chartControls);
    this.chartCol.appendChild(this.panelsContainer);
    this.chartCol.appendChild(this.bottomAxis);
    this.panelsContainer.appendChild(this.eventSurface);
    this.panelsContainer.appendChild(this.rightAxis);
    this.createChartControls();

    if (options.initialFit) this.initialFit = options.initialFit;
    if (options.initialZoom !== undefined) {
      // Normalize `number | { x?, y? }` into independent x/y percentages.
      // Missing axis defaults to 100 (fit). Values <= 0 or non-finite are
      // ignored — an axis stays undefined and falls back to `initialFit`.
      let rawX: number | undefined;
      let rawY: number | undefined;
      if (typeof options.initialZoom === 'number') {
        rawX = options.initialZoom;
        rawY = options.initialZoom;
      } else {
        rawX = options.initialZoom.x;
        rawY = options.initialZoom.y;
      }
      if (rawX !== undefined && Number.isFinite(rawX) && rawX > 0) {
        this.initialZoomX = rawX;
      }
      if (rawY !== undefined && Number.isFinite(rawY) && rawY > 0) {
        this.initialZoomY = rawY;
        if (rawY !== 100) this.initialYScale = rawY / 100;
      }
    }
    if (options.panels) this.setPanels(options.panels);
    if (options.markers) this.markers = options.markers;
    if (options.viewport) this.viewport = options.viewport;
    this.applyDisplayOptions(options);
    this.applyBranding(options.branding);
    if (options.decisions) this.setDecisions(options.decisions);
    if (options.interactive === false) {
      this.interactive = false;
      this.compareButton.disabled = true;
      this.eventSurface.style.cursor = 'default';
    }
    if (options.timeFormat !== undefined) {
      this.timeFormatter = resolveTimeFormatter(options.timeFormat);
    }

    this.attachEvents();
    this.observeResize();
  }

  setData(buf: OHLCBuffer) {
    this.hoverDecision = null;
    const wasFollowing = this.viewport.endIdx >= (this.buf?.length ?? 1) - 1;
    this.buf = buf;
    const indices = comparisonIndices(buf, this.comparisonTimes);
    this.comparisonTimes = this.comparisonTimes.filter((_, i) => indices[i] !== -1);
    this.renderComparison();
    this.refreshDecisionIndex(false);
    if (this.viewport.endIdx === 0 && this.viewport.startIdx === 0) {
      if (this.initialZoomX !== undefined && this.initialZoomX > 100) {
        // Zoom OUT past the data on X: extend viewport symmetrically beyond
        // the buffer bounds. `120` -> viewport spans 1.2x the data, i.e. 10%
        // empty padding on each side. The renderers clamp data reads to
        // valid indices, so out-of-range slots simply render as empty
        // canvas — visual breathing room.
        const dataSpan = Math.max(1, buf.length - 1);
        const totalSpan = dataSpan * (this.initialZoomX / 100);
        const extra = totalSpan - dataSpan;
        const padLeft = Math.round(extra / 2);
        const padRight = Math.round(extra - padLeft);
        this.viewport = {
          startIdx: -padLeft,
          endIdx: (buf.length - 1) + padRight,
        };
      } else {
        let span: number;
        if (this.initialZoomX !== undefined) {
          // Percentage-of-buffer semantics: 100 = all bars, 50 = last half, etc.
          span = Math.max(1, Math.min(buf.length - 1, Math.round((buf.length - 1) * this.initialZoomX / 100)));
        } else {
          span = this.initialFit === 'all'
            ? buf.length - 1
            : Math.min(200, buf.length - 1);
        }
        this.viewport = { startIdx: Math.max(0, buf.length - 1 - span), endIdx: buf.length - 1 };
      }
      // Y-axis scale is orthogonal to the X viewport: `initialYScale` was
      // set from `initialZoom.y` in the constructor and is applied to
      // every panel here + in `setPanels` (survives React re-mounts).
      if (this.initialYScale !== null) {
        for (const p of this.panels) p.yScale = this.initialYScale;
      }
    } else if (wasFollowing) {
      const span = this.viewport.endIdx - this.viewport.startIdx;
      this.viewport = { startIdx: Math.max(0, buf.length - 1 - span), endIdx: buf.length - 1 };
    }
    this.markDirty('series', 'base');
  }

  setPanels(panels: PanelSpec[]) {
    if (this.timeAxisDialog?.open) this.timeAxisDialog.close();
    if (this.panelVisibilityDialog?.open) this.panelVisibilityDialog.close();
    this.hoverDecision = null;
    const zoomStates = new Map(this.panels.map(panel => [
      panel.spec.id, { kind: panel.spec.kind, scale: panel.yScale, range: panel.manualYRange, collapsed: panel.collapsed },
    ]));
    for (const p of this.panels) p.destroy();
    this.panels = panels.map((s, i) => {
      const panel = new Panel(s);
      panel.hooks = this.makePanelHooks(i);
      // Preserve the `initialZoom > 100` vertical breathing room across
      // panel re-mounts (React fires setPanels after setData on first
      // render, which would otherwise reset yScale back to 1).
      if (this.initialYScale !== null) panel.yScale = this.initialYScale;
      const zoom = zoomStates.get(s.id);
      if (zoom?.kind === s.kind && (s.collapsible ?? i > 0)) {
        panel.collapsed = zoom.collapsed;
      }
      if (zoom?.kind === s.kind && this.initialYScale === null) {
        panel.yScale = zoom.scale;
        panel.manualYRange = zoom.range;
      }
      return panel;
    });
    for (const p of this.panels) this.panelsContainer.appendChild(p.el);
    this.placeTimeAxis();
    // Move event surface + axes to top within panelsContainer.
    this.panelsContainer.appendChild(this.eventSurface);
    this.panelsContainer.appendChild(this.rightAxis);
    // Reparent legends into whichever host the current legendPosition wants.
    this.attachLegends();
    this.applyPanelGap();
    this.applyTitleSpace();
    this.applyCollapsedFlex();
    this.applyTimeAxisVisibility();
    this.renderComparison();
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
      for (const p of this.panels) {
        this.panelsContainer.appendChild(p.legendEl);
        this.panelsContainer.appendChild(p.collapseEl);
      }
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
        heading.appendChild(p.collapseEl);
      } else {
        section.appendChild(p.collapseEl);
      }
      section.appendChild(p.legendEl);
      this.legendSidebar.appendChild(section);
    });
  }

  /** Update display options (panel gap, title styling) at runtime. */
  setDisplayOptions(options: Pick<ChartOptions, 'panelGap' | 'chartMinHeight' | 'titleColor' | 'titlePadding' | 'titleFontSize' | 'titleSpace' | 'showTimeAxis' | 'gridStyle' | 'background' | 'gridColor' | 'showLegend' | 'legendPosition' | 'legendWidth' | 'legendMaxHeight' | 'onSeriesVisibilityChange' | 'onPaneCollapseChange'>) {
    this.applyDisplayOptions(options);
    this.renderComparison();
    this.markDirty('base');
    this.requestResize();
  }

  private applyDisplayOptions(options: ChartOptions) {
    if (options.chartMinHeight !== undefined) {
      if (!Number.isFinite(options.chartMinHeight) || options.chartMinHeight < 0) {
        throw new Error('chartMinHeight must be a finite non-negative number');
      }
      this.root.style.minHeight = `${options.chartMinHeight}px`;
    }
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
    this.root.style.paddingBottom = this.branding ? '20px' : '';
    this.root.style.boxSizing = 'border-box';
    if (!this.branding) return;

    const cfg = this.branding;
    const text = cfg.text ?? 'Powered by';
    const svgOrName = cfg.svg ?? DEFAULT_FINTERION_LOGO_SVG;
    const href = cfg.href === undefined ? 'https://finterion.com' : cfg.href;
    const position = cfg.position ?? 'bottom-left';
    const opacity = cfg.opacity ?? 1;
    const color = cfg.color ?? this.effectiveTheme.textDim;

    // Reserve space in root, but keep the badge outside its overflow clip so
    // it sticks to the scroll viewport rather than the last panel.
    const alignRight = position === 'bottom-right' || position === 'top-right';

    const row = document.createElement('div');
    row.style.cssText = [
      'position:sticky',
      'bottom:0',
      'height:20px',
      'box-sizing:border-box',
      'margin-top:-20px',
      `background:${this.effectiveTheme.bg}`,
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
    this.chartScrollContainer.appendChild(row);
  }

  private escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]!));
  }

  private makePanelHooks(panelIndex: number): PanelHooks {
    return {
      onLegendToggle: (panelId, seriesId, hidden) => {
        this.renderComparison();
        this.onSeriesVisibilityChange?.(panelId, seriesId, hidden);
      },
      onCollapseToggle: (panelId, collapsed) => {
        this.applyCollapsedFlex();
        this.applyTimeAxisVisibility();
        this.requestResize();
        this.onPaneCollapseChange?.(panelId, collapsed);
      },
      canCollapse: () => this.panels[panelIndex]?.spec.collapsible ?? panelIndex > 0,
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
    this.chartControls.style.background = this.effectiveTheme.bg;
    this.chartControls.style.borderColor = this.effectiveTheme.border;
    this.chartControls.style.color = this.effectiveTheme.textDim;
    this.chartControls.style.setProperty('--finterion-tool-accent', this.effectiveTheme.accent);
    this.showToolbarButton.style.background = this.effectiveTheme.surface;
    this.showToolbarButton.style.color = this.effectiveTheme.text;
    this.showToolbarButton.style.borderColor = this.effectiveTheme.border;
    for (const element of [this.toolTooltip, this.timeAxisDialog, this.panelVisibilityDialog, this.fullscreenStatus]) {
      element.style.background = this.effectiveTheme.surface;
      element.style.color = this.effectiveTheme.text;
      element.style.borderColor = this.effectiveTheme.border;
    }
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

  private placeTimeAxis() {
    const selected = this.panels.find(p => p.spec.id === this.timeAxisPanelId && isTimePanel(p.spec.kind));
    if (selected) {
      selected.el.after(this.bottomAxis);
      this.bottomAxis.style.zIndex = '12';
    } else {
      this.timeAxisPanelId = null;
      this.chartCol.appendChild(this.bottomAxis);
      this.bottomAxis.style.zIndex = '';
    }
  }

  private refreshDecisionIndex(updateInspector = true) {
    const visible = this.decisions.filter(d => !this.hiddenDecisionTypes.has(decisionTypeKey(d)));
    this.decisionIndex = new DecisionIndex(visible, this.buf);
    this.selectedDecision = null;
    this.hoverDecision = null;
    this.hoverIdx = -1;
    this.eventSurface.style.cursor = this.interactive ? 'crosshair' : 'default';
    this.eventSurface.title = '';
    if (updateInspector) this.decisionInspector.setDecisions(visible);
    this.renderComparison();
    this.markDirty('series', 'overlay');
  }

  private createChartControls() {
    const style = document.createElement('style');
    style.textContent = `
      .finterion-chart-tools button {
        display:flex;align-items:center;justify-content:center;flex:0 0 36px;width:36px;height:36px;
        padding:0;border:1px solid transparent;border-radius:6px;background:transparent;color:inherit;cursor:pointer;
      }
      .finterion-chart-tools button:hover:not(:disabled) { background:rgba(128,128,128,.14); }
      .finterion-chart-tools button[aria-pressed="true"] {
        color:var(--finterion-tool-accent);border-color:currentColor;background:rgba(128,128,128,.14);
      }
      .finterion-chart-tools button:focus-visible { outline:2px solid var(--finterion-tool-accent);outline-offset:1px; }
      .finterion-chart-toolbar-show:focus-visible { outline:2px solid currentColor;outline-offset:-2px; }
      .finterion-chart-tools button:disabled { opacity:.35;cursor:default; }
      .finterion-chart-axis-dialog { border:1px solid;border-radius:10px;padding:18px;box-sizing:border-box;overflow:auto; }
      .finterion-chart-axis-dialog::backdrop { background:rgba(0,0,0,.25); }
      .finterion-chart-axis-dialog label { display:flex;gap:10px;align-items:center;padding:8px 0;cursor:pointer;overflow-wrap:anywhere; }
      .finterion-chart-axis-dialog button { padding:7px 12px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;cursor:pointer; }
      .finterion-chart-axis-dialog :focus-visible { outline:2px solid currentColor;outline-offset:2px; }
      .finterion-chart-frame:fullscreen { width:100vw !important;height:100vh !important; }
    `;
    this.frame.appendChild(style);
    const controlsId = ++nextControlsId;
    this.toolTooltip = document.createElement('div');
    this.toolTooltip.id = `finterion-tool-tooltip-${controlsId}`;
    this.toolTooltip.setAttribute('role', 'tooltip');
    this.toolTooltip.style.cssText = 'display:none;position:absolute;z-index:50;pointer-events:none;max-width:260px;padding:8px 10px;border:1px solid;border-radius:6px;box-shadow:0 4px 14px #0004;font:12px/1.5 system-ui;box-sizing:border-box;';
    this.frame.appendChild(this.toolTooltip);
    const describeTool = (button: HTMLButtonElement, description: string) => {
      button.setAttribute('aria-description', description);
      const hide = () => {
        this.toolTooltip.style.display = 'none';
        button.removeAttribute('aria-describedby');
      };
      const show = () => {
        if (button.disabled || this.timeAxisDialog?.open || this.panelVisibilityDialog?.open) return;
        const bounds = button.getBoundingClientRect();
        const frame = this.frame.getBoundingClientRect();
        this.toolTooltip.textContent = description;
        this.toolTooltip.style.left = `${bounds.right - frame.left + 8}px`;
        this.toolTooltip.style.top = `${Math.max(4, Math.min(bounds.top - frame.top, frame.height - 70))}px`;
        this.toolTooltip.style.maxWidth = `${Math.max(0, Math.min(260, frame.right - bounds.right - 16))}px`;
        this.toolTooltip.style.display = 'block';
        button.setAttribute('aria-describedby', this.toolTooltip.id);
      };
      button.addEventListener('pointerenter', show);
      button.addEventListener('focus', show);
      button.addEventListener('pointerleave', hide);
      button.addEventListener('blur', hide);
      button.addEventListener('click', hide);
      button.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    };
    const tool = (label: string, icon: string, description: string) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', 'false');
      describeTool(button, description);
      button.innerHTML = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
      this.chartControls.appendChild(button);
      return button;
    };
    const timeAxisButton = this.timeAxisButton = tool('X axis placement',
      '<path d="M3 3v18h18M3 14h18M7 14v3m5-3v3m5-3v3"/><path d="m6 10 4-4 4 3 5-4"/>',
      'Choose which panel displays the shared X axis. Drag that axis to zoom time; double-click to reset.');
    timeAxisButton.removeAttribute('aria-pressed');
    timeAxisButton.setAttribute('aria-haspopup', 'dialog');
    timeAxisButton.setAttribute('aria-expanded', 'false');
    this.timeAxisDialog = document.createElement('dialog');
    this.timeAxisDialog.id = `finterion-time-axis-${controlsId}`;
    this.timeAxisDialog.className = 'finterion-chart-axis-dialog';
    this.timeAxisDialog.setAttribute('aria-label', 'X axis placement');
    this.timeAxisDialog.setAttribute('aria-modal', 'true');
    timeAxisButton.setAttribute('aria-controls', this.timeAxisDialog.id);
    this.frame.appendChild(this.timeAxisDialog);
    timeAxisButton.addEventListener('click', () => this.openTimeAxisDialog());
    this.timeAxisDialog.addEventListener('close', () => {
      timeAxisButton.setAttribute('aria-expanded', 'false');
      timeAxisButton.focus();
    });
    this.timeAxisDialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.timeAxisDialog.close();
      }
    });
    this.timeAxisDialog.addEventListener('click', e => {
      if (e.target !== this.timeAxisDialog) return;
      const bounds = this.timeAxisDialog.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) {
        this.timeAxisDialog.close();
      }
    });
    this.compareButton = tool('Compare points',
      '<path d="M6 3v3m0 4v4m0 4v3M18 3v7m0 4v7M9 8h6m-6 8h6"/><circle cx="6" cy="8" r="2"/><circle cx="18" cy="12" r="2"/>',
      'Select timestamps and compare values across panels');
    this.compareButton.addEventListener('click', () => this.setComparing(!this.comparing));
    this.panelVisibilityButton = tool('Panel visibility',
      '<rect x="3" y="3" width="18" height="5" rx="1"/><rect x="3" y="10" width="18" height="5" rx="1"/><path d="M3 19h18"/>',
      'Show or collapse multiple panels using a checklist. Changes apply together.');
    this.panelVisibilityButton.removeAttribute('aria-pressed');
    this.panelVisibilityButton.setAttribute('aria-haspopup', 'dialog');
    this.panelVisibilityButton.setAttribute('aria-expanded', 'false');
    this.panelVisibilityDialog = document.createElement('dialog');
    this.panelVisibilityDialog.id = `finterion-panel-visibility-${controlsId}`;
    this.panelVisibilityDialog.className = 'finterion-chart-axis-dialog';
    this.panelVisibilityDialog.setAttribute('aria-label', 'Panel visibility');
    this.panelVisibilityDialog.setAttribute('aria-modal', 'true');
    this.panelVisibilityButton.setAttribute('aria-controls', this.panelVisibilityDialog.id);
    this.frame.appendChild(this.panelVisibilityDialog);
    this.panelVisibilityButton.addEventListener('click', () => this.openPanelVisibilityDialog());
    this.panelVisibilityDialog.addEventListener('close', () => {
      this.panelVisibilityButton.setAttribute('aria-expanded', 'false');
      this.panelVisibilityButton.focus();
    });
    this.panelVisibilityDialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.panelVisibilityDialog.close();
      }
    });
    this.panelVisibilityDialog.addEventListener('click', e => {
      if (e.target !== this.panelVisibilityDialog) return;
      const bounds = this.panelVisibilityDialog.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) {
        this.panelVisibilityDialog.close();
      }
    });
    this.fullscreenButton = tool('Enter fullscreen',
      '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
      'Toggle browser fullscreen for this chart. Press Escape to exit. Notebook hosts may restrict fullscreen.');
    this.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
    this.fullscreenStatus = document.createElement('div');
    this.fullscreenStatus.setAttribute('role', 'status');
    this.fullscreenStatus.style.cssText = 'display:none;position:absolute;z-index:50;top:8px;right:8px;max-width:320px;padding:10px;border:1px solid;border-radius:6px;font:12px/1.5 system-ui;';
    this.frame.appendChild(this.fullscreenStatus);
    const fullscreenChanged = () => {
      const active = document.fullscreenElement === this.frame;
      this.fullscreenButton.setAttribute('aria-pressed', String(active));
      this.fullscreenButton.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
      this.requestResize();
    };
    document.addEventListener('fullscreenchange', fullscreenChanged);
    this.detachFullscreen = () => document.removeEventListener('fullscreenchange', fullscreenChanged);
    const hideButton = tool('Hide toolbar', '<path d="m14 6-6 6 6 6"/>', 'Hide the chart tools');
    hideButton.removeAttribute('aria-pressed');
    hideButton.setAttribute('aria-expanded', 'true');
    hideButton.style.marginTop = 'auto';
    this.showToolbarButton = document.createElement('button');
    this.showToolbarButton.type = 'button';
    this.showToolbarButton.className = 'finterion-chart-toolbar-show';
    this.showToolbarButton.setAttribute('aria-label', 'Show toolbar');
    this.showToolbarButton.setAttribute('aria-expanded', 'true');
    describeTool(this.showToolbarButton, 'Show the chart tools without changing your active tools or selected timestamps.');
    this.showToolbarButton.innerHTML = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
    this.showToolbarButton.style.cssText = 'display:none;position:absolute;left:0;top:8px;z-index:40;align-items:center;justify-content:center;width:24px;height:36px;padding:0;border:1px solid;border-radius:0 5px 5px 0;cursor:pointer;';
    this.frame.appendChild(this.showToolbarButton);
    const setToolbarHidden = (hidden: boolean) => {
      this.chartControls.style.display = hidden ? 'none' : 'flex';
      this.showToolbarButton.style.display = hidden ? 'flex' : 'none';
      hideButton.setAttribute('aria-expanded', String(!hidden));
      this.showToolbarButton.setAttribute('aria-expanded', String(!hidden));
      (hidden ? this.showToolbarButton : timeAxisButton).focus();
      this.requestResize();
    };
    hideButton.addEventListener('click', () => setToolbarHidden(true));
    this.showToolbarButton.addEventListener('click', () => setToolbarHidden(false));
    this.chartControls.addEventListener('keydown', e => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const buttons = Array.from(this.chartControls.querySelectorAll('button')).filter(button => !button.disabled);
      if (!buttons.length) return;
      e.preventDefault();
      const index = buttons.findIndex(button => button === document.activeElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1
        : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]!.focus();
    });
  }

  private async toggleFullscreen() {
    this.fullscreenStatus.style.display = 'none';
    try {
      if (document.fullscreenElement === this.frame) {
        await document.exitFullscreen();
      } else {
        if (!this.frame.requestFullscreen || document.fullscreenEnabled === false) {
          throw new Error('Fullscreen is unavailable in this browser or blocked by the notebook host.');
        }
        await this.frame.requestFullscreen();
      }
    } catch (error) {
      this.fullscreenStatus.textContent = `Unable to change fullscreen: ${error instanceof Error ? error.message : String(error)}`;
      this.fullscreenStatus.style.display = 'block';
    }
  }

  private openPanelVisibilityDialog() {
    const dialog = this.panelVisibilityDialog;
    dialog.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Panel visibility';
    heading.style.margin = '0 0 8px';
    const description = document.createElement('p');
    description.textContent = 'Check panels to show them. Unchecked panels collapse to their title row, just like the eye button.';
    description.id = `${dialog.id}-description`;
    description.style.cssText = 'margin:0 0 12px;font-size:12px;line-height:1.5;';
    dialog.setAttribute('aria-describedby', description.id);
    const choices = document.createElement('div');
    const inputs = new Map<Panel, HTMLInputElement>();
    for (const panel of this.panels) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !panel.collapsed;
      input.disabled = !(panel.hooks.canCollapse?.() ?? false);
      const text = document.createElement('span');
      text.textContent = `${panel.spec.title ?? panel.spec.id}${input.disabled ? ' (always visible)' : ''}`;
      label.append(input, text);
      choices.appendChild(label);
      inputs.set(panel, input);
    }
    const presets = document.createElement('div');
    presets.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
    for (const title of ['Show all', 'Hide all']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = title;
      button.addEventListener('click', () => {
        for (const input of inputs.values()) {
          if (!input.disabled) input.checked = title === 'Show all';
        }
      });
      presets.appendChild(button);
    }
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';
    for (const title of ['Cancel', 'Apply']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = title;
      button.addEventListener('click', () => {
        if (title === 'Apply') {
          for (const [panel, input] of inputs) {
            if (!input.disabled) panel.setCollapsed(!input.checked);
          }
        }
        dialog.close();
      });
      actions.appendChild(button);
    }
    dialog.append(heading, description, presets, choices, actions);
    const bounds = this.panelVisibilityButton.getBoundingClientRect();
    const width = Math.max(0, Math.min(360, window.innerWidth - 16));
    Object.assign(dialog.style, {
      position: 'fixed', margin: '0', width: `${width}px`, maxHeight: 'calc(100vh - 16px)',
      left: `${Math.max(8, Math.min(bounds.right + 8, window.innerWidth - width - 8))}px`,
      top: `${Math.max(8, Math.min(bounds.top, window.innerHeight - 440))}px`,
    });
    this.toolTooltip.style.display = 'none';
    dialog.showModal();
    this.panelVisibilityButton.setAttribute('aria-expanded', 'true');
  }

  private openTimeAxisDialog() {
    const dialog = this.timeAxisDialog;
    if (dialog.open) return;
    dialog.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Show X axis';
    heading.style.margin = '0 0 8px';
    const description = document.createElement('p');
    description.textContent = 'Choose where to display the shared time axis. All time-based panels remain synchronized.';
    description.style.cssText = 'margin:0 0 12px;font-size:12px;line-height:1.5;';
    description.id = `${dialog.id}-description`;
    dialog.setAttribute('aria-describedby', description.id);
    const choices = document.createElement('div');
    choices.setAttribute('role', 'radiogroup');
    choices.setAttribute('aria-label', 'Time axis location');
    let selected = this.timeAxisPanelId;
    const choice = (panelId: string | null, title: string) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = dialog.id;
      input.checked = panelId === selected;
      input.addEventListener('change', () => { if (input.checked) selected = panelId; });
      const text = document.createElement('span');
      text.textContent = title;
      label.append(input, text);
      choices.appendChild(label);
    };
    choice(null, 'Bottom of chart');
    for (const panel of this.panels) {
      if (isTimePanel(panel.spec.kind)) choice(panel.spec.id, `Below ${panel.spec.title ?? panel.spec.id}`);
    }
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';
    for (const label of ['Cancel', 'Apply']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => {
        if (label === 'Apply') {
          this.timeAxisPanelId = selected;
          this.showTimeAxis = true;
          this.placeTimeAxis();
          this.applyTimeAxisVisibility();
          this.requestResize();
        }
        dialog.close();
      });
      actions.appendChild(button);
    }
    dialog.append(heading, description, choices, actions);
    const bounds = this.timeAxisButton.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    Object.assign(dialog.style, {
      position: 'fixed', margin: '0', width: `${width}px`, maxHeight: 'calc(100vh - 16px)',
      left: `${Math.max(8, Math.min(bounds.right + 8, window.innerWidth - width - 8))}px`,
      top: `${Math.max(8, Math.min(bounds.top, window.innerHeight - 440))}px`,
    });
    this.toolTooltip.style.display = 'none';
    dialog.showModal();
    this.timeAxisButton.setAttribute('aria-expanded', 'true');
  }

  private setComparing(active: boolean) {
    this.comparing = active;
    this.compareButton.setAttribute('aria-pressed', String(active));
    this.hoverDecision = null;
    this.selectedDecision = null;
    this.eventSurface.title = '';
    this.comparisonInspector.el.style.display = active ? 'flex' : 'none';
    this.decisionInspector.container.style.display = !active && this.decisions.length ? 'flex' : 'none';
    this.renderComparison();
    this.requestResize();
  }

  private renderComparison() {
    if (!this.comparing) return;
    this.decisionInspector.container.style.display = 'none';
    this.comparisonInspector.render({
      times: this.comparisonTimes, buf: this.buf, panels: this.panels.map(p => p.spec),
      theme: this.effectiveTheme, formatTime: this.timeFormatter,
      remove: time => {
        this.comparisonTimes = this.comparisonTimes.filter(t => t !== time);
        this.renderComparison();
        this.markDirty('overlay');
      },
      clear: () => {
        this.comparisonTimes = [];
        this.renderComparison();
        this.markDirty('overlay');
      },
      close: () => this.setComparing(false),
    });
  }

  private toggleComparisonPoint(e: Pick<MouseEvent, 'clientX' | 'clientY'>) {
    if (!this.buf?.length) return;
    const panel = this.panels.find(p => {
      const rect = p.el.getBoundingClientRect();
      return !p.collapsed && isTimePanel(p.spec.kind)
        && e.clientY >= rect.top + p.headerHeight && e.clientY < rect.bottom;
    });
    if (!panel) return;
    const rect = panel.el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const index = Math.floor(this.viewport.startIdx
      + (e.clientX - rect.left) / rect.width * (this.viewport.endIdx - this.viewport.startIdx + 1));
    if (index < 0 || index >= this.buf.length) return;
    const time = this.buf.time[index]!;
    if (this.comparisonTimes.includes(time)) this.comparisonTimes = this.comparisonTimes.filter(t => t !== time);
    else this.comparisonTimes.push(time);
    this.renderComparison();
    this.markDirty('overlay');
  }

  private syncDecisionLegend() {
    const main = this.panels[0];
    if (!main) return;
    const extraTypes = new Map<string, DecisionAnnotation>();
    for (const d of this.decisions) {
      if (d.action !== 'none' && d.signalType) extraTypes.set(decisionTypeKey(d), d);
    }
    const controls: Panel['legendControls'] = ([
      ['entry', 'long', 'Long entries'], ['exit', 'long', 'Long exits'],
      ['entry', 'short', 'Short entries'], ['exit', 'short', 'Short exits'],
      ['none', 'long', 'Undecided'],
    ] as const).map(([action, direction, label]) => {
      const key = action === 'none' ? 'none' : `${action}:${direction}`;
      return {
        id: `decision:${key}`, label, color: decisionColor(action, direction),
        hidden: this.hiddenDecisionTypes.has(key),
        onToggle: () => {
          if (this.hiddenDecisionTypes.has(key)) this.hiddenDecisionTypes.delete(key);
          else this.hiddenDecisionTypes.add(key);
          this.refreshDecisionIndex();
          this.markDirty('base');
        },
      };
    });
    for (const [key, d] of extraTypes) {
      controls.push({
        id: `decision:${key}`, label: decisionTypeLabel(d),
        color: decisionColor(d.action, d.direction, undefined, d.signalType),
        hidden: this.hiddenDecisionTypes.has(key),
        onToggle: () => {
          if (this.hiddenDecisionTypes.has(key)) this.hiddenDecisionTypes.delete(key);
          else this.hiddenDecisionTypes.add(key);
          this.refreshDecisionIndex();
          this.markDirty('base');
        },
      });
    }
    main.legendControls = this.decisions.length ? controls : [];
  }

  private hasTimePanel(): boolean {
    return this.panels.some((p) => isTimePanel(p.spec.kind));
  }

  updatePanel(id: string, partial: Partial<PanelSpec>) {
    const p = this.panels.find((x) => x.spec.id === id);
    if (!p) return;
    p.spec = { ...p.spec, ...partial };
    this.renderComparison();
    this.markDirty('series', 'base');
  }

  setMarkers(markers: TradeMarker[]) {
    this.markers = markers;
    this.markDirty('series');
  }

  setDecisions(decisions: DecisionAnnotation[]) {
    const errors = validateDecisions(decisions, this.panels.map(p => p.spec));
    if (errors.length) throw new Error(errors.join('\n'));
    this.decisions = decisions;
    this.hoverDecision = null;
    this.eventSurface.style.cursor = this.interactive ? 'crosshair' : 'default';
    this.refreshDecisionIndex();
    this.requestResize();
    this.markDirty('series');
  }

  setTheme(theme: ChartOptions['theme']) {
    this.theme = resolveTheme(theme);
    this.recomputeEffectiveTheme();
    this.applyBackground();
    this.root.style.color = this.theme.text;
    this.frame.style.background = this.theme.bg;
    this.frame.style.color = this.theme.text;
    this.renderComparison();
    if (this.branding) this.applyBranding(this.branding);
    this.markDirty('base', 'series', 'overlay');
  }

  setViewport(vp: Viewport) {
    this.hoverDecision = null;
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
    this.renderComparison();
    this.markDirty('base', 'overlay');
  }

  destroy() {
    this.detachPanZoom?.();
    this.detachFullscreen?.();
    this.resizeObserver?.disconnect();
    for (const p of this.panels) p.destroy();
    this.frame.remove();
  }

  // ---- internals ----

  private attachEvents() {
    if (this.interactive) {
      this.detachPanZoom = attachPanZoom(this.eventSurface, {
        getDataLength: () => this.buf?.length ?? 0,
        getViewport: () => this.viewport,
        setViewport: (vp) => this.setViewport(vp),
        getWidth: () => this.panelsContainer.getBoundingClientRect().width,
        requireZoomModifier: () => this.chartScrollContainer.scrollHeight > this.chartScrollContainer.clientHeight,
        wheelTarget: this.chartScrollContainer,
        canStartPan: e => !this.comparing && !this.findDecisionHit(e),
        getBoxZoomRegion: e => {
          if (this.comparing) return null;
          const panel = this.panelAtPoint(e);
          if (!panel) return null;
          const rect = panel.el.getBoundingClientRect();
          const top = rect.top + panel.headerHeight;
          const height = panel.height - panel.headerHeight;
          const yMin = panel.yMin;
          const yMax = panel.yMax;
          return {
            left: rect.left, top, width: rect.width - 56, height,
            onZoom: selection => {
              const span = yMax - yMin;
              panel.manualYRange = [
                yMax - (selection.top + selection.height) / height * span,
                yMax - selection.top / height * span,
              ];
              panel.yScale = 1;
              this.initialYScale = null;
            },
          };
        },
      });
    }

    this.eventSurface.addEventListener('pointermove', (e) => this.onMove(e));
    this.eventSurface.addEventListener('pointerup', (e) => this.onMove(e));
    let down: { x: number; y: number } | null = null;
    let dragged = false;
    this.eventSurface.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY };
      dragged = e.shiftKey && this.interactive;
    });
    this.eventSurface.addEventListener('pointermove', e => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) dragged = true;
    });
    this.eventSurface.addEventListener('pointercancel', () => {
      down = null;
      dragged = true;
      this.hoverDecision = null;
      this.eventSurface.style.cursor = this.interactive ? 'crosshair' : 'default';
      this.markDirty('overlay');
    });
    this.eventSurface.addEventListener('click', e => {
      if (!down || dragged) return;
      down = null;
      if (this.comparing) {
        this.toggleComparisonPoint(e);
        return;
      }
      this.onMove(e as PointerEvent);
      if (this.hoverDecision) {
        this.selectedDecision = this.hoverDecision;
        this.decisionInspector.select(
          this.decisionIndex.nearest(this.hoverDecision.bar),
          this.hoverDecision.decision,
        );
      } else {
        this.selectedDecision = null;
        this.decisionInspector.clearSelection();
      }
      this.markDirty('overlay');
    });
    this.eventSurface.addEventListener('pointerleave', () => {
      this.hoverIdx = -1;
      this.hoverY = -1;
      this.hoverPanel = -1;
      this.hoverDecision = null;
      this.eventSurface.style.cursor = this.interactive ? 'crosshair' : 'default';
      this.markDirty('overlay');
    });

    if (this.interactive) {
      this.attachAxisDrag(this.rightAxis, 'y');
      this.attachAxisDrag(this.bottomAxis, 'x');
      this.rightAxis.addEventListener('wheel', e => {
        const panel = this.panelAtPoint(e, true);
        if (!panel || !e.deltaY) return;
        e.preventDefault();
        e.stopPropagation();
        panel.yScale = Math.max(0.05, Math.min(20, panel.yScale * (e.deltaY < 0 ? 0.85 : 1.18)));
        this.initialYScale = null;
        this.markDirty('base', 'series', 'overlay');
      }, { passive: false });
      this.rightAxis.addEventListener('dblclick', () => {
        for (const p of this.panels) {
          p.yScale = 1;
          p.manualYRange = null;
        }
        // User explicitly reset the Y-axis — forget the initial padding
        // factor so subsequent panel re-mounts don't re-inflate the range.
        this.initialYScale = null;
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

  private panelAtPoint(e: Pick<PointerEvent, 'clientX' | 'clientY'>, axis = false): Panel | null {
    for (const panel of this.panels) {
      if (panel.collapsed || !isTimePanel(panel.spec.kind)) continue;
      const rect = panel.el.getBoundingClientRect();
      const left = axis ? rect.right - 56 : rect.left;
      const right = axis ? rect.right : rect.right - 56;
      if (e.clientX >= left && e.clientX <= right
          && e.clientY >= rect.top + panel.headerHeight && e.clientY <= rect.bottom
          && panel.height > panel.headerHeight && panel.width > 56
          && Number.isFinite(panel.yMin) && Number.isFinite(panel.yMax)
          && panel.yMax > panel.yMin) return panel;
    }
    return null;
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
        panelIdx = 0;
        for (let i = 0; i < this.panels.length; i++) {
          const h = this.panels[i]!.height;
          const acc = this.panelTop(i);
          if (y >= acc && y <= acc + h) { panelIdx = i; break; }
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
          // User has taken over Y-scale — drop the initial padding factor
          // so panel re-mounts don't override their manual scale.
          this.initialYScale = null;
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

  private findDecisionHit(e: Pick<PointerEvent, 'clientX' | 'clientY'>): (DecisionHit & { panel: number }) | null {
    if (!this.buf || !this.decisions?.length) return null;
    for (let i = 0; i < this.panels.length; i++) {
      const p = this.panels[i]!;
      if (p.collapsed || !isTimePanel(p.spec.kind)) continue;
      const rect = p.el.getBoundingClientRect();
      const hit = this.decisionIndex.hitTest({
        width: p.width, height: Math.max(1, p.height - p.headerHeight),
        viewport: this.viewport, yMin: p.yMin, yMax: p.yMax,
      }, p.spec.id, e.clientX - rect.left, e.clientY - rect.top - p.headerHeight);
      if (hit) return { ...hit, panel: i };
    }
    return null;
  }

  private onMove(e: PointerEvent) {
    if (!this.buf) return;
    // The event surface excludes the right axis; bar positions use the full canvas.
    const rect = this.panelsContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const span = this.viewport.endIdx - this.viewport.startIdx + 1;
    const band = rect.width / span;
    const idx = Math.round(this.viewport.startIdx + (x - band / 2) / band);
    this.hoverIdx = Math.max(0, Math.min(this.buf.length - 1, idx));
    this.hoverY = y;

    this.hoverPanel = 0;
    for (let i = 0; i < this.panels.length; i++) {
      const h = this.panels[i]!.height;
      const acc = this.panelTop(i);
      if (y >= acc && y <= acc + h) { this.hoverPanel = i; break; }
    }
    this.hoverDecision = e.buttons || this.comparing ? null : this.findDecisionHit(e);
    if (this.hoverDecision) {
      const { bar, decision, panel } = this.hoverDecision;
      const p = this.panels[panel]!;
      this.hoverIdx = bar;
      this.hoverPanel = panel;
      this.hoverY = this.panelTop(panel) + p.headerHeight
        + yPos(decision.value, p.yMin, p.yMax, Math.max(1, p.height - p.headerHeight));
    }
    if (!e.buttons) {
      this.eventSurface.style.cursor = this.hoverDecision ? 'pointer' : this.interactive ? 'crosshair' : 'default';
    }
    if (!this.comparing && this.decisions?.length && this.hoverIdx >= 0) {
      const bucket = this.decisionIndex.nearest(this.hoverIdx);
      this.decisionInspector.show(bucket);
      this.eventSurface.title = bucket.map(d => `${d.action}: ${d.card.title} · ${d.card.status}`).join('\n');
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
        if (p === this.panels[0]) this.syncDecisionLegend();
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
        if (this.buf && isTimePanel(p.spec.kind) && this.decisions.length) {
          const ctx = p.seriesCtx;
          ctx.save();
          ctx.translate(0, p.headerHeight);
          renderDecisions({
            ctx, width: p.width, height: Math.max(1, p.height - p.headerHeight),
            viewport: this.viewport, yMin: p.yMin, yMax: p.yMax, theme: this.effectiveTheme,
          }, this.decisionIndex, p.spec.id);
          ctx.restore();
        }
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
        p.drawOverlay(this.effectiveTheme, this.viewport, cross);
        if (this.comparing && isTimePanel(p.spec.kind) && this.comparisonTimes.length) {
          const ctx = p.overlayCtx;
          ctx.save();
          ctx.strokeStyle = this.effectiveTheme.accent;
          ctx.fillStyle = this.effectiveTheme.accent;
          ctx.lineWidth = 1;
          ctx.font = '11px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.setLineDash([4, 3]);
          comparisonIndices(this.buf, this.comparisonTimes).forEach((bar, point) => {
            if (bar < 0 || bar < this.viewport.startIdx || bar > this.viewport.endIdx) return;
            const x = xCenter(bar, this.viewport, p.width);
            ctx.beginPath();
            ctx.moveTo(x, p.headerHeight);
            ctx.lineTo(x, p.height);
            ctx.stroke();
            ctx.fillText(`P${point + 1}`, x + 4, p.headerHeight + 4);
          });
          ctx.restore();
        }
        p.drawHoverValues(this.effectiveTheme, this.hoverIdx, this.titleStyle, this.legendPosition !== 'overlay');
        const hit = this.selectedDecision ?? this.hoverDecision;
        if (hit?.panel === i && hit.bar >= this.viewport.startIdx && hit.bar <= this.viewport.endIdx) {
          const ctx = p.overlayCtx;
          const height = Math.max(1, p.height - p.headerHeight);
          ctx.save();
          ctx.translate(0, p.headerHeight);
          ctx.beginPath();
          ctx.rect(0, 0, p.width, height);
          ctx.clip();
          ctx.beginPath();
          ctx.arc(decisionX(hit.bar, this.viewport, p.width, hit.decision), yPos(hit.decision.value, p.yMin, p.yMax, height), 7, 0, Math.PI * 2);
          ctx.strokeStyle = decisionColor(hit.decision.action, hit.decision.direction, hit.decision.card.status, hit.decision.signalType);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
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
    return this.panels[idx]!.el.getBoundingClientRect().top
      - this.panelsContainer.getBoundingClientRect().top;
  }

}

export function createChart(container: HTMLElement, options?: ChartOptions): Chart {
  return new Chart(container, options);
}
