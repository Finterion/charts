# Overview

Finterion Charts has three concentric APIs. Pick the smallest one that fits.

## 1. Imperative core — `@finterion/charts-core`

The engine. Frame-perfect, zero React dependency. You hand it an HTML element
and a `ChartOptions` object; it owns everything inside.

```ts
import { Chart, createBuffer } from '@finterion/charts-core';

const chart = new Chart(container, {
  theme: 'finterion-dark',
  panels: [{ id: 'price', kind: 'price', weight: 1, type: 'candles' }],
});
chart.setData(createBuffer(bars));
// later:
chart.setPanels([...]);   chart.setMarkers([...]);   chart.destroy();
```

Use this when you want full control, when you're embedding the chart in a
non-React framework (Svelte, Solid, vanilla), or when you're feeding a live
tick stream and want to call `appendBar` directly on the buffer.

## 2. React bindings — `@finterion/charts-react`

Two components:

- `<Chart>` — typed React props matching `ChartOptions` 1:1. Use this when your
  data is already typed-array shaped or comes from a hook.
- `<ChartFromSpec>` — takes a JSON `ChartSpec`. Use this when the spec is
  produced by an agent, fetched from an API, or stored in a database.

Both share the same renderer; `<ChartFromSpec>` is a thin compile-and-mount
wrapper around `<Chart>`.

## 3. JSON spec — `@finterion/charts-spec`

The data contract. A `ChartSpec` is a plain object — no functions, no typed
arrays — that fully describes a chart. The package ships:

- `validateSpec(spec)` — runtime validator (no deps, no schema lib needed).
- `compileSpec(spec)` — turns a spec into engine-ready `{ data, panels, options, markers }`.
- `CHART_SPEC_SCHEMA` — JSON Schema (Draft 2020-12). Use it as the OpenAI /
  Anthropic / Gemini structured-output schema for tool calling.
- `getChartCapabilities()` — machine-readable list of supported panel kinds,
  formatters, themes. Inject into agent prompts so models never invent
  unsupported values.
- `encodeSpec` / `decodeSpec` — base64url round-trip for URL fragments.
- `FORMATTERS` — string-directive registry (`'pct1'`, `'iso-date'`, …).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      ChartSpec (JSON)                   │  ← what LLMs / forums emit
└────────────────┬───────────────────┬────────────────────┘
                 │ validateSpec      │ encodeSpec
                 ▼                   ▼
┌─────────────────────────┐   ┌───────────────────────────┐
│ compileSpec → engine    │   │ #spec=… (URL hash)        │
│   { data, panels,       │   │  → apps/embed iframe      │
│     options, markers }  │   └───────────────────────────┘
└─────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│         @finterion/charts-core  (Canvas engine)         │
│   panels  ┐                                             │
│           ├── base layer    (grid, axes, title)         │
│           ├── series layer  (candles, line, indicator,  │
│           │                  heatmap, hbar, histogram,  │
│           │                  scatter)                   │
│           └── overlay layer (crosshair, markers, tooltip)│
└─────────────────────────────────────────────────────────┘
```

## Performance model

- **Single RAF**. All redraws are coalesced into one `requestAnimationFrame`
  per chart per frame. Calling `setPanels` ten times in a tick costs one paint.
- **Dirty layers**. Each panel has three independent canvases. Hover only
  invalidates the overlay layer; pan/zoom invalidates series + overlay; theme
  changes invalidate everything.
- **DPR-aware**. Canvases are sized at `cssPx * devicePixelRatio` and scaled,
  so charts stay crisp on Retina without paying a 4× cost on regular monitors.
- **ResizeObserver**. Container resize debounces into one re-layout.
- **Typed-array buffers**. OHLC is stored as parallel `Float64Array` (time) +
  `Float32Array` (OHLCV). `appendBar(buf, bar)` is O(1) amortised.

## When to use which surface

| Use case | API |
| --- | --- |
| React app, static data | `<Chart>` |
| React app, agent-produced JSON | `<ChartFromSpec>` |
| Live tick stream, custom indicator pipeline | `Chart` (core) + `appendBar` |
| LLM tool-calling output | `ChartSpec` JSON, `CHART_SPEC_SCHEMA` |
| Forum / blog embed | `apps/embed` + `encodeSpec` |
| Server-side image rendering (future) | `compileSpec` + a `node-canvas` host |
