import { useMemo } from 'react';
import { compileSpec, type ChartSpec } from '@finterion/charts-spec';
import { type ThemeName } from '@finterion/charts-core';
import { Chart } from './Chart';

export interface ChartFromSpecProps {
  /** Either a ChartSpec object, a JSON string, or null/undefined for empty state. */
  spec: ChartSpec | string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  /** Render this when `spec` is invalid. Defaults to a small inline error message. */
  fallback?: (error: Error) => React.ReactNode;
}

/**
 * Render a Finterion chart from a JSON-only `ChartSpec`.
 *
 * Designed for two use-cases:
 *   1. LLM-driven analysis sandboxes — the model emits a ChartSpec, the host
 *      validates it, this component renders it. No `eval`, no callbacks.
 *   2. Forum / iframe embeds — pair with `encodeSpec`/`decodeSpec` from
 *      `@finterion/charts-spec` to round-trip specs through URLs.
 */
export function ChartFromSpec({ spec, className, style, fallback }: ChartFromSpecProps) {
  const compiled = useMemo(() => {
    if (!spec) return { ok: false as const, error: new Error('No spec provided.') };
    try {
      const parsed: ChartSpec = typeof spec === 'string' ? (JSON.parse(spec) as ChartSpec) : spec;
      const c = compileSpec(parsed);
      return { ok: true as const, compiled: c };
    } catch (e) {
      return { ok: false as const, error: e as Error };
    }
  }, [spec]);

  if (!compiled.ok) {
    if (fallback) return <>{fallback(compiled.error)}</>;
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ff5252',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13,
          padding: 16,
          textAlign: 'center',
          ...style,
        }}
      >
        ⚠ {compiled.error.message}
      </div>
    );
  }

  const { data, panels, options, markers } = compiled.compiled;

  return (
    <Chart
      className={className}
      style={style}
      data={data}
      panels={panels}
      markers={markers}
      theme={options.theme as ThemeName | undefined}
      background={options.background}
      gridColor={options.gridColor}
      gridStyle={options.gridStyle}
      panelGap={options.panelGap}
      titleColor={options.titleColor}
      titleFontSize={options.titleFontSize}
      titleSpace={options.titleSpace}
      showTimeAxis={options.showTimeAxis}
      initialZoom={options.initialZoom}
    />
  );
}
