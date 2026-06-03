# ChartSpec — the JSON API

`ChartSpec` is a plain JSON object that fully describes a chart. It is the
recommended interface for anything that crosses a process or trust boundary:
LLM agents, REST APIs, forum embeds, persisted chart definitions.

The spec is round-trippable through `JSON.stringify` / `JSON.parse`. It has no
functions, no typed arrays, no DOM references.

---

## Top-level shape

```ts
interface ChartSpec {
  version: 1;
  data?: {
    bars?:    { time: number[]; open: number[]; high: number[]; low: number[]; close: number[]; volume?: number[] };
    columns?: Record<string, number[]>;
    markers?: TradeMarker[];
  };
  display?: {
    theme?:         'finterion-dark' | 'finterion-light';
    background?:    string;
    gridColor?:     string;
    gridStyle?:     'none' | 'horizontal' | 'full';
    panelGap?:      number;
    titleColor?:    string;
    titleFontSize?: number;
    titleSpace?:    number;
    showTimeAxis?:  boolean;
  };
  panels: PanelSpec[];   // see panels.md for each kind
}
```

`version` is always `1`. Future breaking changes will bump it; minor
additions are non-breaking.

## Column references

Indicator panels often reuse the same numeric series (e.g. an RSI feeding both
a line panel and a refLines summary). Repeating long arrays inflates payloads
and confuses LLMs. Reference them by name instead:

```json
{
  "data": {
    "columns": { "rsi14": [50.0, 53.4, 49.1, …] }
  },
  "panels": [
    { "id": "rsi", "kind": "indicator", "weight": 1,
      "indicator": { "values": { "column": "rsi14" }, "kind": "line", "color": "#a3ff12" } }
  ]
}
```

`values` and `lowerValues` accept either a literal `number[]` or a
`{ "column": "<name>" }` reference. The compiler resolves references against
`data.columns` and converts to `Float32Array`.

## Format directives

Where the imperative API takes a `(v: number) => string` formatter, the JSON
API takes a string directive. Resolved by the built-in `FORMATTERS` registry:

| Directive | Output |
| --- | --- |
| `pct0` | `12%` |
| `pct1` | `12.3%` |
| `pct2` | `12.34%` |
| `fixed0` | `12` |
| `fixed1` | `12.3` |
| `fixed2` | `12.34` |
| `short-num` | `1.2k`, `3.4M`, `5.6B` |
| `iso-date` | `2024-05-01` (input: ms or s timestamp) |

## Validation

```ts
import { validateSpec, compileSpec } from '@finterion/charts-spec';

const v = validateSpec(spec);
if (!v.ok) throw new Error(v.errors.join('\n'));

const { data, panels, options, markers } = compileSpec(spec);
```

For schema-driven validation (e.g. inside an LLM tool definition):

```ts
import { CHART_SPEC_SCHEMA } from '@finterion/charts-spec';
// pass to ajv, @cfworker/json-schema, OpenAI/Anthropic structured-output, etc.
```

## Capability discovery

```ts
import { getChartCapabilities } from '@finterion/charts-spec';

const caps = getChartCapabilities();
// {
//   version: 1,
//   panelKinds: ['price', 'indicator', 'heatmap', 'hbar', 'histogram', 'scatter'],
//   indicatorKinds: ['line', 'histogram', 'area', 'band'],
//   seriesTypes: ['candles', 'line', 'area'],
//   formatDirectives: ['pct0', 'pct1', …],
//   themes: ['finterion-dark', 'finterion-light'],
//   gridStyles: ['none', 'horizontal', 'full'],
// }
```

Inject this into the system prompt of an LLM so it never invents a kind or
formatter that doesn't exist.

## Worked example

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
    "columns": { "rsi14": [50.0, 53.4, 49.1] }
  },
  "display": {
    "theme": "finterion-dark",
    "background": "#131722",
    "gridColor": "#494d57"
  },
  "panels": [
    { "id": "price", "kind": "price", "weight": 4, "type": "candles", "title": "AAPL" },
    {
      "id": "rsi", "kind": "indicator", "weight": 1, "title": "RSI 14",
      "indicator": {
        "values": { "column": "rsi14" }, "kind": "line", "color": "#a3ff12",
        "refLines": [30, 70], "yRange": [0, 100]
      }
    }
  ]
}
```

Render it:

```tsx
import { ChartFromSpec } from '@finterion/charts-react';
<ChartFromSpec spec={spec} />
```

See also: [LLM prompt template](llm-prompt.md), [Embedding](embedding.md).
