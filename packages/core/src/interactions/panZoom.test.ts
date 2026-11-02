import { describe, expect, it, vi } from 'vitest';
import { attachPanZoom } from './panZoom';

function wheelHandler(requireZoomModifier?: () => boolean, canStartPan?: (event: PointerEvent) => boolean) {
  const target: Pick<HTMLElement, 'addEventListener' | 'removeEventListener' | 'getBoundingClientRect' | 'style' | 'setPointerCapture' | 'releasePointerCapture'> = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0 } as DOMRect),
    style: {} as CSSStyleDeclaration,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  };
  const setViewport = vi.fn();
  const detach = attachPanZoom(target as HTMLElement, {
    getDataLength: () => 1000,
    getViewport: () => ({ startIdx: 100, endIdx: 300 }),
    getWidth: () => 1000,
    setViewport,
    requireZoomModifier,
    canStartPan,
  });
  const listener = vi.mocked(target.addEventListener).mock.calls.find(([name]) => name === 'wheel')![1] as EventListener;
  const fire = (modifiers: Partial<WheelEvent> = {}) => {
    const event = { clientX: 500, deltaY: 100, preventDefault: vi.fn(), ...modifiers };
    listener(event as WheelEvent);
    return event;
  };
  return { fire, setViewport, detach, target };
}

