/**
 * @finterion/charts-spec
 *
 * A JSON-only declarative schema for Finterion Charts. The runtime API takes
 * typed arrays and JS callbacks; this layer takes plain JSON so it can be:
 *
 *  1. produced by an LLM (function-calling / structured output)
 *  2. embedded in forum posts (markdown fences, URL-encoded links, iframes)
 *  3. round-tripped through any transport (no Float32Array, no functions)
 *
 * The compiler converts a `ChartSpec` into the imperative shape the engine
 * already understands: `{ data, panels, options }`.
 */

export { CHART_SPEC_SCHEMA } from './schema';

import type {
  BrandingOptions,
  ChartOptions,
  HBarData,
  HeatmapData,
  HistogramData,
  IndicatorKind,
  IndicatorSeries,
  LineStyle,
  OHLC,
  PanelKind,
  PanelSpec,
  ScatterData,
  SeriesType,
  ThemeName,
  TradeMarker,
} from '@finterion/charts-core';

// Re-export so consumers can `import type { LineStyle } from '@finterion/charts-spec'`.
export type { LineStyle, ThemeName, IndicatorKind, BrandingOptions } from '@finterion/charts-core';

/** JSON form of `BrandingOptions` — same shape, alias for spec consumers. */
export type BrandingSpec = BrandingOptions;

// ─────────────────────────────────────────────────────────────────────────────
// 1.  Spec types  (pure JSON — no functions, no typed arrays)
// ─────────────────────────────────────────────────────────────────────────────

/** Format directive understood by the built-in formatter registry. */
export type FormatDirective =
  | 'pct0' // 12%
  | 'pct1' // 12.3%
  | 'pct2' // 12.34%
  | 'fixed0' // 12
  | 'fixed1' // 12.3
  | 'fixed2' // 12.34
  | 'short-num' // 1.2k, 3.4M
  | 'iso-date'; // 2024-05-01

export interface ChartSpec {
  /** Spec schema version. Always 1 for now. */
  version: 1;

  /** Named datasets referenced by panels via `column`/`series` ids. */
  data?: {
    /** Time-indexed bars. Required if any panel has `kind: 'price'` or `kind: 'indicator'`. */
    bars?: {
      time: number[]; // unix seconds (or ms — engine accepts either)
      open: number[];
      high: number[];
      low: number[];
      close: number[];
      volume?: number[];
    };
    /** Free-form numeric columns. Indicator panels may reference these by name.
     *  `null` entries represent gaps (rendered as NaN — line breaks at gaps). */
    columns?: Record<string, (number | null)[]>;
    /** Trade markers. */
    markers?: TradeMarker[];
  };

  display?: {
    theme?: ThemeName;
    background?: string;
    gridColor?: string;
    gridStyle?: 'none' | 'horizontal' | 'full';
    panelGap?: number;
    titleColor?: string;
    titleFontSize?: number;
    titleSpace?: number;
    showTimeAxis?: boolean;
    /** Show inline legend with toggles. `'auto'` (default) shows it for any panel that has labeled series. */
    showLegend?: boolean | 'auto';
    /**
     * Initial zoom as a percentage of the buffer visible. `100` = fully
     * zoomed out (all bars); smaller values zoom IN (fewer bars). Range:
     * `(0, 100]`. When omitted, the engine falls back to `initialFit`
     * (~200 bars by default).
     */
    initialZoom?: number;
    /**
     * "Powered by Finterion" attribution badge. Default: shown.
     * Set to `false` to hide the badge — subject to the LICENSE
     * trademark policy. Pass an object to customize the badge contents.
     */
    branding?: boolean | BrandingSpec;
  };

  panels: PanelSpecSpec[];
}

/** JSON form of a PanelSpec. Discriminated by `kind`. */
export type PanelSpecSpec =
  | PricePanelSpec
  | IndicatorPanelSpec
  | HeatmapPanelSpec
  | HBarPanelSpec
  | HistogramPanelSpec
  | ScatterPanelSpec;

