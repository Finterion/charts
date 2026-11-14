export function createInspectorResizeHandle(container: HTMLElement, options: {
  label: string;
  defaultWidth: string;
  bounds: () => { minimum: number; maximum: number };
  onResize?: () => void;
}) {
  const handle = document.createElement('div');
  let drag: { pointerId: number; x: number; width: number } | undefined;
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-label', options.label);
  handle.setAttribute('aria-orientation', 'vertical');
  handle.title = 'Drag to resize; Left/Right to adjust; double-click to reset';
  const updateValues = () => {
    const { minimum, maximum } = options.bounds();
    handle.setAttribute('aria-valuemin', String(minimum));
    handle.setAttribute('aria-valuemax', String(maximum));
    handle.setAttribute('aria-valuenow', String(Math.round(
      Math.max(minimum, Math.min(maximum, container.getBoundingClientRect().width)),
    )));
  };
  const setWidth = (width: number) => {
    const { minimum, maximum } = options.bounds();
    container.style.width = `${Math.max(minimum, Math.min(maximum, width))}px`;
    updateValues();
    options.onResize?.();
  };
  handle.addEventListener('focus', updateValues);
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || drag) return;
    e.preventDefault();
    drag = { pointerId: e.pointerId, x: e.clientX, width: container.getBoundingClientRect().width };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (drag?.pointerId !== e.pointerId) return;
    e.preventDefault();
    setWidth(drag.width + drag.x - e.clientX);
  });
  const endDrag = (e: PointerEvent) => {
    if (drag?.pointerId !== e.pointerId) return;
    drag = undefined;
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('lostpointercapture', () => { drag = undefined; });
  handle.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const { minimum, maximum } = options.bounds();
    const step = e.shiftKey ? 50 : 20;
    setWidth(e.key === 'Home' ? minimum : e.key === 'End' ? maximum
      : container.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? step : -step));
  });
  handle.addEventListener('dblclick', () => {
    container.style.width = options.defaultWidth;
    updateValues();
    options.onResize?.();
  });
  return { handle, updateValues };
}
