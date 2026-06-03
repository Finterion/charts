export interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

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

export interface IndicatorSeries {
  values: Float32Array;
  kind: IndicatorKind;
  color: string;
  glow?: string;
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
  theme?: ThemeTokens | 'finterion-dark' | 'finterion-light';
  panels?: PanelSpec[];
  markers?: TradeMarker[];
  /** Initial viewport. Defaults to the last ~200 bars. */
  viewport?: Viewport;
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
}
