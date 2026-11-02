import type { DecisionAnnotation, OHLCBuffer, PanelSpec, Viewport } from '../types';
import { xCenter, yPos, type PanelLayout } from '../renderers/layout';

/** Accept contemporary Unix seconds and milliseconds without changing bar data. */
export const epochMs = (time: number) => time < 1e12 ? time * 1000 : time;
export const decisionColor = (
  action: DecisionAnnotation['action'], direction?: DecisionAnnotation['direction'], status?: string,
  signalType?: DecisionAnnotation['signalType'],
) => status === 'not_triggered' ? '#94a3b8'
  : action !== 'none' && signalType === 'stop_loss' ? '#f59e0b'
  : action !== 'none' && signalType === 'take_profit' ? '#38bdf8'
  : action === 'entry' && status === 'rejected' ? '#f59e0b' : action === 'entry'
  ? direction === 'short' ? '#a3e635' : '#22c55e'
  : action === 'exit'
    ? direction === 'short' ? '#fb923c' : '#ef4444'
    : '#ffffff';

export const decisionTypeKey = (d: Pick<DecisionAnnotation, 'action' | 'direction' | 'signalType' | 'eventType'>) =>
  d.action === 'none' ? 'none'
    : `${d.signalType ?? d.action}:${d.direction ?? 'long'}${d.eventType ? `:${d.eventType}` : ''}`;

export const decisionTypeLabel = (d: DecisionAnnotation) => {
  const direction = d.direction === 'short' ? 'Short' : 'Long';
  const name = d.signalType === 'scale_in' ? 'scale-ins (+)'
    : d.signalType === 'scale_out' ? 'scale-outs (-)'
    : d.signalType === 'stop_loss' ? 'stop-loss'
    : 'take-profit';
  return `${direction} ${name}${d.eventType ? ` ${d.eventType}s` : ''}`;
};

// Keep simultaneous trigger/fill badges individually visible and selectable.
export const decisionX = (bar: number, viewport: Viewport, width: number, d: DecisionAnnotation) =>
  xCenter(bar, viewport, width) + (d.eventType === 'trigger' ? -12 : d.eventType === 'fill' ? 12 : 0);
const timestamp = (time: number) => {
  const date = new Date(epochMs(time));
  return Number.isNaN(date.getTime()) ? String(time) : new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).format(date) + ' UTC';
};

export function validateDecisions(value: unknown, panels: Pick<PanelSpec, 'id' | 'kind'>[]): string[] {
  const errors: string[] = [];
  const fail = (path: string) => errors.push(`${path} is invalid`);
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const fields = (v: Record<string, unknown>, required: string[], strings: string[], numbers: string[], path: string, extra: string[] = []) => {
    for (const k of required) if (!(k in v)) fail(`${path}.${k}`);
    for (const k of strings) if (k in v && typeof v[k] !== 'string') fail(`${path}.${k}`);
    for (const k of numbers) if (k in v && !number(v[k])) fail(`${path}.${k}`);
    for (const k of Object.keys(v)) if (![...required, ...strings, ...numbers, ...extra].includes(k)) fail(`${path}.${k}`);
  };
  if (!Array.isArray(value)) return ['data.decisions must be an array'];
  const ids = new Set<string>();
  value.forEach((d: unknown, i) => {
    const path = `data.decisions[${i}]`;
    if (!object(d)) return fail(path);
    fields(d, ['id', 'time', 'panelId', 'value', 'action', 'card'], ['id', 'panelId', 'label'], ['time', 'value'], path, ['direction', 'signalType', 'eventType']);
    if (d.label === '') fail(`${path}.label`);
    if (!d.id || ids.has(d.id as string)) fail(`${path}.id`);
    ids.add(d.id as string);
    if (!panels.some(p => p.id === d.panelId && (p.kind === 'price' || p.kind === 'indicator'))) fail(`${path}.panelId`);
    if (!['entry', 'exit', 'none'].includes(d.action as string)) fail(`${path}.action`);
    if (d.direction !== undefined && !['long', 'short'].includes(d.direction as string)) fail(`${path}.direction`);
    if (d.signalType !== undefined && !['scale_in', 'scale_out', 'stop_loss', 'take_profit'].includes(d.signalType as string)) fail(`${path}.signalType`);
    if (d.eventType !== undefined && !['trigger', 'fill'].includes(d.eventType as string)) fail(`${path}.eventType`);
    if (!object(d.card)) return fail(`${path}.card`);
    fields(d.card, ['title', 'status', 'groups'], ['title', 'status', 'summary', 'position', 'qualification', 'reasonDescription'], ['score', 'minimumScore', 'maximumScore', 'strength'], `${path}.card`, ['reason']);
    if ('reason' in d.card && d.card.reason !== null && typeof d.card.reason !== 'string') fail(`${path}.card.reason`);
    if (typeof d.card.strength === 'number' && (d.card.strength < 0 || d.card.strength > 1)) fail(`${path}.card.strength`);
    if (typeof d.card.maximumScore === 'number' && d.card.maximumScore < 0) fail(`${path}.card.maximumScore`);
    if (!Array.isArray(d.card.groups)) return fail(`${path}.card.groups`);
    d.card.groups.forEach((g: unknown, j) => {
      const gp = `${path}.card.groups[${j}]`;
      if (!object(g)) return fail(gp);
      fields(g, ['id', 'title', 'rules'], ['id', 'title'], ['score', 'maximumScore', 'minimumScore', 'minimumMatches'], gp, ['matched', 'aggregation']);
      if (typeof g.minimumMatches === 'number' && (!Number.isInteger(g.minimumMatches) || g.minimumMatches < 0)) fail(`${gp}.minimumMatches`);
      if ('aggregation' in g && !['sum', 'max'].includes(g.aggregation as string)) fail(`${gp}.aggregation`);
      if (typeof g.maximumScore === 'number' && g.maximumScore < 0) fail(`${gp}.maximumScore`);
      if ('matched' in g && g.matched !== null && typeof g.matched !== 'boolean') fail(`${gp}.matched`);
      if (!Array.isArray(g.rules)) return fail(`${gp}.rules`);
      g.rules.forEach((r: unknown, k) => {
        const rp = `${gp}.rules[${k}]`;
        if (!object(r)) return fail(rp);
        fields(r, ['id', 'label'], ['id', 'label', 'description', 'timeframe'], ['points', 'maximumPoints', 'weight'], rp, ['matched', 'value', 'required']);
        if ('required' in r && typeof r.required !== 'boolean') fail(`${rp}.required`);
        if (typeof r.maximumPoints === 'number' && r.maximumPoints < 0) fail(`${rp}.maximumPoints`);
        if ('matched' in r && r.matched !== null && typeof r.matched !== 'boolean') fail(`${rp}.matched`);
        if ('value' in r && r.value !== null && !['string', 'boolean'].includes(typeof r.value) && !number(r.value)) fail(`${rp}.value`);
      });
    });
  });
  return errors;
}

