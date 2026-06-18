import { useEffect, useRef } from 'react';
import {
  Chart as CoreChart,
  createBuffer,
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
  className?: string;
  style?: React.CSSProperties;
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

  return <div ref={containerRef} className={props.className} style={{ width: '100%', height: '100%', ...props.style }} />;
}
