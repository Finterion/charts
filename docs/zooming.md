# Zooming & panning

Charts are interactive by default. Users can pan and zoom with a mouse,
trackpad, or touch screen. This page covers how to configure the initial
viewport and how to restrict or disable interactions.

---

## Default behaviour

| Gesture | Effect |
|---------|--------|
| Drag on chart | Pan left / right |
| Scroll wheel / pinch | Zoom in / out, anchored at the cursor |
| Drag on right (Y) axis | Y-scale stretch / compress per panel |
| Drag on bottom (X) axis | X-scale zoom |
| Double-click right axis | Reset Y scale for all panels |
| Double-click bottom axis | Reset to last-200-bars view |

---

## Initial viewport

### `initialFit`

Chooses what is visible when the chart first mounts.

```tsx
// Show the last ~200 bars (default — good for live feeds)
<Chart initialFit="recent" ... />

// Fit every bar in the buffer (good for backtests, static datasets)
<Chart initialFit="all" ... />
```

### `initialZoom`

A percentage `(0, 100]` of the buffer to show on mount. `100` is fully
zoomed out (identical to `initialFit="all"`); smaller values zoom in.

```tsx
// Show the most recent 25 % of bars
<Chart initialZoom={25} ... />
```

When `initialZoom` is set it overrides `initialFit`.

### `viewport`

For precise control, supply a `Viewport` directly. Indices are 0-based and
refer to positions in the data buffer.

```tsx
import type { Viewport } from '@finterion/charts-core';

// Show bars 100 → 299 (200-bar window starting at index 100)
const vp: Viewport = { startIdx: 100, endIdx: 299 };

<Chart viewport={vp} ... />
```

---

## Controlled viewport

Use `viewport` + `onViewportChange` to keep the chart viewport in sync with
external state (e.g. linking two charts together).

```tsx
const [vp, setVp] = useState<Viewport>({ startIdx: 0, endIdx: 199 });

<Chart
  viewport={vp}
  onViewportChange={setVp}
  data={data}
  panels={panels}
/>
```

The callback fires on every pan/zoom event. Avoid expensive re-renders inside
it — the chart re-draws at 60 fps during interaction.

---

## Disabling interactions

Set `interactive={false}` to produce a fully static chart. All
mouse/touch/pointer pan and zoom handlers are removed; the crosshair tooltip
still works.

```tsx
<Chart
  interactive={false}
  initialFit="all"
  data={data}
  panels={panels}
/>
```

Typical use-cases:
- Train/test or regime-annotation previews where zooming would hide the
  segment boundaries.
- Thumbnail / card charts that should never respond to accidental scrolls.
- Dashboard tiles embedded inside a scrollable page (prevents the chart from
  swallowing scroll events).

Y-axis drag and double-click reset are also disabled when `interactive` is
`false`.

---

## Core API (imperative)

All of the above options are also available on the `ChartOptions` object
passed to the `Chart` constructor.

```ts
import { Chart, createBuffer } from '@finterion/charts-core';

const chart = new Chart(container, {
  initialFit: 'all',
  interactive: false,
  panels: [...],
});
chart.setData(createBuffer(bars));

// Navigate programmatically at any time:
chart.setViewport({ startIdx: 50, endIdx: 250 });
```
