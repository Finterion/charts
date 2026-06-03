import type { Viewport } from '../types';

export interface PanZoomOptions {
  getDataLength: () => number;
  getViewport: () => Viewport;
  setViewport: (vp: Viewport) => void;
  getWidth: () => number;
}

const MIN_SPAN = 10;

export function attachPanZoom(target: HTMLElement, opts: PanZoomOptions): () => void {
  let dragging = false;
  let dragStartX = 0;
  let dragStartVp: Viewport = { startIdx: 0, endIdx: 0 };

  function clamp(vp: Viewport): Viewport {
    const n = opts.getDataLength();
    if (n === 0) return vp;
    let { startIdx, endIdx } = vp;
    let span = endIdx - startIdx;
    if (span < MIN_SPAN) span = MIN_SPAN;
    if (span > n - 1) span = n - 1;
    if (startIdx < 0) { startIdx = 0; endIdx = startIdx + span; }
    if (endIdx > n - 1) { endIdx = n - 1; startIdx = endIdx - span; }
    if (startIdx < 0) startIdx = 0;
    return { startIdx, endIdx };
  }

  function onDown(e: PointerEvent) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartVp = opts.getViewport();
    target.setPointerCapture(e.pointerId);
    target.style.cursor = 'grabbing';
  }
  function onMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const w = opts.getWidth();
    if (w === 0) return;
    const span = dragStartVp.endIdx - dragStartVp.startIdx;
    const barsPerPx = (span + 1) / w;
    const shift = Math.round(-dx * barsPerPx);
    opts.setViewport(clamp({ startIdx: dragStartVp.startIdx + shift, endIdx: dragStartVp.endIdx + shift }));
  }
  function onUp(e: PointerEvent) {
    dragging = false;
    try { target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    target.style.cursor = '';
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const vp = opts.getViewport();
    const span = vp.endIdx - vp.startIdx;
    const w = opts.getWidth();
    if (w === 0) return;
    const rect = target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const anchorFrac = mouseX / w;
    const anchorIdx = vp.startIdx + anchorFrac * span;
    const factor = e.deltaY < 0 ? 0.85 : 1.18;
    const newSpan = Math.max(MIN_SPAN, Math.round(span * factor));
    const newStart = Math.round(anchorIdx - anchorFrac * newSpan);
    opts.setViewport(clamp({ startIdx: newStart, endIdx: newStart + newSpan }));
  }

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onUp);
  target.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onUp);
    target.removeEventListener('wheel', onWheel);
  };
}