export interface BasePanelSpec {
  id: string;
  weight: number;
  title?: string;
  titleColor?: string;
}

export interface PricePanelSpec extends BasePanelSpec {
  kind: 'price';
  type?: SeriesType;
  /** Overlays drawn on top of price (e.g. EMAs, Bollinger Bands). */
  overlays?: IndicatorSeriesSpec[];
}

export interface IndicatorPanelSpec extends BasePanelSpec {
  kind: 'indicator';
  indicator: IndicatorSeriesSpec;
  overlays?: IndicatorSeriesSpec[];
}

export interface IndicatorSeriesSpec {
  /** Either a literal numeric array OR a `data.columns` key reference.
   *  `null` entries represent gaps (rendered as NaN). */
  values: (number | null)[] | { column: string };
  kind: IndicatorKind;
  color: string;
  glow?: string;
  /**
   * Stroke style for `line`, `area`, `band`. Default `'solid'`.
   * No effect on `histogram`.
   */
  lineStyle?: LineStyle;
  colorNegative?: string;
  /** For `kind: 'band'` only. Same shape as `values`. */
  lowerValues?: (number | null)[] | { column: string };
  refLines?: number[];
  yRange?: [number, number];
  /** Stable id surfaced in the visibility-change callback. */
  id?: string;
  /** Display name for the inline legend; presence opts the series into the toggle UI. */
  label?: string;
  /** Optional right-aligned metric shown next to `label` (e.g. "+35.2%"). */
  metric?: string;
  /** Explicit override for the legend toggle UI. `true` forces inclusion, `false` excludes. Default: infer from `label`. */
  toggleable?: boolean;
  /** If true, the series starts hidden. Toggling the legend mutates this flag. */
  hidden?: boolean;
}

export interface HeatmapPanelSpec extends BasePanelSpec {
  kind: 'heatmap';
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  /** Format directive for cell labels. Default: 'fixed1'. */
  format?: FormatDirective;
  range?: number;
  /** Diverging color scale endpoints — defaults to red→white→blue. */
  colorScale?: { neg: string; mid: string; pos: string };
  xLabel?: string;
  yLabel?: string;
}

export interface HBarPanelSpec extends BasePanelSpec {
  kind: 'hbar';
  categories: string[];
  values: number[];
  positiveColor?: string;
  negativeColor?: string;
  showMean?: boolean;
  format?: FormatDirective;
  xLabel?: string;
  yLabel?: string;
}

export interface HistogramPanelSpec extends BasePanelSpec {
  kind: 'histogram';
  values: number[];
  bins?: number;
  color?: string;
  showMean?: boolean;
  formatX?: FormatDirective;
  xLabel?: string;
  yLabel?: string;
}

export interface ScatterPanelSpec extends BasePanelSpec {
  kind: 'scatter';
  points: { x: number; y: number }[];
  pointColor?: string;
  pointRadius?: number;
  identityLine?: boolean;
  xRange?: [number, number];
  yRange?: [number, number];
  formatX?: FormatDirective;
  formatY?: FormatDirective;
  xLabel?: string;
  yLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  Format registry  (string directives → JS formatter functions)
// ─────────────────────────────────────────────────────────────────────────────

const SHORT_NUM_UNITS: [number, string][] = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k'],
];

function shortNum(v: number): string {
  const abs = Math.abs(v);
  for (const [scale, unit] of SHORT_NUM_UNITS) {
    if (abs >= scale) return `${(v / scale).toFixed(1)}${unit}`;
  }
  return v.toFixed(1);
}

export const FORMATTERS: Record<FormatDirective, (v: number) => string> = {
  pct0: (v) => `${(v * 100).toFixed(0)}%`,
  pct1: (v) => `${(v * 100).toFixed(1)}%`,
  pct2: (v) => `${(v * 100).toFixed(2)}%`,
  fixed0: (v) => v.toFixed(0),
  fixed1: (v) => v.toFixed(1),
  fixed2: (v) => v.toFixed(2),
  'short-num': shortNum,
  'iso-date': (v) => new Date(v).toISOString().slice(0, 10),
};

