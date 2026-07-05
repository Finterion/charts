import { useEffect, useMemo, useRef } from 'react';
import {
  Chart as CoreChart,
  createBuffer,
  resolveTheme,
  type BrandingOptions,
  type ChartOptions,
  type OHLC,
  type PanelSpec,
  type ThemeName,
  type ThemeTokens,
  type TradeMarker,
  type Viewport,
} from '@finterion/charts-core';

export interface ChartProps {
  /** Time-indexed bar data. Optional for charts that only contain non-time panels (heatmap, hbar, histogram, scatter). */
  data?: OHLC[];
  panels: PanelSpec[];
  theme?: ThemeTokens | ThemeName;
  markers?: TradeMarker[];
  viewport?: Viewport;
  onViewportChange?: (vp: Viewport) => void;
  /**
   * How to choose the initial viewport when `viewport` is not provided.
   * `'recent'` (default) shows the last ~200 bars; `'all'` fits every bar
   * (good for backtest equity curves and other static datasets).
   */
  initialFit?: 'recent' | 'all';
  /**
   * Initial viewport as a percentage of the buffer visible. `(0, 100]`.
   * `100` = fully zoomed out (all bars). Smaller values zoom in
   * (e.g. `25` shows the most recent quarter). When set, overrides `initialFit`.
   */
  initialZoom?: number;
  /** Pixel gap between stacked panels. */
  panelGap?: number;
  /** Default title color for all panels. */
  titleColor?: string;
  /** Padding (in px) of panel titles. */
  titlePadding?: { top?: number; left?: number };
  /** Title font size in px. */
  titleFontSize?: number;
  /** Pixels reserved at the top of every panel for the title. Default 0. */
  titleSpace?: number;
  /** Show the bottom time axis. Default true. */
  showTimeAxis?: boolean;
  /** Background grid style. Default `'horizontal'`. */
  gridStyle?: 'none' | 'horizontal' | 'full';
  /** Override container background. Defaults to `theme.bg`. */
  background?: string;
  /** Override grid + axis line color. Defaults to `theme.grid`. */
  gridColor?: string;
  /** Show inline legend with eye-toggle buttons. `'auto'` (default) shows it for any panel that has labeled series. */
  showLegend?: boolean | 'auto';
  /**
   * Where the legend lives. `'overlay'` (default) floats on top of the
   * chart in the top-right; `'right'` renders a sidebar to the right of the
   * chart; `'bottom'` renders a compact strip beneath the chart. Use the
   * external positions when you have many series.
   */
  legendPosition?: 'overlay' | 'right' | 'bottom';
  /** Width (px) of the right-side legend sidebar. Default `200`. */
  legendWidth?: number;
  /** Max height (px) of the bottom legend strip. Default `120`. */
  legendMaxHeight?: number;
  /** Fired when a user toggles a series via the inline legend. */
  onSeriesVisibilityChange?: (panelId: string, seriesId: string, hidden: boolean) => void;
  /** Fired when a user collapses/expands a non-first pane via the title toggle. */
  onPaneCollapseChange?: (panelId: string, collapsed: boolean) => void;
  /**
   * "Powered by Finterion" attribution badge. `true`/omitted shows the badge,
   * `false` hides it (subject to the LICENSE trademark policy), or pass a
   * `BrandingOptions` object to customize text/SVG/position/colour.
   */
  branding?: boolean | BrandingOptions;
  /** Disable mouse/touch pan and zoom. Default `true`. Set to `false` for static charts. */
  interactive?: boolean;
  /**
   * Custom time-axis label format. Accepts a format string (e.g. `'MMM YYYY'`,
   * `'DD/MM/YYYY'`) or a `(t: number) => string` callback receiving a
   * ms-epoch timestamp. When omitted the built-in adaptive formatter is used.
   */
  timeFormat?: string | ((t: number) => string);
  /**
   * When `true`, renders a semi-transparent overlay with a spinner on top of
   * the chart. Use while data is being fetched or computed. The chart engine
   * stays mounted so there is no remount cost when loading transitions to false.
   */
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// ----------------------------------------------------------------------------
// MUI-style circular progress spinner, theme-aware
// ----------------------------------------------------------------------------
const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~125.66

function ChartSpinner({ theme }: { theme?: ThemeTokens | ThemeName }) {
  const color = useMemo(() => resolveTheme(theme).accent, [theme]);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.08) 70%, transparent 100%)',
        borderRadius: 'inherit',
        zIndex: 10,
      }}
    >
      <style>{`
        @keyframes _fi-rotate { 0% { transform: rotate(-90deg) } 100% { transform: rotate(270deg) } }
        @keyframes _fi-dash {
          0%   { stroke-dasharray: ${CIRCUMFERENCE * 0.05}px,${CIRCUMFERENCE}px; stroke-dashoffset: 0 }
          50%  { stroke-dasharray: ${CIRCUMFERENCE * 0.75}px,${CIRCUMFERENCE}px; stroke-dashoffset: ${-CIRCUMFERENCE * 0.25}px }
          100% { stroke-dasharray: ${CIRCUMFERENCE * 0.75}px,${CIRCUMFERENCE}px; stroke-dashoffset: ${-CIRCUMFERENCE}px }
        }
      `}</style>
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        style={{ animation: '_fi-rotate 1.4s linear infinite', display: 'block' }}
      >
        <circle
          cx="22" cy="22" r={RADIUS}
          stroke={color}
          strokeWidth="3.6"
          strokeLinecap="round"
          fill="none"
          style={{ animation: `_fi-dash 1.4s ease-in-out infinite` }}
        />
      </svg>
    </div>
  );
}