export interface DecisionHit {
  bar: number;
  decision: DecisionAnnotation;
}

/** Precomputed nearest-bar buckets and nearby-dot hit testing. */
export class DecisionIndex {
  byBar = new Map<number, DecisionAnnotation[]>();
  bars: number[] = [];
  constructor(decisions: DecisionAnnotation[], buf: OHLCBuffer | null) {
    if (!buf?.length) return;
    for (const d of decisions) {
      const time = epochMs(d.time);
      let lo = 0, hi = buf.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (epochMs(buf.time[mid]!) < time) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0 && Math.abs(epochMs(buf.time[lo - 1]!) - time) <= Math.abs(epochMs(buf.time[lo]!) - time)) lo--;
      const bucket = this.byBar.get(lo) ?? [];
      bucket.push(d);
      this.byBar.set(lo, bucket);
    }
    this.bars = [...this.byBar.keys()].sort((a, b) => a - b);
  }
  nearest(bar: number): DecisionAnnotation[] {
    return this.byBar.get(bar) ?? [];
  }
  hitTest(layout: Pick<PanelLayout, 'width' | 'height' | 'viewport' | 'yMin' | 'yMax'>, panelId: string, x: number, y: number): DecisionHit | null {
    const { width, height, viewport, yMin, yMax } = layout;
    if (width <= 0 || height <= 0 || x < 0 || x > width || y < 0 || y > height) return null;
    const radius = 12;
    const band = width / (viewport.endIdx - viewport.startIdx + 1);
    const first = Math.max(0, Math.ceil(viewport.startIdx), Math.ceil(viewport.startIdx + (x - radius - 12) / band - 0.5));
    const last = Math.min(Math.floor(viewport.endIdx), Math.floor(viewport.startIdx + (x + radius + 12) / band - 0.5));
    let hit: DecisionHit | null = null;
    let distance = radius * radius;
    for (let bar = first; bar <= last; bar++) {
      for (const decision of this.nearest(bar)) {
        if (decision.panelId !== panelId) continue;
        const py = yPos(decision.value, yMin, yMax, height);
        if (py < 0 || py > height) continue;
        const squared = (x - decisionX(bar, viewport, width, decision)) ** 2 + (y - py) ** 2;
        if (squared < distance || (squared === distance && (
          !hit || (hit.decision.action === 'none' && (
            decision.action !== 'none' || (
              decision.card.status === 'not_triggered'
              && hit.decision.card.status !== 'not_triggered'
            )
          ))
        ))) {
          hit = { bar, decision };
          distance = squared;
        }
      }
    }
    return hit;
  }
}

