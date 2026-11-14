import { indexAtTime } from '../data/buffer';
import type { IndicatorSeries, OHLCBuffer, PanelSpec, ThemeTokens } from '../types';
import { createInspectorResizeHandle } from './inspectorResize';

export interface ComparisonRow {
  label: string;
  values: (number | null)[];
}

export function comparisonIndices(buf: OHLCBuffer | null, times: number[]): number[] {
  return times.map(time => {
    if (!buf?.length) return -1;
    const index = indexAtTime(buf, time);
    return buf.time[index] === time ? index : -1;
  });
}

export function comparisonRows(panel: PanelSpec, buf: OHLCBuffer | null, indices: number[]): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const add = (label: string, values: ArrayLike<number>) => rows.push({
    label,
    values: indices.map(index => {
      const value = index >= 0 ? values[index] : undefined;
      return value !== undefined && Number.isFinite(value) ? value : null;
    }),
  });
  if (panel.kind === 'price' && buf) {
    for (const key of ['open', 'high', 'low', 'close', 'volume'] as const) {
      add(key[0]!.toUpperCase() + key.slice(1), buf[key]);
    }
  }
  const series = (s: IndicatorSeries, fallback: string) => {
    const label = `${s.label ?? s.id ?? fallback}${s.hidden ? ' (hidden)' : ''}`;
    add(s.kind === 'band' ? `${label} upper` : label, s.values);
    if (s.lowerValues) add(`${label} lower`, s.lowerValues);
  };
  if (panel.kind === 'indicator' && panel.indicator) series(panel.indicator, 'Indicator');
  for (const [i, overlay] of (panel.overlays ?? []).entries()) series(overlay, `Overlay ${i + 1}`);
  return rows;
}

export function comparisonChange(value: number | null, baseline: number | null): { absolute: number; percent: number | null } | null {
  if (value === null || baseline === null) return null;
  const absolute = value - baseline;
  if (!Number.isFinite(absolute)) return null;
  const percent = baseline === 0 ? null : absolute / Math.abs(baseline) * 100;
  return { absolute, percent: percent !== null && Number.isFinite(percent) ? percent : null };
}

const formatValue = (value: number | null): string => value === null ? 'N/A' : String(Number(value.toPrecision(7)));
const signed = (value: number): string => `${value > 0 ? '+' : ''}${formatValue(value)}`;

export class ComparisonInspector {
  readonly el = document.createElement('aside');
  private readonly resize;

  constructor(onResize?: () => void) {
    this.el.className = 'finterion-comparison';
    this.el.setAttribute('aria-label', 'Selected point comparison');
    this.el.style.display = 'none';
    this.resize = createInspectorResizeHandle(this.el, {
      label: 'Resize point comparison',
      defaultWidth: '440px',
      bounds: () => {
        const available = this.el.parentElement?.getBoundingClientRect().width;
        const maximum = available === undefined ? 800 : Math.max(0, Math.floor(available - 160));
        return { minimum: Math.min(220, maximum), maximum };
      },
      onResize,
    });
    this.resize.handle.className = 'comparison-resize-handle';
  }

