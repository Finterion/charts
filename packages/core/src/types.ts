export interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Type-only import to avoid a runtime cycle with ./themes (which imports
// `ThemeTokens` from this file).
import type { ThemeName } from './themes';

export interface OHLCBuffer {
  length: number;
  time: Float64Array;
  open: Float32Array;
  high: Float32Array;
  low: Float32Array;
  close: Float32Array;
  volume: Float32Array;
}

export type SeriesType = 'candles' | 'line' | 'area';

export interface ThemeTokens {
  bg: string;
  surface: string;
  border: string;
  text: string;
  textDim: string;
  grid: string;
  up: string;
  upGlow: string;
  down: string;
  downGlow: string;
  accent: string;
  accentGlow: string;
  magenta: string;
  lime: string;
}

export interface Viewport {
  startIdx: number;
  endIdx: number;
}

export interface TradeMarker {
  time: number;
  side: 'buy' | 'sell';
  price: number;
  label?: string;
}

export type IndicatorKind = 'line' | 'histogram' | 'area' | 'band';

/**
 * Stroke style for line-based indicator kinds (`line`, `area`, `band`).
 * Has no effect on `histogram`. Default: `'solid'`.
 */
export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface IndicatorSeries {
  values: Float32Array;
  kind: IndicatorKind;
  color: string;
  glow?: string;
  /**
   * Stroke style for line-based kinds (`line`, `area`, `band`). Default `'solid'`.
   * Ignored for `histogram`.
   */
  lineStyle?: LineStyle;
  /**
   * For `kind: 'histogram'` only — the color used for negative bars.
   * If omitted, `color` is used for all bars.
   */
  colorNegative?: string;
  /**
   * For `kind: 'band'` only — the lower bound of the band. `values` is treated
   * as the upper bound. The renderer fills the polygon between the two with a
   * vertical gradient and strokes both edges with `color`.
   */
  lowerValues?: Float32Array;
  /** Reference lines drawn on the panel (e.g. RSI 30/70). */
  refLines?: number[];
  /** Fixed y-range; if omitted, autoscale to data. */
  yRange?: [number, number];
  /**
   * Stable identifier — surfaced in the inline-legend toggle callback so
   * external state stores can persist visibility. Falls back to `label`,
   * then to a positional id if neither is set.
   */
  id?: string;
  /**
   * Display name used by the inline legend. When at least one series in a
   * panel has a `label`, an inline legend with eye-toggle buttons is rendered
   * automatically (unless explicitly suppressed via `ChartOptions.showLegend`).
   */
  label?: string;
  /**
   * Optional secondary metric shown alongside the label in the legend (e.g.
   * `"+35.2%"` or `"σ 0.21"`). Rendered in tabular monospace, right-aligned
   * in external (`right` / `bottom`) legend positions, and trailing the label
   * in overlay mode. Useful when you have many series and want stats to line
   * up in columns.
   */
  metric?: string;
  /**
   * Explicit opt-in/out for the legend toggle UI.
   * - `true`: always show this series in the legend with an eye toggle, even
   *   without a `label` (a fallback label is derived from `id`).
   * - `false`: never include this series in the legend, even if it has a
   *   `label`.
   * - `undefined` (default): infer from `label` — present means toggleable,
   *   absent means not. Mirrors the existing `'auto'` legend behavior.
   */
  toggleable?: boolean;
  /**
   * If true, the series is skipped during rendering. The legend toggle mutates
   * this flag in place and triggers a redraw.
   */
  hidden?: boolean;
}

/** Time-indexed panels share the OHLC viewport; non-time panels are self-contained. */
export type PanelKind =
  | 'price'
  | 'indicator'
  | 'heatmap'
  | 'hbar'
  | 'histogram'
  | 'scatter';

/** 2D grid of values (rows × cols), drawn as colored cells with optional cell labels. */
export interface HeatmapData {
  rows: string[];
  cols: string[];
  /** [rowIndex][colIndex]; missing entries (`null`) render blank. */
  values: (number | null)[][];
  /** Per-cell label formatter. Default: `(v) => v.toFixed(1)`. */
  format?: (v: number) => string;
  /** Symmetric color range. Default: `max(|v|)` of the data. */
  range?: number;
  /** Custom color scale; `t` is in `[-1, 1]`. Default: red→white→blue. */
  colorScale?: (t: number) => string;
  xLabel?: string;
  yLabel?: string;
}

/** Horizontal bar chart with categorical y-axis and value x-axis. */
export interface HBarData {
  /** y-axis labels, top to bottom. */
  categories: string[];
  /** Numeric value for each category (same length as `categories`). */
  values: number[];
  /** Color for positive bars. Default: theme.up. */
  positiveColor?: string;
  /** Color for negative bars. Default: theme.down. */
  negativeColor?: string;
  /** Draw a dashed mean line. Default: false. */
  showMean?: boolean;
  /** Value label formatter. Default: `(v) => v.toFixed(1)`. */
  format?: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
}

/** Value-x histogram (distinct from indicator-kind 'histogram', which is bar-indexed). */
export interface HistogramData {
  /** Raw observations to be binned. */
  values: number[];
  /** Number of equal-width bins. Default: 20. */
  bins?: number;
  /** Bar fill color. Default: theme.accent. */
  color?: string;
  /** Draw a dashed mean line. Default: false. */
  showMean?: boolean;
  /** x-tick label formatter. */
  formatX?: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
}

/** Free 2D scatter plot. */
export interface ScatterData {
  points: { x: number; y: number }[];
  pointColor?: string;
  pointRadius?: number;
  /** Draw the y = x reference line. Default: false. */
  identityLine?: boolean;
  /** Force x-axis range. */
  xRange?: [number, number];
  /** Force y-axis range. */
  yRange?: [number, number];
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
}

export interface PanelSpec {
  /** Stable id used for crosshair sync and updates. */
  id: string;
  /** Render kind. */
  kind: PanelKind;
  /** Height as a flex weight. Total weights normalise to 1. */
  weight: number;
  /** Optional title shown top-left of the panel. */
  title?: string;
  /** For 'price' panels. */
  type?: SeriesType;
  /** For 'indicator' panels. */
  indicator?: IndicatorSeries;
  /** Optional secondary lines (e.g. EMA overlays on price). */
  overlays?: IndicatorSeries[];
  /** Override the title color for this panel. Falls back to `ChartOptions.titleColor`, then theme. */
  titleColor?: string;
  /** For 'heatmap' panels. */
  heatmap?: HeatmapData;
  /** For 'hbar' panels. */
  hbar?: HBarData;
  /** For 'histogram' panels. */
  histogram?: HistogramData;
  /** For 'scatter' panels. */
  scatter?: ScatterData;
}

export interface ChartOptions {
  theme?: ThemeTokens | ThemeName;
  panels?: PanelSpec[];
  markers?: TradeMarker[];
  /** Initial viewport. Defaults to the last ~200 bars (see `initialFit`). */
  viewport?: Viewport;
  /**
   * How to choose the initial viewport when `viewport` is not provided.
   * - `'recent'` (default): show the last ~200 bars (good for live feeds).
   * - `'all'`: fit every bar in the buffer — useful for backtest equity
   *   curves and other static datasets.
   */
  initialFit?: 'recent' | 'all';
  /**
   * Initial zoom level as a percentage of the total buffer visible.
   * - `100` (or omitted with `initialFit: 'all'`): fully zoomed out — every
   *   bar in the buffer is visible.
   * - smaller values zoom IN (fewer bars visible). e.g. `25` shows the most
   *   recent quarter of the buffer.
   * - must be in the half-open range `(0, 100]`.
   *
   * When omitted, the engine falls back to `initialFit` (~200 bars by default).
   * When set, `initialZoom` overrides `initialFit`.
   */
  initialZoom?: number;
  /** Pixel gap between stacked panels. Default 0. */
  panelGap?: number;
  /** Default title color for all panels. Per-panel `titleColor` overrides this. */
  titleColor?: string;
  /** Padding (in px) of the panel title from the top-left corner. Default `{ top: 8, left: 8 }`. */
  titlePadding?: { top?: number; left?: number };
  /** Title font size in px. Default 11. */
  titleFontSize?: number;
  /** Pixels reserved at the top of every panel for the title (data is not drawn there). Default 0. */
  titleSpace?: number;
  /** Show the bottom time axis. Default true. */
  showTimeAxis?: boolean;
  /**
   * Background grid style.
   * - `'horizontal'` (default): only horizontal price-axis lines
   * - `'full'`: horizontal price lines + vertical time-axis lines
   * - `'none'`: no grid lines (price labels still drawn)
   */
  gridStyle?: 'none' | 'horizontal' | 'full';
  /** Override the chart container background (any CSS color). Defaults to `theme.bg`. */
  background?: string;
  /** Override the grid + axis line color (any CSS color). Defaults to `theme.grid`. */
  gridColor?: string;
  /**
   * Show an inline legend with eye-toggle buttons for any indicator series
   * that has a `label`. Default: `'auto'` — show only when at least one
   * series in a panel has a label. Set to `false` to suppress entirely, or
   * `true` to always render even unlabeled series.
   */
  showLegend?: boolean | 'auto';
  /**
   * Where the legend lives relative to the chart canvas.
   * - `'overlay'` (default): legend floats on top of the plot in the top-right
   *   corner of each panel. Great for ≤ 4 series; can crowd the plot for many.
   * - `'right'`: legend renders in a vertical sidebar to the right of the
   *   chart. Best for many series — never overlaps data.
   * - `'bottom'`: legend renders as a compact multi-column grid below the
   *   chart (above the time axis). Best when vertical room is plentiful.
   */
  legendPosition?: 'overlay' | 'right' | 'bottom';
  /**
   * Width (in px) of the external legend when `legendPosition === 'right'`.
   * Default `200`.
   */
  legendWidth?: number;
  /**
   * Max height (in px) of the external legend when `legendPosition === 'bottom'`.
   * Content scrolls vertically when it exceeds this. Default `120`.
   */
  legendMaxHeight?: number;
  /**
   * Fired when a user toggles a series via the inline legend. Receives the
   * panel id, the series id (falls back to `label`/positional id), and the
   * new `hidden` value. Use this to persist toggle state across re-renders.
   */
  onSeriesVisibilityChange?: (panelId: string, seriesId: string, hidden: boolean) => void;
  /**
   * Fired when a user collapses or expands an entire pane via the title
   * toggle. Only applies to panels other than the first one (the price pane
   * is never collapsible).
   */
  onPaneCollapseChange?: (panelId: string, collapsed: boolean) => void;
}
