import { validateSpec, type ChartSpec } from './index';

export interface ChartCanvasSpec {
  version: 1;
  kind: 'canvas';
  title: string;
  charts: Record<string, ChartSpec>;
  layout?: 'single' | 'grid';
  columns?: number;
  chartHeight?: number;
  selector?: {
    type: 'dropdown' | 'tabs' | 'multiselect' | 'checkboxes';
    label?: string;
  };
  selected?: string[];
  layoutToggle?: boolean;
}

export function validateCanvasSpec(value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  if (!object(value)) return { ok: false, errors: ['Canvas must be an object'] };
  const allowed = ['version', 'kind', 'title', 'charts', 'layout', 'columns', 'chartHeight', 'selector', 'selected', 'layoutToggle'];
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`Unknown canvas field: ${key}`);
  if (value.version !== 1 || value.kind !== 'canvas') errors.push('Canvas requires version 1 and kind "canvas"');
  if (typeof value.title !== 'string' || !value.title.trim()) errors.push('Canvas title must not be empty');
  if (value.layout !== undefined && !['single', 'grid'].includes(String(value.layout))) errors.push('Invalid canvas layout');
  for (const key of ['columns', 'chartHeight']) {
    const v = value[key];
    if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v) || v < 1))
      errors.push(`${key} must be a positive integer`);
  }
  if (value.layoutToggle !== undefined && typeof value.layoutToggle !== 'boolean') errors.push('layoutToggle must be boolean');
  if (value.selector !== undefined) {
    const selector = value.selector;
    if (!object(selector) || !['dropdown', 'tabs', 'multiselect', 'checkboxes'].includes(String(selector.type)))
      errors.push('Invalid canvas selector');
    if (object(selector)) {
      if (selector.label !== undefined && typeof selector.label !== 'string') errors.push('Selector label must be a string');
      if (Object.keys(selector).some(key => !['type', 'label'].includes(key))) errors.push('Unknown selector field');
    }
  }
  if (!object(value.charts) || !Object.keys(value.charts).length) errors.push('Canvas requires at least one chart');
  else {
    for (const [id, chart] of Object.entries(value.charts)) {
      if (!id.trim()) errors.push('Chart IDs must not be empty');
      if (!object(chart) || !Array.isArray(chart.panels)) errors.push(`Invalid chart: ${id}`);
      else {
        const result = validateSpec(chart as unknown as ChartSpec);
        errors.push(...result.errors.map(error => `charts.${id}: ${error}`));
      }
    }
  }
  if (value.selected !== undefined) {
    if (!Array.isArray(value.selected) || value.selected.some(id =>
      typeof id !== 'string' || !object(value.charts) || !Object.prototype.hasOwnProperty.call(value.charts, id)))
      errors.push('selected must contain existing chart IDs');
    else if (new Set(value.selected).size !== value.selected.length) errors.push('selected must not contain duplicates');
  }
  return { ok: !errors.length, errors };
}