  render(options: {
    times: number[];
    buf: OHLCBuffer | null;
    panels: PanelSpec[];
    theme: ThemeTokens;
    formatTime?: (time: number) => string;
    remove: (time: number) => void;
    clear: () => void;
    close: () => void;
  }) {
    const { times, buf, panels, theme } = options;
    const width = this.el.style.width || '440px';
    this.el.style.cssText = `display:flex;position:relative;flex-direction:column;flex:0 0 auto;width:${width};max-width:max(0px,calc(100% - 160px));min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;border-left:1px solid ${theme.border};background:${theme.surface};color:${theme.text};font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;`;
    const content = document.createElement('div');
    content.style.cssText = 'flex:1 1 0;min-width:0;min-height:0;overflow:auto;padding:12px;box-sizing:border-box;';
    this.el.replaceChildren(content, this.resize.handle);
    this.resize.updateValues();
    const style = document.createElement('style');
    style.textContent = `
      .finterion-comparison button { cursor:pointer;font:inherit;color:inherit;background:transparent;border:1px solid ${theme.border};border-radius:4px;padding:3px 7px; }
      .finterion-comparison button:focus-visible { outline:2px solid ${theme.accent};outline-offset:2px; }
      .finterion-comparison table { border-collapse:collapse;white-space:nowrap;font:inherit;font-variant-numeric:tabular-nums; }
      .finterion-comparison th,.finterion-comparison td { padding:8px;text-align:right;border-bottom:1px solid ${theme.border}; }
      .finterion-comparison th:first-child { text-align:left;position:sticky;left:0;background:${theme.surface};z-index:1; }
      .finterion-comparison .comparison-resize-handle {
        position:absolute;left:0;top:0;bottom:0;width:7px;z-index:2;
        cursor:col-resize;touch-action:none;user-select:none;
      }
      .finterion-comparison .comparison-resize-handle:hover,
      .finterion-comparison .comparison-resize-handle:focus-visible { background:${theme.accent}; }
      .finterion-comparison .comparison-resize-handle:focus-visible { outline:2px solid ${theme.accent};outline-offset:-2px; }
    `;
    this.el.appendChild(style);
    const text = (tag: string, value: string, parent: HTMLElement = content) => {
      const el = document.createElement(tag);
      el.textContent = value;
      parent.appendChild(el);
      return el;
    };
    const button = (label: string, action: () => void, parent: HTMLElement) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = label;
      el.addEventListener('click', action);
      parent.appendChild(el);
      return el;
    };
    const header = text('div', '');
    header.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:8px;';
    text('strong', 'Compare points', header).style.marginRight = 'auto';
    button('Clear all', options.clear, header).disabled = times.length === 0;
    button('Close', options.close, header);
    text('p', 'Click a time-based panel to add a point; click it again to remove. The first selected point is the baseline.').style.color = theme.textDim;
    if (!times.length) {
      text('p', 'No points selected.');
      return;
    }
    const indices = comparisonIndices(buf, times);
    const scroll = text('div', '');
    scroll.style.cssText = 'overflow:auto;flex:0 0 auto;max-width:100%;';
    const table = document.createElement('table');
    table.setAttribute('aria-label', 'Values and changes from the first selected point');
    scroll.appendChild(table);
    const thead = document.createElement('thead');
    table.appendChild(thead);
    const headings = text('tr', '', thead);
    text('th', 'Panel / series', headings).setAttribute('scope', 'col');
    times.forEach((time, i) => {
      const th = text('th', '', headings);
      th.setAttribute('scope', 'col');
      text('div', `P${i + 1}${i === 0 ? ' (baseline)' : ''}`, th);
      const ms = time < 1e12 ? time * 1000 : time;
      const date = new Date(ms);
      text('div', options.formatTime?.(time) ?? (Number.isFinite(date.getTime()) ? date.toISOString() : String(time)), th);
      button('Remove', () => options.remove(time), th).setAttribute('aria-label', `Remove point ${i + 1}`);
    });
    const body = text('tbody', '', table);
    for (const panel of panels) {
      const title = text('tr', '', body);
      const cell = text('th', panel.title ?? panel.id, title);
      cell.setAttribute('colspan', String(times.length + 1));
      cell.setAttribute('scope', 'rowgroup');
      cell.style.textAlign = 'left';
      if (panel.kind !== 'price' && panel.kind !== 'indicator') {
        const row = text('tr', '', body);
        text('td', 'Not time-indexed; no values at selected timestamps.', row).setAttribute('colspan', String(times.length + 1));
        continue;
      }
      for (const row of comparisonRows(panel, buf, indices)) {
        const tr = text('tr', '', body);
        text('th', row.label, tr).setAttribute('scope', 'row');
        row.values.forEach((value, i) => {
          const td = text('td', '', tr);
          text('div', formatValue(value), td);
          if (i === 0) return;
          const change = comparisonChange(value, row.values[0] ?? null);
          const delta = text('div', change
            ? `${signed(change.absolute)} / ${change.percent === null ? 'N/A' : `${signed(change.percent)}%`}`
            : 'N/A / N/A', td);
          delta.style.cssText = `font-size:10px;color:${!change || change.absolute === 0 ? theme.textDim : change.absolute > 0 ? theme.up : theme.down};`;
        });
      }
    }
    text('p', 'Changes: absolute / %. Percentage uses the absolute baseline; a zero baseline or missing value is N/A. Hidden series are included.').style.color = theme.textDim;
  }
}
