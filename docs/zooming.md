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

---\n\n## Initial viewport\n\n### `initialFit`\n\nChooses what is visible when the chart first mounts.\n\n```tsx\n// Show the last ~200 bars (default — good for live feeds)\n<Chart initialFit=\"recent\" ... />\n\n// Fit every bar in the buffer (good for backtests, static datasets)\n<Chart initialFit=\"all\" ... />\n```\n\n### `initialZoom`\n\nA percentage `(0, 100]` of the buffer to show on mount. `100` is fully\nzoomed out (identical to `initialFit=\"all\"`); smaller values zoom in.\n\n```tsx\n// Show the most recent 25 % of bars\n<Chart initialZoom={25} ... />\n```\n\nWhen `initialZoom` is set it overrides `initialFit`.\n\n### `viewport`\n\nFor precise control, supply a `Viewport` directly. Indices are 0-based and\nrefer to positions in the data buffer.\n\n```tsx\nimport type { Viewport } from '@finterion/charts-core';\n\n// Show bars 100 → 299 (200-bar window starting at index 100)\nconst vp: Viewport = { startIdx: 100, endIdx: 299 };\n\n<Chart viewport={vp} ... />\n```\n\n---\n\n## Controlled viewport\n\nUse `viewport` + `onViewportChange` to keep the chart viewport in sync with\nexternal state (e.g. linking two charts together).\n\n```tsx\nconst [vp, setVp] = useState<Viewport>({ startIdx: 0, endIdx: 199 });\n\n<Chart\n  viewport={vp}\n  onViewportChange={setVp}\n  data={data}\n  panels={panels}\n/>\n```\n\nThe callback fires on every pan/zoom event. Avoid expensive re-renders inside\nit \u2014 the chart re-draws at 60 fps during interaction.\n\n---\n\n## Disabling interactions\n\nSet `interactive={false}` to produce a fully static chart. All\nmouse/touch/pointer pan and zoom handlers are removed; the crosshair tooltip\nstill works.\n\n```tsx\n<Chart\n  interactive={false}\n  initialFit=\"all\"\n  data={data}\n  panels={panels}\n/>\n```\n\nTypical use-cases:\n- Train/test or regime-annotation previews where zooming would hide the\n  segment boundaries.\n- Thumbnail / card charts that should never respond to accidental scrolls.\n- Dashboard tiles embedded inside a scrollable page (prevents the chart from\n  swallowing scroll events).\n\nY-axis drag and double-click reset are also disabled when `interactive` is\n`false`.\n\n---\n\n## Core API (imperative)\n\nAll of the above options are also available on the `ChartOptions` object\npassed to the `Chart` constructor.\n\n```ts\nimport { Chart, createBuffer } from '@finterion/charts-core';\n\nconst chart = new Chart(container, {\n  initialFit: 'all',\n  interactive: false,\n  panels: [...],\n});\nchart.setData(createBuffer(bars));\n\n// Navigate programmatically at any time:\nchart.setViewport({ startIdx: 50, endIdx: 250 });\n```\n