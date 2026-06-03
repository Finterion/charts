# Finterion Charts

A small, fast, embeddable charting library for financial and quantitative
visualisations. Canvas 2D rendering, typed-array buffers, layered redraw — built
to stay smooth at 100k+ bars.

It ships in three layers, each usable on its own:

| Package | What you get |
| --- | --- |
| [`@finterion/charts-core`](packages/core) | Framework-agnostic Canvas engine. Multi-panel, pan/zoom, indicators, markers, six panel kinds. |
| [`@finterion/charts-react`](packages/react) | `<Chart>` and `<ChartFromSpec>` React bindings. |
| [`@finterion/charts-spec`](packages/spec) | JSON-only `ChartSpec` schema + validator + compiler. Designed for LLM tool-calling and forum embeds. |

Plus two apps:

| App | What it does |
| --- | --- |
| [`apps/playground`](apps/playground) | Vite playground with a SuperTrend live-coding demo and a portfolio tearsheet. `pnpm dev`. |
| [`apps/embed`](apps/embed) | Static iframe page that renders any `ChartSpec` from `?src=`, `#spec=` or `postMessage`. |

---

## Quick start

### Imperative React chart

```tsx
import { Chart } from '@finterion/charts-react';

<Chart
  data={ohlc}
  panels={[{ id: 'price', kind: 'price', weight: 1, type: 'candles' }]}
  theme="finterion-dark"
  background="#131722"
  gridColor="#494d57"
/>
```

### From a JSON spec (LLM-friendly)

```tsx
import { ChartFromSpec } from '@finterion/charts-react';

<ChartFromSpec spec={{
  version: 1,
  data: { bars: { time, open, high, low, close } },
  display: { theme: 'finterion-dark', background: '#131722', gridColor: '#494d57' },
  panels: [
    { id: 'price', kind: 'price', weight: 4, type: 'candles', title: 'AAPL' },
    {
      id: 'rsi', kind: 'indicator', weight: 1, title: 'RSI 14',
      indicator: {
        values: rsiArray, kind: 'line', color: '#a3ff12',
        refLines: [30, 70], yRange: [0, 100],
      },
    },
  ],
}} />
```

### Forum / iframe embed

```ts
import { encodeSpec } from '@finterion/charts-spec';

const url = `https://charts.finterion.com/embed/#spec=${encodeSpec(spec)}`;
// <iframe src={url} width="640" height="320" loading="lazy" />
```

---

## Repository layout

```
packages/
  core/        canvas engine, panels, renderers, themes
  react/       <Chart>, <ChartFromSpec>
  spec/        ChartSpec types, validator, compiler, JSON Schema, base64 codec
apps/
  playground/  Vite demo (SuperTrend, portfolio tearsheet)
  embed/       Static iframe renderer
docs/
  overview.md, panels.md, spec.md, llm-prompt.md, embedding.md
scripts/
  generate_supertrend.py   sample data generator
```

---

## Development

```bash
pnpm install
pnpm dev              # playground at http://localhost:5173
pnpm build            # build all packages via turbo
```

Per-package:

```bash
pnpm --filter @finterion/charts-core build
pnpm --filter @finterion/charts-react build
pnpm --filter @finterion/charts-spec build
pnpm --filter @finterion/charts-embed-app dev    # iframe app at :5174
```

Typecheck without emit:

```bash
cd apps/playground && pnpm exec tsc --noEmit
```

---

## Documentation

- **[Overview](docs/overview.md)** — architecture, performance model, when to use what.
- **[Panel kinds](docs/panels.md)** — `price`, `indicator`, `heatmap`, `hbar`, `histogram`, `scatter`.
- **[ChartSpec](docs/spec.md)** — the JSON schema, format directives, column references.
- **[LLM prompt template](docs/llm-prompt.md)** — system prompt + worked examples for agents.
- **[Embedding](docs/embedding.md)** — iframe, postMessage, base64 share links, markdown shortcodes.

---

## Design principles

1. **Canvas-only.** SVG falls over past a few thousand nodes; Canvas handles hundreds of thousands.
2. **Typed arrays.** OHLC stored columnar in `Float32Array` / `Float64Array`. Cache-friendly, ~4× lower memory than object arrays.
3. **Layered canvases.** Per panel: base (grid), series (data), overlay (crosshair/tooltip). Hover only repaints the overlay.
4. **Viewport culling.** Iterate only visible bars; pan/zoom is O(viewport), not O(history).
5. **Two surfaces.** A typed imperative API (`@finterion/charts-core`) and a JSON declarative API (`@finterion/charts-spec`). The JSON form is what LLMs and forum embeds use; it compiles to the typed form.
6. **Tree-shakeable.** `sideEffects: false`, ESM-first.
