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

## Panel-targeted markers

Markers may target a price or indicator panel using `panelId`:

```json
{
  "time": 1717200000000,
  "side": "buy",
  "price": -2.0,
  "panelId": "z_score",
  "shape": "circle"
}
```

`price` is the vertical coordinate in the target panel's units; `time` uses
the bars' time units. `shape` is `"arrow"` (default) or `"circle"`. Circles
are centered on the coordinate. `side` selects up/down styling and does not
necessarily indicate a trade. Omit `panelId` to retain legacy price-panel
markers. Target IDs must name an existing price or indicator panel.

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

## Decision annotations and inspector

Moving the crosshair shows each indicator panel's visible series values beside
its title at the shared hovered timestamp. Readouts use the series colors and
labels, show four decimal places, and display `n/a` for missing/warmup values.
With one visible readout series and an inline panel title, only the number is
shown beside the title. Multiple readout series retain their labels.
Hidden series are omitted; readouts clear when the pointer leaves the plot.
There is no floating OHLC/date tooltip over the plot. Crosshair lines, indicator
title readouts and the decision inspector remain available.
Set a series' `showHoverValue: false` (Python `show_hover_value=False`) to
exclude threshold/reference lines from these readouts without hiding their
lines or legend controls. Actual indicator series remain included by default.

The main panel legend has independent **Long entries**, **Long exits**,
**Short entries**, **Short exits**, and **Undecided** visibility rows alongside
the price and indicator series. Each uses the same colored swatch, text label,
and eye / crossed-out-eye control as the series legend, on the right in the
default overlay layout.
Filters apply to dots on all panels, magnetic hover/click targets, and inspector
choices; they do not hide price/indicator series. Long scale-in points share
the long-entry toggle. All types are initially visible.

Left-toolbar buttons show descriptive tooltips on pointer hover or keyboard focus,
including the control that restores a hidden toolbar.

Line indicators may supply `sampleMask` (an inline array or column reference),
with one 0 or 1 per value. Zero skips an unobserved timestamp introduced by
aligning differently sampled series. One retains the recorded value, including
`null` as a genuine line break. Values and hover readouts are never filled or
interpolated. The Python builder calls this `sample_mask`.

**X axis placement** opens a modal popover with a choice of **Bottom of chart**
or any time-based panel. **Apply** moves the existing interactive axis below
that panel; **Cancel**, Escape, or clicking outside dismisses without changes.
The dialog traps focus and returns it to its button when closed. The selected
panel is retained by ID across panel updates; removal returns the axis to bottom.
Drag it to change the shared X scale or double-click to reset, without
scrolling to the last panel.

While hovering the chart (including legends and axes), hold Ctrl and scroll to
zoom the shared time scale around the pointer. On scrollable charts, unmodified
wheel events continue to scroll the panels. Cmd+scroll is also supported.
The branding badge stays at the bottom of the visible chart scroll region rather
than scrolling away with the last panel.

Panel specs accept optional `collapsible: true | false`. Set it to `true` to
enable the pane-collapse eye even on the first panel (for example portfolio
equity above a price chart), or `false` to keep a particular panel expanded.
When omitted, the first panel remains fixed and subsequent panels are collapsible.
The Python equivalent is `Indicator.panel(..., collapsible=True)`.

Every collapsible panel has a pane-collapse eye next to its title,
including multi-series indicators and panels with reference overlays. Collapsing
leaves a compact header and an expand control, without Y-axis labels or grid;
individual series visibility is
preserved. The control is available with overlay or external legends, and remains
available when series legends are disabled. The first/main panel cannot collapse.

### Chart canvas

The embed app also accepts a canvas payload in the injected spec, URL/hash,
fetch, and `finterion:spec` message paths:

```ts
const canvas: ChartCanvasSpec = {
  version: 1,
  kind: 'canvas',
  title: 'Strategy exploration',
  charts: { BTC: btcSpec, ETH: ethSpec },
  layout: 'single',
  columns: 2,
  chartHeight: 720,
  selector: { type: 'tabs', label: 'Symbol' },
  selected: ['BTC', 'ETH'],
  layoutToggle: true,
};
```

