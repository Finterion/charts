import { useEffect, useRef } from 'react';
import {
  Chart as CoreChart,
  createBuffer,
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
      panelGap: props.panelGap,
      titleColor: props.titleColor,
      titlePadding: props.titlePadding,
      titleFontSize: props.titleFontSize,
      titleSpace: props.titleSpace,
      showTimeAxis: props.showTimeAxis,
      gridStyle: props.gridStyle,
      background: props.background,
      gridColor: props.gridColor,
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
    });
  }, [props.panelGap, props.titleColor, props.titlePadding, props.titleFontSize, props.titleSpace, props.showTimeAxis, props.gridStyle, props.background, props.gridColor]);

  return <div ref={containerRef} className={props.className} style={{ width: '100%', height: '100%', ...props.style }} />;
}
