import type { Viewport } from '../types';

export interface ZoomBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BoxZoomRegion extends ZoomBox {
  onZoom: (selection: ZoomBox) => void;
}

export interface PanZoomOptions {
  getDataLength: () => number;
  getViewport: () => Viewport;
  setViewport: (vp: Viewport) => void;
  getWidth: () => number;
  requireZoomModifier?: () => boolean;
  canStartPan?: (event: PointerEvent) => boolean;
  wheelTarget?: HTMLElement;
  getBoxZoomRegion?: (event: PointerEvent) => BoxZoomRegion | null;
}

const MIN_SPAN = 10;

export function attachPanZoom(target: HTMLElement, opts: PanZoomOptions): () => void {
  const wheelTarget = opts.wheelTarget ?? target;
  let dragging = false;
  let dragStartX = 0;
  let dragStartVp: Viewport = { startIdx: 0, endIdx: 0 };
  let pointerId: number | null = null;
  let boxRegion: BoxZoomRegion | null = null;
  let box: HTMLDivElement | null = null;
  let startY = 0;
  let selection: ZoomBox | null = null;

  function clamp(vp: Viewport): Viewport {
    const n = opts.getDataLength();
    if (n === 0) return vp;
    let { startIdx, endIdx } = vp;
    let span = endIdx - startIdx;
    if (span < MIN_SPAN) span = MIN_SPAN;
    if (span > n - 1) span = n - 1;
    endIdx = startIdx + span;
    if (startIdx < 0) { startIdx = 0; endIdx = startIdx + span; }
    if (endIdx > n - 1) { endIdx = n - 1; startIdx = endIdx - span; }
    if (startIdx < 0) startIdx = 0;
    return { startIdx, endIdx };
  }

  function onDown(e: PointerEvent) {
    if (pointerId !== null || e.button > 0 || e.isPrimary === false) return;
    if (e.shiftKey && opts.getBoxZoomRegion) {
      if (opts.getDataLength() < 2 || opts.getWidth() <= 0) return;
      const region = opts.getBoxZoomRegion(e);
      if (!region || region.width <= 0 || region.height <= 0) return;
      boxRegion = region;
      e.preventDefault();
      box = target.ownerDocument.createElement('div');
      box.dataset.finterionBoxZoom = '';
      box.style.cssText = 'position:absolute;pointer-events:none;box-sizing:border-box;border:1px dashed currentColor;background:rgba(56,189,248,.15);z-index:1;';
      target.appendChild(box);
      startY = e.clientY;
    } else {
      if (opts.canStartPan && !opts.canStartPan(e)) return;
    }
    dragging = true;
    pointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartVp = opts.getViewport();
    target.setPointerCapture(e.pointerId);
    target.style.cursor = boxRegion ? 'crosshair' : 'grabbing';
  }
  function onMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    if (boxRegion && box) {
      const endX = Math.max(boxRegion.left, Math.min(boxRegion.left + boxRegion.width, e.clientX));
      const endY = Math.max(boxRegion.top, Math.min(boxRegion.top + boxRegion.height, e.clientY));
      selection = {
        left: Math.min(dragStartX, endX), top: Math.min(startY, endY),
        width: Math.abs(endX - dragStartX), height: Math.abs(endY - startY),
      };
      const rect = target.getBoundingClientRect();
      Object.assign(box.style, {
        left: `${selection.left - rect.left}px`, top: `${selection.top - rect.top}px`,
        width: `${selection.width}px`, height: `${selection.height}px`,
      });
      return;
    }
    const dx = e.clientX - dragStartX;
    const w = opts.getWidth();
    if (w === 0) return;
    const span = dragStartVp.endIdx - dragStartVp.startIdx;
    const barsPerPx = (span + 1) / w;
    const shift = Math.round(-dx * barsPerPx);
    opts.setViewport(clamp({ startIdx: dragStartVp.startIdx + shift, endIdx: dragStartVp.endIdx + shift }));
  }
  function onUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (e.type === 'pointerup' && boxRegion && opts.getWidth() > 0 && opts.getDataLength() >= 2) {
      onMove(e);
      if (selection && selection.width >= 4 && selection.height >= 4) {
        const rect = target.getBoundingClientRect();
        const band = opts.getWidth() / (dragStartVp.endIdx - dragStartVp.startIdx + 1);
        const startIdx = Math.floor(dragStartVp.startIdx + (selection.left - rect.left) / band);
        const endIdx = Math.ceil(dragStartVp.startIdx + (selection.left + selection.width - rect.left) / band) - 1;
        boxRegion.onZoom({
          ...selection, left: selection.left - boxRegion.left, top: selection.top - boxRegion.top,
        });
        opts.setViewport(clamp({ startIdx, endIdx }));
      }
    }
    cancelDrag();
  }
  function cancelDrag() {
    const capturedId = pointerId;
    dragging = false;
    pointerId = null;
    if (capturedId !== null && target.hasPointerCapture?.(capturedId)) target.releasePointerCapture(capturedId);
    box?.remove();
    box = null;
    boxRegion = null;
    selection = null;
    target.style.cursor = '';
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && pointerId !== null) {
      cancelDrag();
    }
  }
  function onWheel(e: WheelEvent) {
    if (dragging) return;
    if (opts.requireZoomModifier?.() && !e.ctrlKey && !e.metaKey) return;
    if (!e.deltaY || opts.getDataLength() < 2 || opts.getWidth() <= 0) return;
    e.preventDefault();
    const vp = opts.getViewport();
    const span = vp.endIdx - vp.startIdx;
    const w = opts.getWidth();
    if (w === 0) return;
    const rect = target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const anchorFrac = Math.max(0, Math.min(1, mouseX / w));
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
  target.addEventListener('lostpointercapture', onUp);
  target.ownerDocument?.addEventListener('keydown', onKeyDown);
  wheelTarget.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    cancelDrag();
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onUp);
    target.removeEventListener('lostpointercapture', onUp);
    target.ownerDocument?.removeEventListener('keydown', onKeyDown);
    wheelTarget.removeEventListener('wheel', onWheel);
  };
}
