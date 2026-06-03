# Finterion Charts — LLM Prompt Template

This document is the recommended **system / tool prompt** for an LLM agent that
needs to produce charts in a Finterion-powered analysis sandbox.

The agent emits a JSON `ChartSpec` (version 1). The host validates it with
`validateSpec` and renders it with `<ChartFromSpec>` (or `compileSpec` + the
imperative engine). No JavaScript callbacks ever leave the agent — only data.

---

## System prompt fragment (paste into your agent)

> You can render charts by emitting a single JSON object that conforms to the
> Finterion **ChartSpec v1** schema. The host will parse, validate, and render it.
>
> Rules:
> 1. Always set `"version": 1`.
> 2. `panels` is required and must be a non-empty array. Each panel has a
>    unique `id`, a `kind`, and a `weight` (positive number).
> 3. If any panel has `kind: "price"` or `"indicator"`, `data.bars` is
>    **required** (with `time`, `open`, `high`, `low`, `close` arrays of equal
>    length).
> 4. For `indicator` panels, prefer `{ "values": { "column": "<colName>" } }`
>    over inlining huge arrays — and put the array under `data.columns.<colName>`.
> 5. Number formatting uses string directives: one of
>    `pct0`, `pct1`, `pct2`, `fixed0`, `fixed1`, `fixed2`, `short-num`, `iso-date`.
>    Never emit a JS function.
> 6. Colors are CSS color strings (`#rrggbb`, `rgba(...)`, named).
> 7. Panel kinds: `price`, `indicator`, `heatmap`, `hbar`, `histogram`, `scatter`.
>    The first two are time-indexed; the rest are self-contained.
>
> Always output a single fenced ` ```json ` block. Do not wrap in extra prose
> when used as a tool output.

---

## Capability descriptor

Call `getChartCapabilities()` from `@finterion/charts-spec` to obtain the
machine-readable list of supported kinds, formatters, themes, and grid styles.
Inject it into the agent's system prompt so the model never invents an unsupported
value.

```ts
import { getChartCapabilities } from '@finterion/charts-spec';

const caps = getChartCapabilities();
// → { version: 1, panelKinds: [...], indicatorKinds: [...], formatDirectives: [...], ... }
```

---

## Minimal example — RSI on price

```json
{
  "version": 1,
  "data": {
    "bars": {
      "time":  [1717200000, 1717286400, 1717372800],
      "open":  [100.0, 101.2, 102.5],
      "high":  [101.5, 103.1, 103.0],
      "low":   [ 99.8, 101.0, 101.4],
      "close": [101.2, 102.5, 102.1]
    },
    "columns": {
      "rsi14": [50.0, 53.4, 49.1]
    }
  },
  "display": {
    "theme": "finterion-dark",
    "background": "#131722",
    "gridColor": "#494d57",
    "gridStyle": "horizontal"
  },
  "panels": [
    {
      "id": "price",
      "kind": "price",
      "weight": 4,
      "type": "candles",
      "title": "AAPL"
    },
    {
      "id": "rsi",
      "kind": "indicator",
      "weight": 1,
      "title": "RSI 14",
      "indicator": {
        "values": { "column": "rsi14" },
        "kind": "line",
        "color": "#a3ff12",
        "refLines": [30, 70],
        "yRange": [0, 100]
      }
    }
  ]
}
```

---

## Non-time panels — monthly returns heatmap

```json
{
  "version": 1,
  "panels": [
    {
      "id": "monthly",
      "kind": "heatmap",
      "weight": 1,
      "title": "Monthly Returns",
      "rows": ["2024", "2023", "2022"],
      "cols": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      "values": [
        [0.012, -0.005, 0.031, 0.018, -0.022, 0.005, 0.014, 0.021, -0.011, 0.004, 0.008, 0.012],
        [0.022,  0.011, 0.018, -0.004, 0.015, -0.012, 0.025, 0.030, 0.008, -0.018, 0.012, 0.020],
        [-0.014, 0.022,-0.008, 0.011, 0.005, -0.020, 0.008, 0.012, -0.010, 0.018, 0.006, 0.001]
      ],
      "format": "pct1"
    }
  ]
}
```

---

## Host-side rendering

```tsx
import { ChartFromSpec } from '@finterion/charts-react';

function AgentMessage({ spec }: { spec: unknown }) {
  return (
    <div style={{ width: '100%', height: 480 }}>
      <ChartFromSpec spec={spec as any} />
    </div>
  );
}
```

Or imperative:

```ts
import { Chart } from '@finterion/charts-core';
import { compileSpec } from '@finterion/charts-spec';

const { data, panels, options, markers } = compileSpec(spec);
const chart = new Chart(container, { ...options, panels, markers });
if (data) chart.setData(createBuffer(data));
```

---

## Forum / iframe embedding

```ts
import { encodeSpec } from '@finterion/charts-spec';

const url = `https://charts.finterion.com/embed#spec=${encodeSpec(spec)}`;
// <iframe src={url} width="640" height="320" loading="lazy" />
```

For markdown-aware forums, ship a small loader script that scans
` ```finterion-chart ` fenced blocks, parses the JSON, and replaces them with
`<ChartFromSpec>` instances at runtime.