function fmt(d: FormatDirective | undefined): ((v: number) => string) | undefined {
  return d ? FORMATTERS[d] : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  Validator  (cheap, dependency-free)
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const PANEL_KINDS: PanelKind[] = ['price', 'indicator', 'heatmap', 'hbar', 'histogram', 'scatter'];

export function validateSpec(spec: unknown): ValidationResult {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

  if (!spec || typeof spec !== 'object') {
    return { ok: false, errors: ['spec must be an object'] };
  }
  const s = spec as Partial<ChartSpec>;
  if (s.version !== 1) push(`version must be 1 (got ${String(s.version)})`);
  if (!Array.isArray(s.panels)) {
    push('panels must be an array');
    return { ok: false, errors };
  }

  const ids = new Set<string>();
  s.panels.forEach((p, i) => {
    if (!p || typeof p !== 'object') return push(`panels[${i}] must be an object`);
    if (typeof p.id !== 'string' || !p.id) push(`panels[${i}].id is required`);
    else if (ids.has(p.id)) push(`panels[${i}].id "${p.id}" is duplicated`);
    else ids.add(p.id);
    if (!PANEL_KINDS.includes(p.kind)) push(`panels[${i}].kind "${String(p.kind)}" is invalid`);
    if (typeof p.weight !== 'number' || p.weight <= 0) push(`panels[${i}].weight must be a positive number`);
  });

  const hasTimePanel = s.panels.some((p) => p?.kind === 'price' || p?.kind === 'indicator');
  if (hasTimePanel && !s.data?.bars) {
    push('data.bars is required when a price/indicator panel is present');
  }

  return { ok: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  Compiler  (ChartSpec → engine-ready { data, panels, options })
// ─────────────────────────────────────────────────────────────────────────────

export interface CompiledChart {
  data: OHLC[] | undefined;
  panels: PanelSpec[];
  options: ChartOptions;
  markers: TradeMarker[] | undefined;
}

export function compileSpec(spec: ChartSpec): CompiledChart {
  const v = validateSpec(spec);
  if (!v.ok) throw new Error(`Invalid ChartSpec:\n  - ${v.errors.join('\n  - ')}`);

  const data = spec.data?.bars ? barsToOHLC(spec.data.bars) : undefined;
  const columns = spec.data?.columns ?? {};
  const panels = spec.panels.map((p) => compilePanel(p, columns));

  const options: ChartOptions = {
    ...(spec.display?.theme !== undefined ? { theme: spec.display.theme } : {}),
    ...(spec.display?.background !== undefined ? { background: spec.display.background } : {}),
    ...(spec.display?.gridColor !== undefined ? { gridColor: spec.display.gridColor } : {}),
    ...(spec.display?.gridStyle !== undefined ? { gridStyle: spec.display.gridStyle } : {}),
    ...(spec.display?.panelGap !== undefined ? { panelGap: spec.display.panelGap } : {}),
    ...(spec.display?.titleColor !== undefined ? { titleColor: spec.display.titleColor } : {}),
    ...(spec.display?.titleFontSize !== undefined ? { titleFontSize: spec.display.titleFontSize } : {}),
    ...(spec.display?.titleSpace !== undefined ? { titleSpace: spec.display.titleSpace } : {}),
    ...(spec.display?.showTimeAxis !== undefined ? { showTimeAxis: spec.display.showTimeAxis } : {}),
    ...(spec.display?.showLegend !== undefined ? { showLegend: spec.display.showLegend } : {}),
    ...(spec.display?.initialZoom !== undefined ? { initialZoom: spec.display.initialZoom } : {}),
    ...(spec.display?.branding !== undefined ? { branding: spec.display.branding } : {}),
  };

  return { data, panels, options, markers: spec.data?.markers };
}

function barsToOHLC(b: NonNullable<NonNullable<ChartSpec['data']>['bars']>): OHLC[] {
  const n = b.time.length;
  const out: OHLC[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row: OHLC = {
      time: b.time[i] as number,
      open: b.open[i] as number,
      high: b.high[i] as number,
      low: b.low[i] as number,
      close: b.close[i] as number,
    };
    if (b.volume) row.volume = b.volume[i] as number;
    out[i] = row;
  }
  return out;
}

function resolveValues(
  v: (number | null)[] | { column: string },
  columns: Record<string, (number | null)[]>,
): Float32Array {
  // NB: `new Float32Array([null])` coerces null → 0, NOT NaN. JSON gap values
  // (e.g. pandas NaN serialised as null) must become NaN so the renderers can
  // break the line at gaps. We allocate and fill manually to preserve NaN.
  const src = Array.isArray(v) ? v : columns[v.column];
  if (!src) throw new Error(`Unknown column reference: "${(v as { column: string }).column}"`);
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const x = src[i];
    out[i] = x == null ? NaN : (x as number);
  }
  return out;
}

function compileIndicator(s: IndicatorSeriesSpec, columns: Record<string, (number | null)[]>): IndicatorSeries {
  const out: IndicatorSeries = {
    values: resolveValues(s.values, columns),
    kind: s.kind,
    color: s.color,
  };
  if (s.glow !== undefined) out.glow = s.glow;
  if (s.lineStyle !== undefined) out.lineStyle = s.lineStyle;
  if (s.colorNegative !== undefined) out.colorNegative = s.colorNegative;
  if (s.lowerValues !== undefined) out.lowerValues = resolveValues(s.lowerValues, columns);
  if (s.refLines !== undefined) out.refLines = s.refLines;
  if (s.yRange !== undefined) out.yRange = s.yRange;
  if (s.id !== undefined) out.id = s.id;
  if (s.label !== undefined) out.label = s.label;
  if (s.metric !== undefined) out.metric = s.metric;
  if (s.toggleable !== undefined) out.toggleable = s.toggleable;
  if (s.hidden !== undefined) out.hidden = s.hidden;
  return out;
}

function compilePanel(p: PanelSpecSpec, columns: Record<string, (number | null)[]>): PanelSpec {
  const base: PanelSpec = {
    id: p.id,
    kind: p.kind,
    weight: p.weight,
  };
  if (p.title !== undefined) base.title = p.title;
  if (p.titleColor !== undefined) base.titleColor = p.titleColor;

  switch (p.kind) {
    case 'price': {
      if (p.type !== undefined) base.type = p.type;
      if (p.overlays) base.overlays = p.overlays.map((o) => compileIndicator(o, columns));
      return base;
    }
    case 'indicator': {
      base.indicator = compileIndicator(p.indicator, columns);
      if (p.overlays) base.overlays = p.overlays.map((o) => compileIndicator(o, columns));
      return base;
    }
    case 'heatmap': {
      const h: HeatmapData = {
        rows: p.rows,
        cols: p.cols,
        values: p.values,
      };
      const f = fmt(p.format);
      if (f) h.format = f;
      if (p.range !== undefined) h.range = p.range;
      if (p.colorScale) {
        const { neg, mid, pos } = p.colorScale;
        h.colorScale = makeDivergingScale(neg, mid, pos);
      }
      if (p.xLabel !== undefined) h.xLabel = p.xLabel;
      if (p.yLabel !== undefined) h.yLabel = p.yLabel;
      base.heatmap = h;
      return base;
    }
    case 'hbar': {
      const h: HBarData = {
        categories: p.categories,
        values: p.values,
      };
      if (p.positiveColor !== undefined) h.positiveColor = p.positiveColor;
      if (p.negativeColor !== undefined) h.negativeColor = p.negativeColor;
      if (p.showMean !== undefined) h.showMean = p.showMean;
      const f = fmt(p.format);
      if (f) h.format = f;
      if (p.xLabel !== undefined) h.xLabel = p.xLabel;
      if (p.yLabel !== undefined) h.yLabel = p.yLabel;
      base.hbar = h;
      return base;
    }
    case 'histogram': {
      const h: HistogramData = { values: p.values };
      if (p.bins !== undefined) h.bins = p.bins;
      if (p.color !== undefined) h.color = p.color;
      if (p.showMean !== undefined) h.showMean = p.showMean;
      const fx = fmt(p.formatX);
      if (fx) h.formatX = fx;
      if (p.xLabel !== undefined) h.xLabel = p.xLabel;
      if (p.yLabel !== undefined) h.yLabel = p.yLabel;
      base.histogram = h;
      return base;
    }
    case 'scatter': {
      const s: ScatterData = { points: p.points };
      if (p.pointColor !== undefined) s.pointColor = p.pointColor;
      if (p.pointRadius !== undefined) s.pointRadius = p.pointRadius;
      if (p.identityLine !== undefined) s.identityLine = p.identityLine;
      if (p.xRange !== undefined) s.xRange = p.xRange;
      if (p.yRange !== undefined) s.yRange = p.yRange;
      const fx = fmt(p.formatX);
      const fy = fmt(p.formatY);
      if (fx) s.formatX = fx;
      if (fy) s.formatY = fy;
      if (p.xLabel !== undefined) s.xLabel = p.xLabel;
      if (p.yLabel !== undefined) s.yLabel = p.yLabel;
      base.scatter = s;
      return base;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseHex(c: string): [number, number, number] {
  const m = c.replace('#', '');
  const v = m.length === 3
    ? m.split('').map((ch) => parseInt(ch + ch, 16))
    : [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
}

function makeDivergingScale(neg: string, mid: string, pos: string): (t: number) => string {
  const n = parseHex(neg);
  const m = parseHex(mid);
  const p = parseHex(pos);
  return (t: number) => {
    const k = Math.max(-1, Math.min(1, t));
    const [a, b] = k < 0 ? [n, m] : [m, p];
    const u = k < 0 ? k + 1 : k;
    const r = Math.round((a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * u);
    const g = Math.round((a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * u);
    const bl = Math.round((a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * u);
    return `rgb(${r},${g},${bl})`;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.  Capability discovery  (for LLM prompts)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartCapabilities {
  version: 1;
  panelKinds: PanelKind[];
  indicatorKinds: IndicatorKind[];
  seriesTypes: SeriesType[];
  formatDirectives: FormatDirective[];
  themes: ThemeName[];
  gridStyles: ('none' | 'horizontal' | 'full')[];
}

export function getChartCapabilities(): ChartCapabilities {
  return {
    version: 1,
    panelKinds: [...PANEL_KINDS],
    indicatorKinds: ['line', 'histogram', 'area', 'band'],
    seriesTypes: ['candles', 'line', 'area'],
    formatDirectives: [
      'pct0',
      'pct1',
      'pct2',
      'fixed0',
      'fixed1',
      'fixed2',
      'short-num',
      'iso-date',
    ],
    themes: [
      'tradingview-light',
      'tradingview-dark',
      'terminal-light',
      'terminal-dark',
      'finterion-light',
      'finterion-dark',
    ],
    gridStyles: ['none', 'horizontal', 'full'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.  Encoding helpers  (URL-safe round-trips for forum embeds)
// ─────────────────────────────────────────────────────────────────────────────

/** Encode a ChartSpec to a URL-safe base64 string (no compression). */
export function encodeSpec(spec: ChartSpec): string {
  const json = JSON.stringify(spec);
  // base64url
  const b64 =
    typeof btoa !== 'undefined'
      ? btoa(unescape(encodeURIComponent(json)))
      : (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } })
          .Buffer!.from(json, 'utf-8')
          .toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSpec(encoded: string): ChartSpec {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const json =
    typeof atob !== 'undefined'
      ? decodeURIComponent(escape(atob(b64 + pad)))
      : (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } })
          .Buffer!.from(b64 + pad, 'base64')
          .toString('utf-8');
  return JSON.parse(json) as ChartSpec;
}