Import `ChartCanvasSpec` and `validateCanvasSpec` from `@finterion/charts-spec`.
React hosts render `<ChartCanvas spec={canvas} />` from
`@finterion/charts-react`. Canvas validation checks every nested chart with the
existing chart validator. Ordinary `ChartSpec` rendering remains unchanged.
Selector types are `dropdown`, `tabs`, `multiselect`, or `checkboxes`; single
layout selects one chart and grid layout permits independent selections.
Grid defaults to two columns and 720px per chart, stacking below 900px viewport
width. Single layout fills the available height. Selection defaults to all IDs,
with the first active in single mode. Charts stay mounted when hidden so local
chart state survives layout/selection changes. State is independent, not
synchronized across charts. Replacing the canvas chart IDs, initial selection,
or initial layout resets the canvas selection state.

The inspector starts with the UTC timestamp and timestamp-local card selectors.
It then shows `card.status` and optional nullable `card.reason`, followed by the
recorded total, maximum, segmented group bars, and achieved/available group points.
`card.strength` is the actual signal strength in [0, 1]; score divided by maximum
is labelled **score utilization**, never strength or a win probability.
Optional `card.position` describes recorded pre-signal context and
`card.qualification` explains the saved qualification policy. Missing attributes
are explicitly unavailable; null `reason` means no blocking reason was recorded.
Each scoring group
can supply `score` and `maximumScore` for a labelled achieved/available points bar.
Maxima must account for aggregation (for example, `max` does not sum all rule
weights). Requirements and vetoes are not scoring groups. Missing maxima display
as not recorded, never as invented totals. Zero maxima produce an empty bar;
negative scores remain visible numerically with an empty positive-points bar.

Below the score, evidence is presented in numbered sections, with weighted groups
first. Rule rows show a status icon with an accessible label, the rule name,
description, recorded value/timeframe and awarded points in accessible tables.
`rule.weight` is the signed configured contribution and `rule.required` marks an
explicit requirement. Group `minimumScore`, `minimumMatches`, and `aggregation`
show saved thresholds and aggregation, including override-aware policies. Optional
`rule.maximumPoints` adds an individual `/ N PTS` denominator (the configured rule
weight in that group, before aggregation). A matched rule can still earn zero
points under `max` aggregation. Missing rule capacities are omitted, not inferred
from awarded points. Group totals appear in each weighted section's footer.
Recorded group counters and thresholds remain available in collapsed details.
Non-scoring qualification and raw evidence remain in collapsible sections.
These are raw weighted points, not predictive probabilities.

