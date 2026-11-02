import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBuffer } from '../data/buffer';
import { finterionDark } from '../themes';
import type { DecisionAnnotation } from '../types';
import { DecisionIndex, DecisionInspector, decisionColor, renderDecisions, validateDecisions } from './decisions';

const decision = (id = 'a', time = 1_700_000_000): DecisionAnnotation => ({
  id, time, panelId: 'z', value: -2, action: 'entry',
  card: {
    title: '<img onerror=alert(1)>', status: 'rejected', score: 7, minimumScore: 12,
    groups: [{ id: 'g', title: 'Evidence', rules: [{
      id: 'r', label: 'Signal', matched: false, value: -2, description: '<b>raw</b>', points: 7, timeframe: '1h',
    }] }],
  },
});
const buffer = createBuffer([0, 1, 2].map(i => ({
  time: 1_700_000_000_000 + i * 60_000, open: 1, high: 2, low: 0, close: 1,
})));

// A tiny DOM stand-in keeps these tests dependency-free; the built embed is also browser-tested.
class Element {
  className = '';
  children: Element[] = [];
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  listeners = new Map<string, (event?: unknown) => void>();
  textContent = '';
  value = '';
  parentElement?: Element;
  capturedPointer?: number;
  constructor(readonly tag: string) {}
  append(...nodes: Element[]) { this.children.push(...nodes); }
  appendChild(node: Element) { this.append(node); return node; }
  replaceChildren(...nodes: Element[]) { this.children = nodes; this.textContent = ''; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  addEventListener(key: string, value: (event?: unknown) => void) { this.listeners.set(key, value); }
  getBoundingClientRect() { return { width: Number.parseFloat(this.style.width ?? '') || 360 }; }
  setPointerCapture(id: number) { this.capturedPointer = id; }
  hasPointerCapture(id: number) { return this.capturedPointer === id; }
  releasePointerCapture() { this.capturedPointer = undefined; }
  all(): Element[] { return [this, ...this.children.flatMap(c => c.all())]; }
  click() { this.listeners.get('click')?.(); }
}
function inspector(onResize?: () => void) {
  vi.stubGlobal('document', { createElement: (tag: string) => new Element(tag) });
  const inspector = new DecisionInspector(onResize);
  return { inspector, el: inspector.el as unknown as Element };
}
afterEach(() => vi.unstubAllGlobals());

describe('decision annotations', () => {
  it('inspects protective execution without implying missing confluence scores', () => {
    const item = {
      ...decision(), signalType: 'stop_loss' as const,
      eventType: 'trigger' as const, action: 'exit' as const,
    };
    item.card.status = 'triggered';
    item.card.groups = [{ id: 'execution', title: 'Protective execution', rules: [
      { id: 'order', label: 'Order', value: 'stop-1' },
    ] }];
    const { inspector: ui, el } = inspector();
    ui.setDecisions([item]);
    expect(el.all().some(e => e.textContent === 'stop-1')).toBe(true);
    expect(el.all().some(e => e.textContent === 'A protective trigger is not a confirmed fill.')).toBe(true);
    expect(el.all().some(e => e.textContent === 'Total confluence · all groups')).toBe(false);
    expect(el.all().some(e => e.textContent === 'Weight')).toBe(false);
  });

  it('validates signal classifications and separates trigger/fill filter keys', () => {
    const item = { ...decision(), signalType: 'stop_loss' as const, eventType: 'trigger' as const };
    expect(validateDecisions([item], [{ id: 'z', kind: 'indicator' }])).toEqual([]);
    expect(validateDecisions([{ ...item, signalType: 'typo' }], [{ id: 'z', kind: 'indicator' }]))
      .toContain('data.decisions[0].signalType is invalid');
    expect(validateDecisions([{ ...item, eventType: 'typo' }], [{ id: 'z', kind: 'indicator' }]))
      .toContain('data.decisions[0].eventType is invalid');
  });

  it('renders scale signs and separate hollow/filled protective badges with matching hit targets', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      fillText: vi.fn(), fillStyle: '',
    };
    const layout = {
      ctx: ctx as unknown as CanvasRenderingContext2D, width: 300, height: 100,
      viewport: { startIdx: 0, endIdx: 2 }, yMin: -4, yMax: 0, theme: finterionDark,
    };
    for (const signalType of ['scale_in', 'scale_out'] as const) {
      vi.clearAllMocks();
      renderDecisions(layout, new DecisionIndex([{ ...decision(), signalType }], buffer), 'z');
      expect(ctx.moveTo).toHaveBeenCalledWith(45, 50);
      expect(ctx.lineTo).toHaveBeenCalledWith(55, 50);
      expect(ctx.lineTo.mock.calls.length).toBe(signalType === 'scale_in' ? 2 : 1);
      expect(ctx.arc).not.toHaveBeenCalled();
    }
    for (const signalType of ['stop_loss', 'take_profit'] as const) {
      const trigger = { ...decision('trigger'), action: 'exit' as const, signalType, eventType: 'trigger' as const };
      const fill = { ...trigger, id: 'fill', eventType: 'fill' as const };
      const index = new DecisionIndex([trigger, fill], buffer);
      vi.clearAllMocks();
      renderDecisions(layout, index, 'z');
      expect(ctx.fillText).toHaveBeenCalledWith(signalType === 'stop_loss' ? 'SL' : 'TP', 38, 50);
      expect(ctx.fillText).toHaveBeenCalledWith(signalType === 'stop_loss' ? 'SL' : 'TP', 62, 50);
      expect(index.hitTest(layout, 'z', 38, 50)?.decision.id).toBe('trigger');
      expect(index.hitTest(layout, 'z', 62, 50)?.decision.id).toBe('fill');
      expect(ctx.arc).not.toHaveBeenCalled();
    }
  });