describe('Chart scrolling, zooming and panning', () => {
  it.each([true, false])('starts a pan only when the hit-test allows it: %s', allowed => {
    const { target, setViewport } = wheelHandler(undefined, () => allowed);
    const fire = (name: string, clientX: number) => {
      const listener = vi.mocked(target.addEventListener).mock.calls.find(([event]) => event === name)![1] as EventListener;
      listener({ clientX, pointerId: 1 } as PointerEvent);
    };
    fire('pointerdown', 500);
    expect(target.style.cursor).toBe(allowed ? 'grabbing' : undefined);
    fire('pointermove', 520);
    expect(setViewport).toHaveBeenCalledTimes(allowed ? 1 : 0);
    expect(target.setPointerCapture).toHaveBeenCalledTimes(allowed ? 1 : 0);
    fire('pointerup', 520);
  });

  describe('Shift-drag box zoom', () => {
    function setup() {
      const box = { dataset: {}, style: {}, remove: vi.fn() };
      const doc = {
        createElement: vi.fn(() => box), addEventListener: vi.fn(), removeEventListener: vi.fn(),
      };
      const target = {
        ownerDocument: doc, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        appendChild: vi.fn(), style: {} as CSSStyleDeclaration,
        getBoundingClientRect: () => ({ left: 100, top: 20 }),
        setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn(),
      };
      const onZoom = vi.fn();
      const setViewport = vi.fn();
      const getBoxZoomRegion = vi.fn(() => ({
        left: 100, top: 40, width: 944, height: 180, onZoom,
      }));
      const detach = attachPanZoom(target as unknown as HTMLElement, {
        getDataLength: () => 1000, getViewport: () => ({ startIdx: 100, endIdx: 299 }),
        getWidth: () => 1000, setViewport, getBoxZoomRegion,
      });
      const fire = (type: string, clientX: number, clientY: number, extras: Partial<PointerEvent> = {}) => {
        const listener = target.addEventListener.mock.calls.find(([name]) => name === type)![1] as EventListener;
        const event = { type, clientX, clientY, pointerId: 1, button: 0, shiftKey: true, preventDefault: vi.fn(), ...extras };
        listener(event as PointerEvent);
        return event;
      };
      return { fire, box, doc, target, onZoom, setViewport, detach, getBoxZoomRegion };
    }

    it.each([false, true])('draws the box and applies both axes on release (reverse=%s)', reverse => {
      const { fire, box, target, onZoom, setViewport } = setup();
      expect(fire('pointerdown', reverse ? 600 : 300, reverse ? 170 : 80).preventDefault).toHaveBeenCalledOnce();
      fire('pointermove', reverse ? 300 : 600, reverse ? 80 : 170);
      expect(target.style.cursor).toBe('crosshair');
      expect(box.style).toMatchObject({ left: '200px', top: '60px', width: '300px', height: '90px' });
      expect(box.style).toMatchObject({ cssText: expect.stringContaining('border:1px dashed currentColor') });
      expect(setViewport).not.toHaveBeenCalled();
      fire('pointerup', reverse ? 300 : 600, reverse ? 80 : 170);
      expect(onZoom).toHaveBeenCalledWith({ left: 200, top: 40, width: 300, height: 90 });
      expect(setViewport).toHaveBeenCalledWith({ startIdx: 140, endIdx: 199 });
      expect(box.remove).toHaveBeenCalledOnce();
      expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('clips selection to the starting panel, excluding its title and axis', () => {
      const { fire, box, onZoom, setViewport } = setup();
      fire('pointerdown', 300, 80);
      fire('pointermove', 2000, 1000);
      expect(box.style).toMatchObject({ width: '744px', height: '140px' });
      fire('pointerup', 2000, 1000);
      expect(onZoom).toHaveBeenCalledWith({ left: 200, top: 40, width: 744, height: 140 });
      expect(setViewport).toHaveBeenCalledWith({ startIdx: 140, endIdx: 288 });
    });

    it.each(['pointercancel', 'lostpointercapture'])('cancels rather than zooming on %s', type => {
      const { fire, onZoom, setViewport, box } = setup();
      fire('pointerdown', 300, 80);
      fire('pointermove', 600, 170);
      fire(type, 600, 170);
      expect(box.remove).toHaveBeenCalledOnce();
      expect(onZoom).not.toHaveBeenCalled();
      expect(setViewport).not.toHaveBeenCalled();
    });

    it.each(['escape', 'detach'])('cleans up the active gesture on %s', action => {
      const { fire, onZoom, setViewport, box, doc, detach } = setup();
      fire('pointerdown', 300, 80);
      fire('pointermove', 600, 170);
      if (action === 'detach') detach();
      else {
        const listener = doc.addEventListener.mock.calls[0]![1] as EventListener;
        listener({ key: 'Escape' } as KeyboardEvent);
      }
      fire('pointerup', 600, 170);
      expect(box.remove).toHaveBeenCalledOnce();
      expect(onZoom).not.toHaveBeenCalled();
      expect(setViewport).not.toHaveBeenCalled();
      if (action === 'detach') expect(doc.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('ignores tiny boxes, secondary buttons and unrelated pointers', () => {
      const { fire, target, onZoom, setViewport } = setup();
      fire('pointerdown', 300, 80, { button: 2 });
      fire('pointerdown', 300, 80, { isPrimary: false });
      expect(target.setPointerCapture).not.toHaveBeenCalled();
      fire('pointerdown', 300, 80);
      fire('pointermove', 600, 170, { pointerId: 2 });
      fire('pointerup', 302, 82);
      expect(onZoom).not.toHaveBeenCalled();
      expect(setViewport).not.toHaveBeenCalled();
    });

    it('preserves panning without Shift and enforces the minimum X span', () => {
      const { fire, target, setViewport, getBoxZoomRegion } = setup();
      fire('pointerdown', 300, 80, { shiftKey: false });
      expect(target.style.cursor).toBe('grabbing');
      expect(getBoxZoomRegion).not.toHaveBeenCalled();
      fire('pointermove', 350, 80, { shiftKey: false });
      expect(setViewport).toHaveBeenLastCalledWith({ startIdx: 90, endIdx: 289 });
      fire('pointerup', 350, 80, { shiftKey: false });
      fire('pointerdown', 300, 80);
      fire('pointerup', 310, 120);
      expect(setViewport).toHaveBeenLastCalledWith({ startIdx: 140, endIdx: 150 });
    });
  });
  it('leaves unmodified wheel events for native vertical scrolling when overflowing', () => {
    const { fire, setViewport } = wheelHandler(() => true);
    const event = fire();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(setViewport).not.toHaveBeenCalled();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])('allows modified wheel zoom with %o', modifiers => {
    const { fire, setViewport } = wheelHandler(() => true);
    expect(fire(modifiers).preventDefault).toHaveBeenCalledOnce();
    expect(setViewport).toHaveBeenCalledOnce();
  });

  it('zooms in and out around the cursor with Ctrl held', () => {
    const { fire, setViewport } = wheelHandler(() => true);
    fire({ ctrlKey: true, deltaY: -100 });
    expect(setViewport).toHaveBeenLastCalledWith({ startIdx: 115, endIdx: 285 });
    fire({ ctrlKey: true, deltaY: 100 });
    expect(setViewport).toHaveBeenLastCalledWith({ startIdx: 82, endIdx: 318 });
  });

  it('does not consume horizontal-only wheel events', () => {
    const { fire, setViewport } = wheelHandler(() => true);
    expect(fire({ ctrlKey: true, deltaY: 0, deltaX: 10 }).preventDefault).not.toHaveBeenCalled();
    expect(setViewport).not.toHaveBeenCalled();
  });

  it('accepts wheel events from a larger chart region and detaches that listener', () => {
    const { target } = wheelHandler();
    const region = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const setViewport = vi.fn();
    const detach = attachPanZoom(target as HTMLElement, {
      getDataLength: () => 1000, getViewport: () => ({ startIdx: 100, endIdx: 300 }),
      getWidth: () => 1000, setViewport, requireZoomModifier: () => true,
      wheelTarget: region as unknown as HTMLElement,
    });
    expect(region.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    const listener = region.addEventListener.mock.calls[0]![1] as EventListener;
    const event = { clientX: 1100, deltaY: -100, ctrlKey: true, preventDefault: vi.fn() };
    listener(event as unknown as WheelEvent);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(setViewport).toHaveBeenLastCalledWith({ startIdx: 130, endIdx: 300 });
    detach();
    expect(region.removeEventListener).toHaveBeenCalledWith('wheel', listener);
  });

  it('preserves ordinary wheel zoom when the chart does not overflow', () => {
    let overflowing = true;
    const { fire, setViewport } = wheelHandler(() => overflowing);
    fire();
    overflowing = false;
    expect(fire().preventDefault).toHaveBeenCalledOnce();
    expect(setViewport).toHaveBeenCalledOnce();
  });

  it('preserves default wheel zoom and removes the listener on cleanup', () => {
    const { fire, setViewport, detach, target } = wheelHandler();
    expect(fire().preventDefault).toHaveBeenCalledOnce();
    expect(setViewport).toHaveBeenCalledOnce();
    detach();
    expect(target.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function));
  });
});