`data.decisions` is an optional array of JSON-only evaluations, separate from
trade markers. Every annotation requires a unique `id`, numeric `time`, a
price/indicator `panelId`, numeric `value` (the panel's Y coordinate), `action`
(`entry`, `exit`, or `none`), and a `card`. `direction` may be `long` or `short`.
Unix epoch seconds and milliseconds are accepted for decision/bar matching.

```json
{
  "id": "evaluation-42",
  "time": 1717200000000,
  "panelId": "rsi",
  "value": 29.5,
  "action": "entry",
  "direction": "long",
  "card": {
    "title": "Entry evaluation",
    "status": "rejected",
    "summary": "Signal matched, score below minimum.",
    "score": 7,
    "minimumScore": 12,
    "groups": [{
      "id": "signal",
      "title": "Signal evidence",
      "rules": [{
        "id": "rsi-low",
        "label": "RSI below 30",
        "matched": true,
        "value": 29.5,
        "points": 7,
        "timeframe": "1h",
        "description": "Raw RSI at evaluation time"
      }]
    }]
  }
}
```

Cards require `title`, extensible string `status`, and `groups` (which may be
empty). `summary`, `score`, and `minimumScore` are optional. Optional
`reasonDescription` displays a readable explanation prominently beneath the
status; `reason` retains the raw machine code below it. Both are plain text.
Groups require
`id`, `title`, and `rules`, with an optional boolean/null `matched` recording
the group's actual outcome. Group results are never inferred from individual
rules (groups may use OR, thresholds, or veto logic). Rules require `id` and `label`. Optional rule fields:
`matched` (boolean/null), scalar/null `value`, `description`, `points`, and
`timeframe`. Missing `matched` means neutral recorded evidence; explicit
`matched: null` means not evaluated. This applies independently to groups and
rules; groups without an explicit outcome show Recorded. Scores and thresholds
are displayed in raw units, never normalized to 100. No HTML or callbacks are
interpreted.

When nonempty, decisions add an independently scrollable inspector on the
far right, beside the entire chart/legend column, without overlaying the plot.
Its default width is 280-420px. Drag its left edge to resize it between 220px
and 800px, capped at 65% of the chart frame so the plot remains visible.
Focus the divider and use Left/Right (Shift for larger steps), Home or End
to resize with the keyboard; double-click it to restore the default width.
The header button collapses the inspector to a slim rail and restores it
without losing its width, selected card or pin state. Layout preferences
last for the lifetime of that chart, including decision-data updates.
On viewports at or below 640px, the inspector stacks below the chart with its
own scrollbar; resizing is disabled and collapsing leaves a compact header.
Set `display.chartMinHeight` (core/React: `chartMinHeight`) to the desired
minimum height of the chart stack in pixels. When this exceeds the outer
container height, the chart column scrolls independently while the inspector
keeps the container height and its own scrollbar. Ordinary wheel gestures scroll
the overflowing chart column; hold Ctrl or Command while wheeling to zoom.
Omitting this option preserves the existing fit-to-container layout and wheel zoom.
Dots distinguish direction: long entries are green (`#22c55e`), short entries
lime (`#a3e635`), long exits red (`#ef4444`), and short exits orange-red
(`#fb923c`). Missing direction retains the long/default palette. Card selector
accents and hover rings use the same colors. None stays white, except
`card.status: "not_triggered"` uses grey (`#94a3b8`) for position-inapplicable
evaluations, selectors and hover rings. Rejected entries (including scale-ins)
are amber-orange (`#f59e0b`) in dots, selectors, badges and hover rings.
Otherwise statuses do not change action colors; rejected exits remain red/orange.
The inspector labels
`not_triggered` as "Not triggered" and an absent score as "Not evaluated".
Existing trade markers are unaffected.
Neutral dots have a 3px radius and 22% opacity, without outlines. Coincident
neutral dots at the same panel/value are drawn once so they do not accumulate
opacity; every underlying card remains available. Grey not-triggered dots are
opaque and take precedence over coincident white neutral dots; active entries
and exits still take precedence over them. Active dots retain a 4px radius.

Hover snaps to the nearest bar and lists every evaluation mapped to that bar.
Within 12px of a visible decision dot, both crosshair coordinates snap to that
dot, a ring highlights it, and the cursor becomes a hand pointer. Clicking a dot
pins that card and keeps its highlight ring visible after the pointer moves away
or leaves the chart. Clicking a different dot moves the selection to that point.
Panning starts outside these dot targets, so a small click movement does not
accidentally pan the chart. Leaving the dot restores normal crosshair behavior.
Outside the magnetic targets, bars without evaluations show an empty-state
message, not a stale nearby card.
Coincident evaluations have a timestamp-local card count and individual
selection buttons in a compact two-column grid. Set optional annotation `label`
for a short selector name such as `Long entry`; otherwise the title/action/status
is used. The selected card type is preserved when resuming hover at another
timestamp where the same label is present. There is no timestamp dropdown;
hover a chart timestamp to inspect its evaluations. Click the plot to
select a dot (pan drags do not select). Click empty plot space to clear the
selection and resume hover. Clicking the selected dot again keeps it selected;
empty-space clicks never pin a card.
Selecting an evaluation pins it; moving into the inspector preserves it.

Core callers use `ChartOptions.decisions` / `chart.setDecisions(decisions)`;
React uses `<Chart decisions={decisions} ... />`; `ChartFromSpec` and embed
transports automatically consume `data.decisions`. Pass `[]` to remove the
inspector. Rebuild the embed bundle after renderer changes.

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