  it.each(['long', 'short'] as const)('shows rejected %s entries orange and retains readable and raw reasons', direction => {
    const item = decision();
    item.direction = direction;
    item.card.reason = 'resolve_conflicts.cooldown_rule';
    item.card.reasonDescription = 'Long entry blocked by a 12-bar cooldown (5 bars remaining).';
    const { inspector: ui, el } = inspector();
    ui.setDecisions([item]);
    expect(el.all().some(e => e.style.cssText?.includes('border-left:3px solid #f59e0b'))).toBe(true);
    expect(el.all().some(e => e.textContent === item.card.reasonDescription)).toBe(true);
    expect(el.all().some(e => e.textContent === item.card.reason)).toBe(true);
    expect(el.all().find(e => e.attributes.get('aria-label') === 'signal_status: rejected')?.style.color).toBe('#f59e0b');
    expect(decisionColor('entry', direction, 'rejected')).toBe('#f59e0b');
  });

  it('renders inapplicable exits grey without fabricating a score or recoloring real rejections', () => {
    const { inspector: ui, el } = inspector();
    const skipped = decision('skipped');
    skipped.action = 'none';
    skipped.card.status = 'not_triggered';
    delete skipped.card.score;
    skipped.card.groups = [];
    skipped.card.reason = 'confluence.long_exit_requires_position';
    ui.setDecisions([skipped]);
    expect(el.all().some(e => e.textContent === 'Not triggered')).toBe(true);
    expect(el.all().some(e => e.textContent === 'Not evaluated')).toBe(true);
    expect(el.all().some(e => e.style.cssText?.includes('border-left:3px solid #94a3b8'))).toBe(true);
    expect(decisionColor('exit', 'long', 'rejected')).toBe('#ef4444');
    expect(decisionColor('none', 'long', 'not_triggered')).toBe('#94a3b8');
    const neutral = decision('neutral');
    neutral.action = 'none';
    const index = new DecisionIndex([neutral, skipped], buffer);
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillStyle: '',
    };
    const layout = {
      width: 300, height: 100, viewport: { startIdx: 0, endIdx: 2 },
      yMin: -4, yMax: 0,
    };
    renderDecisions({ ...layout, ctx: ctx as unknown as CanvasRenderingContext2D, theme: finterionDark }, index, 'z');
    expect(ctx.fill).toHaveBeenCalledOnce();
    expect(ctx.fillStyle).toBe('#94a3b8');
    expect(index.hitTest(layout, 'z', 50, 50)?.decision).toBe(skipped);
    const active = decision('active');
    const mixed = new DecisionIndex([neutral, skipped, active], buffer);
    expect(mixed.hitTest(layout, 'z', 50, 50)?.decision).toBe(active);
  });

  it('resizes from the left divider, clamps to available space and releases cancelled drags', () => {
    const resize = vi.fn();
    const { inspector: ui } = inspector(resize);
    const shell = ui.container as unknown as Element;
    shell.parentElement = new Element('div');
    shell.parentElement.style.width = '1000px';
    const handle = shell.all().find(e => e.attributes.get('role') === 'separator')!;
    const pointer = (clientX: number, pointerId = 1) => ({
      clientX, pointerId, button: 0, preventDefault: vi.fn(),
    });
    handle.listeners.get('pointerdown')!(pointer(700));
    expect(handle.capturedPointer).toBe(1);
    handle.listeners.get('pointermove')!(pointer(500, 2));
    expect(shell.style.width).toBeUndefined();
    handle.listeners.get('pointermove')!(pointer(500));
    expect(shell.style.width).toBe('560px');
    expect(handle.attributes.get('aria-valuenow')).toBe('560');
    handle.listeners.get('pointermove')!(pointer(0));
    expect(shell.style.width).toBe('650px');
    handle.listeners.get('pointermove')!(pointer(1000));
    expect(shell.style.width).toBe('220px');
    handle.listeners.get('pointercancel')!(pointer(1000));
    expect(handle.capturedPointer).toBeUndefined();
    handle.listeners.get('pointermove')!(pointer(500));
    expect(shell.style.width).toBe('220px');
    expect(resize).toHaveBeenCalledTimes(3);
    handle.listeners.get('pointerdown')!(pointer(700));
    handle.listeners.get('pointerup')!(pointer(700));
    expect(handle.capturedPointer).toBeUndefined();
  });

  it('supports keyboard resizing, reset and smaller embedded chart frames', () => {
    const { inspector: ui } = inspector();
    const shell = ui.container as unknown as Element;
    shell.parentElement = new Element('div');
    shell.parentElement.style.width = '1000px';
    const handle = shell.all().find(e => e.attributes.get('role') === 'separator')!;
    const key = (key: string, shiftKey = false) => {
      handle.listeners.get('keydown')!({ key, shiftKey, preventDefault: vi.fn() });
    };
    key('ArrowLeft');
    expect(shell.style.width).toBe('380px');
    key('ArrowRight', true);
    expect(shell.style.width).toBe('330px');
    key('Home');
    expect(shell.style.width).toBe('220px');
    key('End');
    expect(shell.style.width).toBe('650px');
    key('ArrowDown');
    expect(shell.style.width).toBe('650px');
    shell.parentElement.style.width = '300px';
    key('Home');
    expect(shell.style.width).toBe('195px');
    expect(handle.attributes.get('aria-valuemax')).toBe('195');
    handle.listeners.get('dblclick')!();
    expect(shell.style.width).toBe('clamp(280px,38%,420px)');
  });

  it('collapses without losing the width, pinned card or layout preferences on data updates', () => {
    const resize = vi.fn();
    const { inspector: ui, el } = inspector(resize);
    const shell = ui.container as unknown as Element;
    const toggle = shell.all().find(e => e.attributes.get('aria-label') === 'Collapse decision inspector')!;
    const a = decision(), next = decision('next', 1_700_000_060);
    a.card.title = 'Pinned card';
    next.card.title = 'Later card';
    ui.setDecisions([a, next]);
    ui.select([a], a);
    shell.style.width = '560px';
    toggle.click();
    expect(shell.attributes.get('data-collapsed')).toBe('true');
    expect(toggle.attributes.get('aria-expanded')).toBe('false');
    expect(toggle.attributes.get('aria-label')).toBe('Expand decision inspector');
    expect(el.style.display).toBe('none');
    ui.show([next]);
    toggle.click();
    expect(el.style.display).toBe('block');
    expect(shell.style.width).toBe('560px');
    expect(el.attributes.get('data-pinned')).toBe('true');
    expect(el.all().find(e => e.tag === 'h2')?.textContent).toBe('Pinned card');
    expect(shell.all().includes(toggle)).toBe(true);
    expect(resize).toHaveBeenCalledTimes(2);
    toggle.click();
    ui.setDecisions([]);
    expect(shell.style.display).toBe('none');
    ui.setDecisions([next]);
    expect(shell.style.display).toBe('flex');
    expect(el.style.display).toBe('none');
    expect(shell.attributes.get('data-collapsed')).toBe('true');
    toggle.click();
    expect(shell.style.width).toBe('560px');
    expect(el.all().find(e => e.tag === 'h2')?.textContent).toBe('Later card');
  });

  it('pins the exact clicked card until explicitly cleared, not when hovering another timestamp', () => {
    const { inspector: ui, el } = inspector();
    const a = decision(), b = decision('b');
    b.card.title = 'Clicked card';
    const next = decision('next', 1_700_000_060);
    next.card.title = 'Next timestamp';
    ui.setDecisions([a, b, next]);
    ui.select([a, b], b);
    ui.show([next]);
    expect(el.all().find(e => e.tag === 'h2')?.textContent).toBe('Clicked card');
    expect(el.attributes.get('data-pinned')).toBe('true');
    ui.clearSelection();
    expect(el.attributes.get('data-pinned')).toBe('false');
    expect(el.all().find(e => e.tag === 'h2')?.textContent).toBe('Next timestamp');
    ui.clearSelection();
    expect(el.attributes.get('data-pinned')).toBe('false');
  });
  it('keeps missing maxima explicit and handles zero capacity and signed scores without invalid bars', () => {
    const { inspector: ui, el } = inspector();
    const item = decision();
    item.card.groups = [
      { id: 'zero', title: 'Zero', score: 0, maximumScore: 0, rules: [] },
      { id: 'negative', title: 'Negative', score: -2, maximumScore: 3, rules: [] },
      { id: 'overflow', title: 'Overflow', score: 5, maximumScore: 3, rules: [] },
    ];
    ui.setDecisions([item]);
    ui.show([item]);
    expect(el.all().some(e => e.textContent === 'Maximum score')).toBe(true);
    expect(el.all().some(e => e.tag === 'strong' && e.textContent === 'Not recorded')).toBe(true);
    expect(el.all().some(e => e.textContent === 'Zero')).toBe(true);
    expect(el.all().some(e => e.textContent === '0 / 0')).toBe(true);
    const meters = el.all().filter(e => e.attributes.get('role') === 'meter');
    expect(meters.map(e => e.attributes.get('aria-valuenow'))).toEqual(['0', '3']);
    expect(meters.map(e => e.attributes.get('aria-valuetext'))).toEqual(['-2 / 3', '5 / 3']);
    expect(meters[0]!.children[0]!.style.cssText).toContain('width:0%');
    expect(meters[1]!.children[0]!.style.cssText).toContain('width:100%');
  });
  it('normalizes seconds/ms and keeps every coincident evaluation, without leaking to gaps', () => {
    const index = new DecisionIndex([decision(), decision('b', 1_700_000_000_000)], buffer);
    expect(index.nearest(0).map(d => d.id)).toEqual(['a', 'b']);
    expect(index.nearest(1)).toEqual([]);
    expect(new DecisionIndex([], null).nearest(0)).toEqual([]);
  });

  it('hits the closest visible dot within 12px, not other panels, clipped values or gaps', () => {
    const a = decision();
    const index = new DecisionIndex([a, decision('next', 1_700_000_060)], buffer);
    const layout = { width: 300, height: 100, viewport: { startIdx: 0, endIdx: 2 }, yMin: -4, yMax: 0 };
    expect(index.hitTest(layout, 'z', 58, 53)).toEqual({ bar: 0, decision: a });
    expect(index.hitTest(layout, 'z', 62, 50)?.decision).toBe(a);
    expect(index.hitTest(layout, 'z', 63, 50)).toBeNull();
    expect(index.hitTest(layout, 'z', 58, 63)).toBeNull();
    expect(index.hitTest(layout, 'other', 50, 50)).toBeNull();
    expect(index.hitTest(layout, 'z', 100, 50)).toBeNull();
    expect(index.hitTest({ ...layout, yMin: -1 }, 'z', 50, 100)).toBeNull();
    expect(index.hitTest({ ...layout, width: 0 }, 'z', 0, 50)).toBeNull();
    expect(index.hitTest({ ...layout, viewport: { startIdx: 1, endIdx: 2 } }, 'z', 0, 50)).toBeNull();
  });

  it('prefers an active dot over coincident neutral dots without dropping the other cards', () => {
    const neutral = { ...decision('neutral'), action: 'none' as const };
    const active = decision('active');
    const index = new DecisionIndex([neutral, active], buffer);
    expect(index.hitTest({
      width: 300, height: 100, viewport: { startIdx: 0, endIdx: 2 }, yMin: -4, yMax: 0,
    }, 'z', 50, 50)?.decision).toBe(active);
    expect(index.nearest(0)).toEqual([neutral, active]);
  });

  it('pins a different clicked timestamp immediately and unpins on a second click', () => {
    const { inspector: ui, el } = inspector();
    const first = decision(), next = decision('next', 1_700_000_060);
    ui.setDecisions([first, next]);
    ui.togglePin();
    ui.show([next]);
    ui.togglePin([next]);
    expect(el.all().find(e => e.tag === 'h2')?.textContent).toBe(next.card.title);
    expect(el.attributes.get('data-pinned')).toBe('true');
    ui.togglePin([next]);
    expect(el.attributes.get('data-pinned')).toBe('false');
    expect(el.all().some(e => ['Pin decision', 'Resume live hover'].includes(e.textContent))).toBe(false);
  });

  it('routes dots to the requested panel value and preserves action colors', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillStyle: '',
    };
    const index = new DecisionIndex([decision()], buffer);
    const layout = {
      ctx: ctx as unknown as CanvasRenderingContext2D, width: 300, height: 100,
      viewport: { startIdx: 0, endIdx: 2 }, yMin: -4, yMax: 0, theme: finterionDark,
    };
    renderDecisions(layout, index, 'other');
    expect(ctx.arc).not.toHaveBeenCalled();
    renderDecisions(layout, index, 'z');
    expect(ctx.arc).toHaveBeenCalledWith(50, 50, 4, 0, Math.PI * 2);
    expect(ctx.fillStyle).toBe('#f59e0b');
    expect(['entry', 'exit', 'none'].map(a => decisionColor(a as DecisionAnnotation['action'])))
      .toEqual(['#22c55e', '#ef4444', '#ffffff']);
  });

  it('uses distinct directional colors for dots and card selectors', () => {
    const colors = [
      ['entry', 'long', '#22c55e'],
      ['entry', 'short', '#a3e635'],
      ['exit', 'long', '#ef4444'],
      ['exit', 'short', '#fb923c'],
    ] as const;
    for (const [action, direction, color] of colors) {
      expect(decisionColor(action, direction)).toBe(color);
      const item = { ...decision(), action, direction };
      item.card.status = 'approved';
      const ctx = {
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
        arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillStyle: '',
      };
      renderDecisions({
        ctx: ctx as unknown as CanvasRenderingContext2D, width: 300, height: 100,
        viewport: { startIdx: 0, endIdx: 2 }, yMin: -4, yMax: 0, theme: finterionDark,
      }, new DecisionIndex([item], buffer), 'z');
      expect(ctx.fillStyle).toBe(color);
      const { inspector: ui, el } = inspector();
      ui.setDecisions([item]);
      ui.show([item]);
      expect(el.all().some(e => e.style.cssText?.includes(`border-left:3px solid ${color}`))).toBe(true);
    }
    expect(decisionColor('none', 'short')).toBe('#ffffff');
  });

  it('draws coincident neutral evaluations once, smaller and faint without outlines', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillStyle: '',
    };
    const items = Array.from({ length: 5 }, (_, i) => ({
      ...decision(String(i)), action: 'none' as const,
    }));
    const layout = {
      ctx: ctx as unknown as CanvasRenderingContext2D, width: 300, height: 100,
      viewport: { startIdx: 0, endIdx: 2 }, yMin: -4, yMax: 0, theme: finterionDark,
    };
    renderDecisions(layout, new DecisionIndex(items, buffer), 'z');
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    expect(ctx.arc).toHaveBeenCalledWith(50, 50, 3, 0, Math.PI * 2);
    expect(ctx.fillStyle).toBe('rgba(255,255,255,0.22)');
    expect(ctx.stroke).not.toHaveBeenCalled();
    ctx.arc.mockClear();
    renderDecisions(layout, new DecisionIndex([...items, decision('active')], buffer), 'z');
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.arc).toHaveBeenLastCalledWith(50, 50, 4, 0, Math.PI * 2);
    expect(ctx.fillStyle).toBe('#f59e0b');
  });

  it('validates nested evidence, finite scores, target panels and unique ids', () => {
    expect(validateDecisions([decision()], [{ id: 'z', kind: 'indicator' }])).toEqual([]);
    const bad = decision();
    bad.card.groups[0]!.rules[0]!.matched = 'yes' as unknown as boolean;
    bad.card.score = NaN;
    expect(validateDecisions([bad, bad], [{ id: 'z', kind: 'heatmap' }]).join(' '))
      .toMatch(/matched/);
    expect(validateDecisions([bad, bad], []).join(' ')).toMatch(/score/);
    expect(validateDecisions([decision(), decision()], []).join(' ')).toMatch(/\.id/);
  });

  it('renders safe text, raw scores, all coincident controls and only updates changed hover', () => {
    const { inspector: ui, el } = inspector();
    const a = decision(), b = decision('b');
    ui.setDecisions([a, b]);
    ui.show([a, b]);
    const content = () => el.all().map(e => e.textContent).join(' ');
    expect(content()).toContain('Total confluence');
    expect(content()).not.toContain('from score boundary');
    expect(content()).toContain('<img onerror=alert(1)>');
    expect(el.all().some(e => e.attributes.get('aria-label') === '− Not triggered')).toBe(true);
    expect(el.all().filter(e => e.tag === 'img')).toHaveLength(0);
    expect(el.all().filter(e => e.tag === 'select' || e.tag === 'option')).toHaveLength(0);
    const first = el.children[1]!.children[0];
    ui.show([a, b]);
    expect(el.children[1]!.children[0]).toBe(first);
    expect(ui.container.style.cssText).toContain('clamp(280px,38%,420px)');
    ui.setDecisions([]);
    expect(ui.container.style.display).toBe('none');
  });

  it('places card selectors before actual named scoring without normalization', () => {
    const { inspector: ui, el } = inspector();
    const item = decision();
    item.card.score = 3;
    item.card.maximumScore = 4;
    item.card.minimumScore = 0;
    item.card.groups = [
      { id: 'primary', title: 'Primary', matched: true, score: 3, maximumScore: 3, rules: [
        { id: 'score:0', label: 'Score', value: 3 },
        { id: 'minimum_score:1', label: 'Minimum score', value: 1 },
        { id: 'z:2', label: 'Z-score', matched: true, points: 3 },
      ] },
      { id: 'secondary', title: 'Secondary', matched: false, score: 0, maximumScore: 1, rules: [
        { id: 'score:3', label: 'Score', value: 0 },
        { id: 'minimum_score:4', label: 'Minimum score', value: 1 },
      ] },
      { id: 'qualification', title: 'Qualification', rules: [
        { id: 'normal_path:5', label: 'Normal path', matched: false },
        { id: 'override_path:6', label: 'Override path', matched: true },
      ] },
    ];
    ui.setDecisions([item]);
    expect(el.children[0]!.all().some(e => e.attributes.get('aria-label') === 'Cards at selected timestamp')).toBe(true);
    const summary = el.children[1]!;
    expect(summary.attributes.get('aria-label')).toBe('Confluence score');
    const text = summary.all().map(e => e.textContent).join(' ');
    expect(text).toContain('Primary');
    expect(text).toContain('3 / 3');
    expect(text).toContain('Secondary');
    expect(text).toContain('0 / 1');
    expect(text).not.toContain('threshold');
    expect(text).not.toContain('Normal path');
    expect(text).not.toContain('Override path');
    expect(text).not.toContain('Requirements passed');
    expect(text).not.toContain('Recorded weighted evidence');
    expect(text).not.toContain('/ 100');
    expect(text).not.toContain('Minimum: 0');
    expect(summary.all().some(e => e.tag === 'strong' && e.textContent === '4')).toBe(true);
    const meters = summary.all().filter(e => e.attributes.get('role') === 'meter');
    expect(meters.map(e => e.attributes.get('aria-valuetext'))).toEqual(['3 / 3', '0 / 1']);
    expect(meters.map(e => e.children[0]!.style.cssText)).toEqual([
      'height:100%;width:100%;background:#34cba3;',
      'height:100%;width:0%;background:#34cba3;',
    ]);
  });
  it('pins cards, preserves selection while moving into inspector and resumes latest live bar', () => {
    const { inspector: ui, el } = inspector();
    const a = decision(), b = decision('b', 1_700_000_060);
    b.card.title = 'Second evaluation';
    ui.setDecisions([a, b]);
    ui.togglePin();
    ui.show([b]);
    expect(el.all().find(e => e.tag === 'h2')!.textContent).toBe(a.card.title);
    ui.togglePin();
    expect(el.all().find(e => e.tag === 'h2')!.textContent).toBe('Second evaluation');
    ui.show([]);
    expect(el.children[2]!.textContent).toContain('No decision evaluated');
    ui.show([a]);
    el.all().find(e => e.tag === 'button' && e.textContent.startsWith('entry:'))!.click();
    ui.show([b]);
    expect(el.all().find(e => e.tag === 'h2')!.textContent).toBe(a.card.title);
  });

  it('initializes every coincidence button before the first hover', () => {
    const { inspector: ui, el } = inspector();
    ui.setDecisions([decision(), decision('b', 1_700_000_000_000), decision('c', 1_700_000_060)]);
    expect(el.all().filter(e => e.tag === 'button' && e.textContent.startsWith('entry:'))).toHaveLength(2);
  });

  it('offers compact timestamp-local card choices and preserves the chosen type on resume', () => {
    const { inspector: ui, el } = inspector();
    const items = [
      { ...decision('a'), label: 'Long entry' },
      { ...decision('b'), label: 'Short entry' },
      { ...decision('c', 1_700_000_060), label: 'Long entry' },
      { ...decision('d', 1_700_000_060), label: 'Short entry' },
    ];
    items[3]!.card = { ...items[3]!.card, title: 'Next short evaluation' };
    ui.setDecisions(items);
    expect(el.all().some(e => e.textContent === '2 cards at this timestamp')).toBe(true);
    el.all().find(e => e.tag === 'button' && e.textContent === 'Short entry')!.click();
    ui.show(items.slice(2));
    ui.togglePin();
    expect(el.all().find(e => e.tag === 'h2')!.textContent).toBe('Next short evaluation');
    const group = el.all().find(e => e.attributes.get('aria-label') === 'Cards at selected timestamp')!;
    expect(group.children.map(e => e.textContent)).toEqual(['Long entry', 'Short entry']);
    expect(group.children[1]!.attributes.get('aria-pressed')).toBe('true');
  });

  it('lists only cards at the hovered timestamp without a timestamp dropdown', () => {
    const { inspector: ui, el } = inspector();
    const items = [
      { ...decision('a'), label: 'Long entry' },
      { ...decision('b', 1_700_000_060), label: 'Long exit' },
      { ...decision('c', 1_700_000_060), label: 'Short exit' },
    ];
    ui.setDecisions(items);
    ui.show(items.slice(1));
    expect(el.all().some(e => e.tag === 'select')).toBe(false);
    const group = el.all().find(e => e.attributes.get('aria-label') === 'Cards at selected timestamp')!;
    expect(group.children.map(e => e.textContent)).toEqual(['Long exit', 'Short exit']);
  });

  it('distinguishes recorded evidence from explicitly unevaluated rules and groups', () => {
    const { inspector: ui, el } = inspector();
    const d = decision();
    d.card.groups = [
      { id: 'raw', title: 'Evidence', rules: [{ id: 'score', label: 'Score', value: 3.5 }] },
      { id: 'missing', title: 'Pending', matched: null, rules: [{ id: 'pending', label: 'Pending rule', matched: null }] },
      { id: 'mixed', title: 'Evaluated', matched: true, rules: [
        { id: 'pass', label: 'Signal', matched: true },
        { id: 'fail', label: 'Other condition', matched: false },
        { id: 'raw', label: 'Signal selected', value: false },
      ] },
    ];
    ui.setDecisions([d]);
    const text = el.all().map(e => e.textContent).join(' ');
    expect(text).toContain('Score');
    const sections = el.all().filter(e => e.tag === 'section' && e.attributes.has('aria-label'));
    expect(sections.some(e => e.attributes.get('aria-label') === 'Evidence')).toBe(true);
    expect(sections.some(e => e.attributes.get('aria-label') === 'Pending' && e.all().some(n => n.textContent === '— Not evaluated'))).toBe(true);
    expect(el.all().some(e => e.attributes.get('aria-label') === '— Not evaluated')).toBe(true);
    expect(el.all().some(e => e.attributes.get('aria-label') === '✓ Pass')).toBe(true);
    expect(el.all().some(e => e.attributes.get('aria-label') === 'Recorded')).toBe(true);
    expect(el.all().some(e => e.attributes.get('aria-label') === '✗ Fail')).toBe(true);
    d.card.groups[2]!.matched = undefined;
    ui.setDecisions([d]);
    const evaluated = el.all().find(e => e.tag === 'section' && e.attributes.get('aria-label') === 'Evaluated')!;
    expect(evaluated.all().some(e => e.textContent === 'Recorded')).toBe(true);
  });

  it('renders weighted rules as visual rows with safe references, individual capacity and group totals', () => {
    const { inspector: ui, el } = inspector();
    const item = decision();
    item.card.groups = [{
      id: 'secondary', title: 'Secondary triggers', score: 2, maximumScore: 5,
      rules: [
        { id: 'score:0', label: 'Score', value: 2 },
        { id: 'rsi:1', label: 'Momentum', matched: true, value: 63.4, description: 'RSI between 55 and 70', timeframe: '4h', points: 2, maximumPoints: 2 },
        { id: 'volume:2', label: 'Volume', matched: false, points: 0, maximumPoints: 3 },
      ],
    }];
    ui.setDecisions([item]);
    const section = el.all().find(e => e.tag === 'section' && e.attributes.get('aria-label') === 'Secondary triggers')!;
    expect(section.all().find(e => e.tag === 'h4')?.textContent).toBe('Secondary triggers');
    expect(section.all().some(e => e.textContent === 'WEIGHTED')).toBe(true);
    const rows = section.all().filter(e => e.className === 'evidence-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.all().map(e => e.textContent)).toContain('Value 63.4 / 4h');
    expect(rows[0]!.all().map(e => e.textContent)).toContain('+2');
    expect(rows[0]!.all().map(e => e.textContent)).toContain('/ 2 PTS');
    expect(rows[1]!.all().map(e => e.textContent)).toContain('+0');
    expect(section.all().map(e => e.textContent)).toContain('Maximum 5 points');
    const details = section.all().find(e => e.tag === 'details')!;
    expect(details.children[0]!.textContent).toBe('Recorded group details');
    expect(details.attributes.has('open')).toBe(false);
    item.card.groups[0]!.rules[1]!.maximumPoints = -1;
    expect(validateDecisions([item], [{ id: 'z', kind: 'indicator' }]).join(' ')).toContain('maximumPoints');
  });

  it('validates explicit boolean/null group outcomes without accepting strings', () => {
    const d = decision();
    for (const matched of [true, false, null]) {
      d.card.groups[0]!.matched = matched;
      expect(validateDecisions([d], [{ id: 'z', kind: 'indicator' }])).toEqual([]);
    }
    d.card.groups[0]!.matched = 'yes' as never;
    expect(validateDecisions([d], [{ id: 'z', kind: 'indicator' }]).join(' ')).toContain('groups[0].matched');
  });

  it('renders recorded outcomes, conditions, weights and actual strength separately from utilization', () => {
    const { inspector: ui, el } = inspector();
    const item = decision();
    item.card = {
      title: 'BTC / Scale-in / Stage 1', status: 'rejected',
      reason: 'resolve_conflicts.state_block_open', strength: .4,
      position: 'Long - 1 open entries / limit 3',
      qualification: 'All group thresholds; requirements and vetoes apply',
      score: 3, maximumScore: 4,
      groups: [{
        id: 'primary', title: 'Primary triggers', matched: true,
        score: 1, maximumScore: 1, minimumMatches: 1, aggregation: 'sum',
        rules: [{
          id: 'z', label: 'Z-score', matched: true, required: true,
          value: -2.68, description: 'needs <= -2.00', weight: 1, points: 1,
        }],
      }, {
        id: 'secondary', title: 'Secondary triggers', matched: true,
        score: 2, maximumScore: 3, minimumScore: 2,
        rules: [{
          id: 'stochastic', label: 'Stochastic', matched: true, weight: 1, points: 1,
        }, {
          id: 'willr', label: 'Williams %R', matched: false, weight: 1, points: 0,
        }, {
          id: 'rsi', label: 'RSI', matched: true, weight: 1, points: 1,
        }],
      }],
    };
    ui.setDecisions([item]);
    const text = el.all().map(e => e.textContent).join(' ');
    expect(text).toContain('resolve_conflicts.state_block_open');
    expect(text).toContain('40% signal strength');
    expect(text).toContain('75% score utilization');
    expect(text).toContain('Long - 1 open entries / limit 3');
    expect(text).toContain('Required');
    expect(text).toContain('needs <= -2.00');
    expect(el.all().filter(e => e.tag === 'table')).toHaveLength(2);
    expect(el.all().some(e => e.tag === 'th' && e.textContent === 'Weight' && e.attributes.get('scope') === 'col')).toBe(true);
    expect(el.all().some(e => e.attributes.get('aria-live') === 'polite')).toBe(true);
    expect(el.all().some(e => e.attributes.get('data-status') === 'rejected')).toBe(true);
    expect(el.all().some(e => e.className === 'signal-reason' && e.textContent === item.card.reason)).toBe(true);
    expect(validateDecisions([item], [{ id: 'z', kind: 'indicator' }])).toEqual([]);
    item.card.reason = null;
    ui.setDecisions([item]);
    expect(el.all().some(e => e.textContent === 'No blocking reason')).toBe(true);
  });

  it('provides dark controls with visible keyboard focus and pressed states', () => {
    const { el } = inspector();
    const css = el.all().find(e => e.tag === 'style')?.textContent ?? '';
    expect(css).toContain('background:#1e293b');
    expect(css).toContain('border-radius:6px');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('outline:2px solid');
    expect(css).toContain('[aria-pressed="true"]');
  });
});