export function Chart(props: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CoreChart | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const opts: ChartOptions = {
      theme: props.theme,
      panels: props.panels,
      markers: props.markers,
      viewport: props.viewport,
      initialFit: props.initialFit,
      initialZoom: props.initialZoom,
      panelGap: props.panelGap,
      titleColor: props.titleColor,
      titlePadding: props.titlePadding,
      titleFontSize: props.titleFontSize,
      titleSpace: props.titleSpace,
      showTimeAxis: props.showTimeAxis,
      gridStyle: props.gridStyle,
      background: props.background,
      gridColor: props.gridColor,
      showLegend: props.showLegend,
      legendPosition: props.legendPosition,
      legendWidth: props.legendWidth,
      legendMaxHeight: props.legendMaxHeight,
      onSeriesVisibilityChange: props.onSeriesVisibilityChange,
      onPaneCollapseChange: props.onPaneCollapseChange,
      branding: props.branding,
      interactive: props.interactive,
      timeFormat: props.timeFormat,
    };
    chartRef.current = new CoreChart(containerRef.current, opts);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!props.data || props.data.length === 0) return;
    chartRef.current.setData(createBuffer(props.data));
  }, [props.data]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setPanels(props.panels);
  }, [props.panels]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setMarkers(props.markers ?? []);
  }, [props.markers]);

  useEffect(() => {
    if (!chartRef.current || !props.theme) return;
    chartRef.current.setTheme(props.theme);
  }, [props.theme]);

  useEffect(() => {
    if (!chartRef.current || !props.viewport) return;
    chartRef.current.setViewport(props.viewport);
  }, [props.viewport]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setTimeFormat(props.timeFormat);
  }, [props.timeFormat]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setDisplayOptions({
      panelGap: props.panelGap,
      titleColor: props.titleColor,
      titlePadding: props.titlePadding,
      titleFontSize: props.titleFontSize,
      titleSpace: props.titleSpace,
      showTimeAxis: props.showTimeAxis,
      gridStyle: props.gridStyle,
      background: props.background,
      gridColor: props.gridColor,
      showLegend: props.showLegend,
      legendPosition: props.legendPosition,
      legendWidth: props.legendWidth,
      legendMaxHeight: props.legendMaxHeight,
      onSeriesVisibilityChange: props.onSeriesVisibilityChange,
      onPaneCollapseChange: props.onPaneCollapseChange,
    });
  }, [props.panelGap, props.titleColor, props.titlePadding, props.titleFontSize, props.titleSpace, props.showTimeAxis, props.gridStyle, props.background, props.gridColor, props.showLegend, props.legendPosition, props.legendWidth, props.legendMaxHeight, props.onSeriesVisibilityChange, props.onPaneCollapseChange]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...props.style }} className={props.className}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {props.loading && <ChartSpinner theme={props.theme} />}
    </div>
  );
}