export function renderDecisions(layout: PanelLayout, index: DecisionIndex, panelId: string) {
  const { ctx, viewport, width, height, yMin, yMax } = layout;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  for (const bar of index.bars) {
    if (bar < viewport.startIdx || bar > viewport.endIdx) continue;
    const bucket = index.byBar.get(bar)!.filter(d => d.panelId === panelId);
    const neutralValues = new Set<number>();
    // Draw neutral evaluations first so an entry/exit remains clearly visible.
    bucket.sort((a, b) => Number(b.action === 'none') - Number(a.action === 'none')
      || Number(b.card.status === 'not_triggered') - Number(a.card.status === 'not_triggered'));
    for (const d of bucket) {
      const neutral = d.action === 'none';
      if (neutral && neutralValues.has(d.value)) continue;
      if (neutral) neutralValues.add(d.value);
      const x = decisionX(bar, viewport, width, d);
      const y = yPos(d.value, yMin, yMax, height);
      const color = decisionColor(d.action, d.direction, d.card.status, d.signalType);
      if (!neutral && (d.signalType === 'scale_in' || d.signalType === 'scale_out')) {
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        if (d.signalType === 'scale_in') {
          ctx.moveTo(x, y - 5);
          ctx.lineTo(x, y + 5);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        continue;
      }
      if (!neutral && (d.signalType === 'stop_loss' || d.signalType === 'take_profit')) {
        ctx.beginPath();
        ctx.rect(x - 11, y - 7, 22, 14);
        ctx.fillStyle = d.eventType === 'fill' ? color : '#0f172a';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = d.eventType === 'fill' ? '#0f172a' : color;
        ctx.fillText(d.signalType === 'stop_loss' ? 'SL' : 'TP', x, y);
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, neutral ? 3 : 4, 0, Math.PI * 2);
      ctx.fillStyle = neutral && d.card.status !== 'not_triggered'
        ? 'rgba(255,255,255,0.22)' : color;
      ctx.fill();
      if (!neutral) {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export class DecisionInspector {
  readonly container = document.createElement('div');
  readonly el = document.createElement('aside');
  private resizeHandle = document.createElement('div');
  private layoutToggle = document.createElement('button');
  private collapsed = false;
  private drag: { pointerId: number; x: number; width: number } | undefined;
  private byTime = new Map<number, DecisionAnnotation[]>();
  private bucket: DecisionAnnotation[] = [];
  private selected: DecisionAnnotation | undefined;
  private preferredLabel: string | undefined;
  private pinned = false;
  private liveBucket: DecisionAnnotation[] = [];
  private controls = document.createElement('div');
  private content = document.createElement('div');
  private scoreSummary = document.createElement('section');
  private choices = document.createElement('div');
  private choicesTitle = document.createElement('div');
  private heading = document.createElement('header');
  constructor(private readonly onResize?: () => void) {
    this.container.className = 'finterion-decision-inspector-shell';
    this.container.style.cssText = 'display:none;position:relative;flex:0 0 auto;flex-direction:column;width:clamp(280px,38%,420px);max-width:65%;height:100%;min-height:0;box-sizing:border-box;border-left:1px solid #475569;';
    this.el.className = 'finterion-decision-inspector';
    this.el.setAttribute('aria-label', 'Decision inspector');
    this.el.style.cssText = 'flex:1 1 0;width:100%;min-height:0;box-sizing:border-box;overflow-y:auto;overscroll-behavior-y:contain;padding:16px;font:12px/1.5 ui-monospace,monospace;overflow-wrap:anywhere;';
    const layoutControls = document.createElement('div');
    layoutControls.className = 'inspector-layout-controls';
    const layoutLabel = document.createElement('span');
    layoutLabel.className = 'inspector-layout-label';
    layoutLabel.textContent = 'Decision inspector';
    this.layoutToggle.type = 'button';
    this.layoutToggle.textContent = '>';
    this.layoutToggle.setAttribute('aria-label', 'Collapse decision inspector');
    this.layoutToggle.setAttribute('aria-expanded', 'true');
    this.layoutToggle.title = 'Collapse decision inspector';
    this.layoutToggle.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.container.setAttribute('data-collapsed', String(this.collapsed));
      this.el.style.display = this.collapsed ? 'none' : 'block';
      const label = `${this.collapsed ? 'Expand' : 'Collapse'} decision inspector`;
      this.layoutToggle.setAttribute('aria-label', label);
      this.layoutToggle.setAttribute('aria-expanded', String(!this.collapsed));
      this.layoutToggle.title = label;
      this.layoutToggle.textContent = this.collapsed ? '<' : '>';
      this.onResize?.();
    });
    layoutControls.append(layoutLabel, this.layoutToggle);
    this.resizeHandle.className = 'inspector-resize-handle';
    this.resizeHandle.tabIndex = 0;
    this.resizeHandle.setAttribute('role', 'separator');
    this.resizeHandle.setAttribute('aria-label', 'Resize decision inspector');
    this.resizeHandle.setAttribute('aria-orientation', 'vertical');
    this.resizeHandle.title = 'Drag to resize; Left/Right to adjust; double-click to reset';
    this.resizeHandle.addEventListener('focus', () => this.updateResizeValues());
    this.resizeHandle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || this.drag) return;
      e.preventDefault();
      this.drag = {
        pointerId: e.pointerId, x: e.clientX,
        width: this.container.getBoundingClientRect().width,
      };
      this.resizeHandle.setPointerCapture(e.pointerId);
    });
    this.resizeHandle.addEventListener('pointermove', e => {
      if (this.drag?.pointerId !== e.pointerId) return;
      e.preventDefault();
      this.setWidth(this.drag.width + this.drag.x - e.clientX);
    });
    const endDrag = (e: PointerEvent) => {
      if (this.drag?.pointerId !== e.pointerId) return;
      this.drag = undefined;
      if (this.resizeHandle.hasPointerCapture(e.pointerId)) {
        this.resizeHandle.releasePointerCapture(e.pointerId);
      }
    };
    this.resizeHandle.addEventListener('pointerup', endDrag);
    this.resizeHandle.addEventListener('pointercancel', endDrag);
    this.resizeHandle.addEventListener('lostpointercapture', () => { this.drag = undefined; });
    this.resizeHandle.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const { minimum, maximum } = this.widthBounds();
      const step = e.shiftKey ? 50 : 20;
      this.setWidth(e.key === 'Home' ? minimum : e.key === 'End' ? maximum
        : this.container.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? step : -step));
    });
    this.resizeHandle.addEventListener('dblclick', () => {
      this.container.style.width = 'clamp(280px,38%,420px)';
      this.updateResizeValues();
      this.onResize?.();
    });
    this.container.append(layoutControls, this.el, this.resizeHandle);
    this.scoreSummary.setAttribute('aria-label', 'Confluence score');
    this.scoreSummary.className = 'inspector-body';
    this.el.append(this.controls, this.scoreSummary, this.content);
    const style = document.createElement('style');
    style.textContent = `
      .finterion-decision-inspector-shell .inspector-layout-controls {
        display:flex;align-items:center;justify-content:space-between;gap:8px;
        flex:0 0 36px;padding:0 8px;box-sizing:border-box;font:11px system-ui,sans-serif;color:#94a3b8;
      }
      .finterion-decision-inspector-shell .inspector-layout-controls button {
        cursor:pointer;color:#e2e8f0;background:#1e293b;border:1px solid #475569;
        border-radius:4px;width:26px;height:26px;font:14px system-ui,sans-serif;
      }
      .finterion-decision-inspector-shell .inspector-layout-controls button:focus-visible,
      .finterion-decision-inspector-shell .inspector-resize-handle:focus-visible {
        outline:2px solid #60a5fa;outline-offset:-2px;
      }
      .finterion-decision-inspector-shell .inspector-resize-handle {
        position:absolute;left:0;top:0;bottom:0;width:7px;z-index:2;
        cursor:col-resize;touch-action:none;user-select:none;
      }
      .finterion-decision-inspector-shell .inspector-resize-handle:hover,
      .finterion-decision-inspector-shell .inspector-resize-handle:focus-visible { background:#60a5fa55; }
      .finterion-decision-inspector-shell[data-collapsed="true"] { width:40px !important; }
      .finterion-decision-inspector-shell[data-collapsed="true"] .inspector-layout-label,
      .finterion-decision-inspector-shell[data-collapsed="true"] .inspector-resize-handle { display:none; }
      .finterion-decision-inspector button {
        color:#e2e8f0;background:#1e293b;border:1px solid #475569;
        border-radius:6px;padding:6px 9px;font:inherit;line-height:1.4;color-scheme:dark;
      }
      .finterion-decision-inspector button { cursor:pointer; }
      .finterion-decision-inspector button:hover { background:#334155; }
      .finterion-decision-inspector button[aria-pressed="true"] {
        background:#1e3a5f;border-color:#60a5fa;
      }
      .finterion-decision-inspector button:focus-visible {
        outline:2px solid #60a5fa;outline-offset:2px;
      }
      .finterion-decision-inspector .evidence-section {
        margin:12px 0;padding:12px;background:#161e24;border:1px solid #303943;border-radius:6px;
        container-type:inline-size;
      }
      .finterion-decision-inspector .evidence-header {
        display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;
      }
      .finterion-decision-inspector .evidence-header :is(h3,h4) {
        margin:0;font:600 12px/1.5 system-ui,sans-serif;color:#e2e8f0;
      }
      .finterion-decision-inspector .evidence-badge {
        font-size:9px;letter-spacing:.6px;color:#94a3b8;border:1px solid #303943;border-radius:3px;padding:1px 5px;
      }
      .finterion-decision-inspector .evidence-grid {
        display:grid;grid-template-columns:minmax(0,1fr);column-gap:22px;
      }
      @container (min-width: 540px) {
        .finterion-decision-inspector .evidence-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      .finterion-decision-inspector .evidence-row {
        display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #303943;min-width:0;
      }
      .finterion-decision-inspector .evidence-status {
        flex:0 0 18px;width:18px;height:18px;border:1px solid currentColor;border-radius:50%;
        display:flex;align-items:center;justify-content:center;font-size:11px;
      }
      .finterion-decision-inspector .evidence-label { font:600 12px/1.5 system-ui,sans-serif;color:#e2e8f0; }
      .finterion-decision-inspector .evidence-reference { font-size:10px;color:#94a3b8;margin-top:3px; }
      .finterion-decision-inspector .evidence-points { margin-left:auto;flex-shrink:0;text-align:right; }
      .finterion-decision-inspector .evidence-footer {
        display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:10px;color:#94a3b8;padding-top:10px;
      }
      .finterion-decision-inspector details { margin-top:10px;color:#94a3b8; }
      .finterion-decision-inspector summary { cursor:pointer; }
      .finterion-decision-inspector summary:focus-visible { outline:2px solid #60a5fa;outline-offset:2px; }
      .finterion-decision-inspector .eyebrow,
      .finterion-decision-inspector .summary-label { color:#94a3b8;font:600 10px/1.5 system-ui,sans-serif;letter-spacing:1px;text-transform:uppercase; }
      .finterion-decision-inspector .inspector-date { color:#cbd5e1;font-size:11px;margin:6px 0; }
      .finterion-decision-inspector .signal-outcome,
      .finterion-decision-inspector .score-block { padding:14px 12px;margin:12px 0;background:#161e24;border:1px solid #303943;border-radius:6px; }
      .finterion-decision-inspector .signal-status-row,
      .finterion-decision-inspector .score-heading,
      .finterion-decision-inspector .maximum-score,
      .finterion-decision-inspector .score-foot,
      .finterion-decision-inspector .position-context { display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap; }
      .finterion-decision-inspector .status-emblem { border:1px solid currentColor;border-radius:20px;padding:3px 9px;color:#cbd5e1;font-size:11px; }
      .finterion-decision-inspector .status-emblem[data-status="approved"] { color:#34cba3; }
      .finterion-decision-inspector .status-emblem[data-status="rejected"] { color:#f87171; }
      .finterion-decision-inspector .status-emblem[data-status="not_emitted"] { color:#fbbf24; }
      .finterion-decision-inspector .status-emblem[data-status="not_triggered"] { color:#94a3b8; }
      .finterion-decision-inspector .signal-reason { display:block;margin-top:8px;color:#cbd5e1;white-space:normal;overflow-wrap:anywhere;font-size:10px; }
      .finterion-decision-inspector .signal-reason-description { margin:10px 0 0;color:#e2e8f0;font:13px/1.5 system-ui,sans-serif; }
      .finterion-decision-inspector .score-number { color:#e2e8f0;font:600 48px/1.2 system-ui,sans-serif;margin:12px 0; }
      .finterion-decision-inspector .score-unit { font:12px ui-monospace,monospace;color:#94a3b8;margin-left:8px; }
      .finterion-decision-inspector .maximum-score,
      .finterion-decision-inspector .score-foot,
      .finterion-decision-inspector .position-context { color:#94a3b8;font-size:10px;margin:10px 0; }
      .finterion-decision-inspector .score-bars { display:flex;gap:3px;height:8px;margin:12px 0;overflow:hidden;border-radius:3px; }
      .finterion-decision-inspector .score-segment { background:#303943;overflow:hidden; }
      .finterion-decision-inspector .segment-fill { display:block;height:100%; }
      .finterion-decision-inspector .indicator-table { width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px; }
      .finterion-decision-inspector .indicator-table th { color:#94a3b8;font:500 9px system-ui,sans-serif;text-align:left;padding:9px 3px;border-bottom:1px solid #303943; }
      .finterion-decision-inspector .indicator-table td { vertical-align:top;padding:12px 3px;border-bottom:1px solid #303943;overflow-wrap:anywhere; }
      .finterion-decision-inspector .indicator-table .numeric { text-align:right;width:54px;font-variant-numeric:tabular-nums; }
      .finterion-decision-inspector .indicator-table .evidence-row { display:table-row; }
      .finterion-decision-inspector .indicator-table .evidence-reference { font-size:10px;line-height:1.6; }
      .finterion-decision-inspector .required-badge { display:inline-block;color:#bfdbfe;border:1px solid #475569;border-radius:3px;font-size:9px;padding:0 4px;margin:3px; }
      .finterion-decision-inspector .group-threshold,
      .finterion-decision-inspector .weight-explainer,
      .finterion-decision-inspector .execution-note,
      .finterion-decision-inspector .inspector-footer { color:#94a3b8;font-size:10px;line-height:1.7; }
      .finterion-decision-inspector .inspector-footer { border-top:1px solid #303943;padding-top:12px;margin-top:16px; }
      @media (max-width:640px) {
        .finterion-chart-frame { flex-direction:column !important; }
        .finterion-decision-inspector-shell {
          flex:0 0 48% !important;width:100% !important;max-width:none !important;height:48% !important;
          border-left:0 !important;border-top:1px solid #475569;
        }
        .finterion-decision-inspector-shell .inspector-resize-handle { display:none; }
        .finterion-decision-inspector-shell[data-collapsed="true"] {
          flex-basis:36px !important;height:36px !important;width:100% !important;
        }
        .finterion-decision-inspector-shell[data-collapsed="true"] .inspector-layout-label { display:block; }
      }
    `;
    this.el.appendChild(style);
    this.choices.setAttribute('role', 'group');
    this.choices.setAttribute('aria-label', 'Cards at selected timestamp');
    this.choices.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px;';
    this.heading.className = 'inspector-heading';
    this.controls.append(this.heading, this.choicesTitle, this.choices);
  }
  private widthBounds() {
    const available = this.container.parentElement?.getBoundingClientRect().width;
    const maximum = available ? Math.min(800, Math.floor(available * .65)) : 800;
    return { minimum: Math.min(220, maximum), maximum };
  }
  private updateResizeValues() {
    const { minimum, maximum } = this.widthBounds();
    this.resizeHandle.setAttribute('aria-valuemin', String(minimum));
    this.resizeHandle.setAttribute('aria-valuemax', String(maximum));
    this.resizeHandle.setAttribute('aria-valuenow', String(Math.round(
      Math.max(minimum, Math.min(maximum, this.container.getBoundingClientRect().width)),
    )));
  }
  private setWidth(width: number) {
    const { minimum, maximum } = this.widthBounds();
    this.container.style.width = `${Math.max(minimum, Math.min(maximum, width))}px`;
    this.updateResizeValues();
    this.onResize?.();
  }
  setDecisions(decisions: DecisionAnnotation[]) {
    this.byTime.clear();
    for (const d of decisions) {
      const key = epochMs(d.time);
      const bucket = this.byTime.get(key) ?? [];
      bucket.push(d);
      this.byTime.set(key, bucket);
    }
    this.pinned = false;
    this.bucket = [];
    this.selected = undefined;
    this.preferredLabel = undefined;
    this.liveBucket = [];
    this.container.style.display = decisions.length ? 'flex' : 'none';
    this.el.style.display = this.collapsed ? 'none' : 'block';
    this.updateResizeValues();
    const first = decisions[0];
    this.show(first ? this.byTime.get(epochMs(first.time))! : []);
  }
  show(bucket: DecisionAnnotation[]) {
    this.liveBucket = bucket;
    if (this.pinned || (bucket.length === this.bucket.length && bucket.every((d, i) => d === this.bucket[i]))) return;
    this.bucket = bucket;
    this.selected = this.preferredCard(bucket);
    this.render();
  }
  togglePin(bucket?: DecisionAnnotation[]) {
    if (bucket?.length && (!this.selected || !bucket.includes(this.selected))) {
      this.liveBucket = bucket;
      this.bucket = bucket;
      this.selected = this.preferredCard(bucket);
      this.pinned = true;
      this.render();
      return;
    }
    if (!this.selected) return;
    this.pinned = !this.pinned;
    if (!this.pinned) {
      this.bucket = this.liveBucket;
      this.selected = this.preferredCard(this.bucket);
    }
    this.render();
  }
  select(bucket: DecisionAnnotation[], decision: DecisionAnnotation) {
    this.liveBucket = bucket;
    this.bucket = bucket;
    this.selected = decision;
    this.preferredLabel = decision.label ?? decision.card.title;
    this.pinned = true;
    this.render();
  }
  clearSelection() {
    this.pinned = false;
    this.bucket = this.liveBucket;
    this.selected = this.preferredCard(this.bucket);
    this.render();
  }
  private preferredCard(bucket: DecisionAnnotation[]) {
    return bucket.find(d => (d.label ?? d.card.title) === this.preferredLabel) ?? bucket[0];
  }
  private button(label: string, action: () => void, parent: HTMLElement) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'margin:0 5px 8px 0;cursor:pointer;';
    b.addEventListener('click', action);
    parent.appendChild(b);
    return b;
  }
  private render() {
    this.el.setAttribute('data-pinned', String(this.pinned));
    this.choices.replaceChildren();
    const visibleBucket = this.selected
      ? this.byTime.get(epochMs(this.selected.time))!
      : this.bucket;
    this.choicesTitle.textContent = `${visibleBucket.length} cards at this timestamp`;
    for (const d of visibleBucket) {
      const b = this.button(d.label ?? `${d.action}: ${d.card.title} (${d.card.status})`, () => {
        this.selected = d;
        this.preferredLabel = d.label ?? d.card.title;
        this.pinned = true;
        this.render();
      }, this.choices);
      b.setAttribute('aria-pressed', String(d === this.selected));
      b.title = `${d.card.title} · ${d.card.status}${d.card.reasonDescription ? `\n${d.card.reasonDescription}` : ''}`;
      b.style.cssText = `margin:0;min-width:0;text-align:left;white-space:normal;border-left:3px solid ${decisionColor(d.action, d.direction, d.card.status, d.signalType)};`;
    }
    this.content.replaceChildren();
    const d = this.selected;
    const protective = d?.signalType === 'stop_loss' || d?.signalType === 'take_profit';
    this.scoreSummary.setAttribute('aria-label', protective ? 'Protective execution' : 'Confluence score');
    this.scoreSummary.replaceChildren();
    this.heading.replaceChildren();
    this.scoreSummary.style.display = d ? 'block' : 'none';
    if (!d) {
      this.content.textContent = 'No decision evaluated at this bar. Hover a decision dot to inspect its cards.';
      return;
    }
    const text = (tag: string, value: string, parent: HTMLElement = this.content) => {
      const el = document.createElement(tag);
      el.textContent = value;
      parent.appendChild(el);
      return el;
    };
    text('div', 'DECISION INSPECTOR', this.heading).className = 'eyebrow';
    text('p', timestamp(d.time), this.heading).className = 'inspector-date';
    const outcome = text('div', '', this.scoreSummary);
    outcome.className = 'signal-outcome';
    outcome.setAttribute('role', 'status');
    outcome.setAttribute('aria-live', 'polite');
    const outcomeRow = text('div', '', outcome);
    outcomeRow.className = 'signal-status-row';
    text('span', protective || d.eventType ? 'Execution status' : 'Signal status', outcomeRow).className = 'summary-label';
    const emblem = text('span', d.card.status === 'not_triggered' ? 'Not triggered' : d.card.status, outcomeRow);
    emblem.className = 'status-emblem';
    emblem.setAttribute('data-status', d.card.status);
    emblem.setAttribute('aria-label', `${protective ? 'execution_status' : 'signal_status'}: ${d.card.status}`);
    if (protective || d.eventType || d.action === 'entry' && d.card.status === 'rejected')
      emblem.style.color = decisionColor(d.action, d.direction, d.card.status, d.signalType);
    if (d.card.reasonDescription)
      text('p', d.card.reasonDescription, outcome).className = 'signal-reason-description';
    if (protective) {
      text('h2', d.card.title);
      if (d.card.summary) text('p', d.card.summary);
      for (const group of d.card.groups) {
        const section = text('section', '');
        section.className = 'evidence-section';
        text('h3', group.title, section);
        const facts = text('dl', '', section);
        for (const rule of group.rules) {
          text('dt', rule.label, facts);
          const value = text('dd', rule.value === null ? 'Unavailable' : String(rule.value ?? 'Not recorded'), facts);
          if (rule.description) text('p', rule.description, value).className = 'evidence-reference';
        }
      }
      text('p', d.eventType === 'fill'
        ? 'Fill updates record executed amounts. A partial fill may leave the position open.'
        : 'A protective trigger is not a confirmed fill.').className = 'execution-note';
      text('footer', this.pinned ? 'Protective execution · pinned (click chart to resume)' : 'Protective execution · hover to inspect, click to pin').className = 'inspector-footer';
      return;
    }
    text('code', d.card.reason === null ? 'No blocking reason' : d.card.reason ?? 'Reason not recorded', outcome).className = 'signal-reason';
    const scoreBlock = text('section', '', this.scoreSummary);
    scoreBlock.className = 'score-block';
    scoreBlock.setAttribute('aria-label', 'Total confluence score');
    text('div', 'Total confluence · all groups', scoreBlock).className = 'summary-label';
    const headline = text('div', d.card.score === undefined
      ? d.card.status === 'not_triggered' ? 'Not evaluated' : 'Not recorded'
      : String(d.card.score), scoreBlock);
    headline.className = 'score-number';
    if (d.card.score !== undefined) text('span', 'points', headline).className = 'score-unit';
    const maximum = text('div', '', scoreBlock);
    maximum.className = 'maximum-score';
    text('span', 'Maximum score', maximum);
    text('strong', String(d.card.maximumScore ?? 'Not recorded'), maximum);
    const scoring = d.card.groups.filter(g => g.score !== undefined || g.maximumScore !== undefined);
    if (scoring.length && scoring.every(g => g.maximumScore !== undefined)) {
      const bars = text('div', '', scoreBlock);
      bars.className = 'score-bars';
      bars.setAttribute('aria-hidden', 'true');
      for (const group of scoring) {
        const segment = text('span', '', bars);
        segment.className = 'score-segment';
        segment.style.cssText = `flex:${group.maximumScore};`;
        const fill = text('span', '', segment);
        fill.className = 'segment-fill';
        const ratio = group.maximumScore! > 0 && group.score !== undefined ? group.score / group.maximumScore! : 0;
        fill.style.cssText = `width:${Math.max(0, Math.min(100, ratio * 100))}%;background:${group.id === 'secondary' ? '#a78bfa' : '#34cba3'};`;
      }
    }
    const foot = text('div', '', scoreBlock);
    foot.className = 'score-foot';
    text('span', d.card.minimumScore === undefined
      ? d.card.qualification ? 'Overall minimum: qualification gates' : 'Overall minimum: not recorded'
      : `Overall minimum: ${d.card.minimumScore}`, foot);
    text('span', d.card.strength === undefined ? 'Signal strength: not recorded' : `${Math.round(d.card.strength * 100)}% signal strength`, foot);
    if (d.card.score !== undefined && d.card.maximumScore !== undefined && d.card.maximumScore > 0)
      text('div', `${Math.round(d.card.score / d.card.maximumScore * 100)}% score utilization`, scoreBlock).className = 'evidence-reference';
    for (const group of d.card.groups.filter(g => g.score !== undefined || g.maximumScore !== undefined)) {
      const label = text('div', '', scoreBlock);
      label.style.cssText = 'display:flex;justify-content:space-between;gap:12px;margin-top:12px;';
      text('span', group.title, label);
      text('span', `${group.score ?? 'n/a'} / ${group.maximumScore ?? 'n/a'}`, label)
        .style.cssText = 'color:#94a3b8;white-space:nowrap;';
      const track = text('div', '', scoreBlock);
      track.style.cssText = 'height:8px;border-radius:2px;background:#303943;margin:5px 0 12px;overflow:hidden;';
      track.setAttribute('aria-label', `${group.title} points`);
      if (group.score !== undefined && group.maximumScore !== undefined && group.maximumScore > 0) {
        track.setAttribute('role', 'meter');
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(group.maximumScore));
        track.setAttribute('aria-valuenow', String(Math.max(0, Math.min(group.maximumScore, group.score))));
        track.setAttribute('aria-valuetext', `${group.score} / ${group.maximumScore}`);
        text('div', '', track).style.cssText = `height:100%;width:${Math.max(0, Math.min(100, group.score / group.maximumScore * 100))}%;background:${group.score < 0 ? '#ef4444' : '#34cba3'};`;
      }
    }
    text('h2', d.card.title).style.cssText = 'font:600 13px/1.5 system-ui,sans-serif;margin:16px 0 4px;color:#e2e8f0;';
    const position = text('div', '', this.content);
    position.className = 'position-context';
    text('span', 'Position before signal', position);
    text('strong', d.card.position ?? 'Not recorded', position);
    text('h3', 'Confluence groups');
    if (d.card.qualification) text('p', d.card.qualification).className = 'group-threshold';
    const status = (matched: boolean | null | undefined, trigger = false) => matched === true ? trigger ? '✓ Triggered' : '✓ Pass'
      : matched === false ? trigger ? '− Not triggered' : '✗ Fail' : matched === null ? '— Not evaluated' : 'Recorded';
    const groups = [...d.card.groups].sort((a, b) =>
      Number(b.score !== undefined || b.maximumScore !== undefined) - Number(a.score !== undefined || a.maximumScore !== undefined));
    groups.forEach((group, index) => {
      const weighted = !['outcome', 'decision', 'qualification', 'snapshots', 'requirement', 'veto'].includes(group.id)
        && (group.score !== undefined || group.maximumScore !== undefined || group.rules.some(r => r.points !== undefined));
      const parent = weighted ? this.content : text('details', '');
      if (!weighted) text('summary', group.title, parent);
      const section = text('section', '', parent);
      section.className = 'evidence-section confluence-group';
      section.setAttribute('aria-label', group.title);
      const header = text('div', '', section);
      header.className = 'evidence-header';
      text('span', String(index + 1).padStart(2, '0'), header).style.cssText = 'font-size:10px;color:#94a3b8;';
      text('h4', group.title, header);
      text('span', weighted ? 'WEIGHTED' : 'EVIDENCE', header).className = 'evidence-badge';
      const outcome = text('span', status(group.matched, weighted), header);
      outcome.style.cssText = `font-size:10px;margin-left:auto;color:${group.matched === true ? '#34cba3' : group.matched === false ? '#f87171' : '#94a3b8'};`;
      if (weighted) {
        const subtotal = text('div', '', section);
        subtotal.className = 'evidence-footer';
        text('span', `Earned ${group.score ?? 'Not recorded'}`, subtotal);
        text('span', group.maximumScore === undefined
          ? 'Maximum not recorded' : `Maximum ${group.maximumScore} points`, subtotal);
      }
      if (group.minimumMatches !== undefined || group.minimumScore !== undefined) {
        text('p', [
          group.minimumMatches !== undefined && group.minimumMatches > 0
            ? `${group.minimumMatches} ${group.minimumMatches === 1 ? 'trigger' : 'triggers'}` : '',
          group.minimumScore !== undefined ? `${group.minimumScore} points` : '',
        ].filter(Boolean).join(' and ') + (group.minimumMatches === 0 && group.minimumScore === undefined
          ? 'No trigger-count minimum' : ' minimum'), section).className = 'group-threshold';
      }
      if (group.aggregation) text('div', `Aggregation: ${group.aggregation}`, section).className = 'evidence-reference';
      const table = text('table', '', section);
      table.className = 'indicator-table';
      table.setAttribute('aria-label', `${group.title} indicator weights and earned contributions`);
      const head = text('tr', '', text('thead', '', table));
      for (const [index, title] of ['Indicator / condition', 'Weight', 'Earned'].entries()) {
        const cell = text('th', title, head);
        cell.setAttribute('scope', 'col');
        if (index) cell.className = 'numeric';
      }
      const grid = text('tbody', '', table);
      const metadata = weighted ? group.rules.filter(r =>
        /^(score|maximum_score|matches|minimum_score|minimum_matches|passed):/.test(r.id)) : [];
      for (const rule of group.rules.filter(r => !metadata.includes(r))) {
        const row = text('tr', '', grid);
        row.className = 'evidence-row';
        const body = text('td', '', row);
        text('div', rule.label, body).className = 'evidence-label indicator-name';
        if (rule.required) text('span', 'Required', body).className = 'required-badge';
        if (rule.description) text('div', rule.description, body).className = 'evidence-reference';
        if (rule.value !== undefined || rule.timeframe) {
          text('div', [
            rule.value !== undefined ? `Value ${rule.value === null ? 'unavailable' : String(rule.value)}` : '',
            rule.timeframe,
          ].filter(Boolean).join(' / '), body).className = 'evidence-reference';
        }
        const icon = text('div', status(rule.matched, weighted), body);
        icon.className = 'indicator-state';
        icon.setAttribute('aria-label', status(rule.matched, weighted));
        icon.style.color = rule.matched === true ? '#34cba3' : '#94a3b8';
        text('td', String(rule.weight ?? 'Not recorded'), row).className = 'numeric indicator-weight';
        const points = text('td', '', row);
        points.className = 'numeric indicator-earned';
        if (rule.points !== undefined) {
          text('div', `${rule.points >= 0 ? '+' : ''}${rule.points}`, points)
            .style.cssText = `font-weight:600;color:${rule.points > 0 ? '#34cba3' : rule.points < 0 ? '#f87171' : '#94a3b8'};`;
          if (rule.maximumPoints !== undefined)
            text('div', `/ ${rule.maximumPoints} PTS`, points).className = 'evidence-reference';
        } else text('span', 'Not recorded', points);
      }
      if (metadata.length) {
        const details = text('details', '', section);
        text('summary', 'Recorded group details', details);
        for (const rule of metadata) text('div', `${rule.label}: ${String(rule.value ?? 'Not recorded')}`, details);
      }
    });
    text('p', 'Weight = configured contribution. Earned = credited points after aggregation; matched rules can earn zero in max groups. Requirements and vetoes gate qualification without being counted twice.').className = 'weight-explainer';
    text('p', 'Signal ≠ execution. Approval is not a confirmed fill. Signal strength is not a win probability; score utilization is score divided by recorded maximum.').className = 'execution-note';
    if (d.card.summary || d.card.minimumScore !== undefined) {
      const details = text('details', '');
      text('summary', 'Evaluation details', details);
      if (d.card.summary) text('p', d.card.summary, details);
      text('div', `${d.action}${d.direction ? ` · ${d.direction}` : ''}`, details);
      if (d.card.minimumScore !== undefined) text('div', `Recorded minimum score: ${d.card.minimumScore}`, details);
    }
    text('footer', this.pinned ? 'Recorded decision · pinned (click chart to resume)' : 'Recorded decision · hover to inspect, click to pin').className = 'inspector-footer';
  }
}
