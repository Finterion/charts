# finterion-charts (Python)

Python binding for [Finterion Charts](https://github.com/Finterion/charts).

This package does **not render** anything. It builds, validates, and encodes
`ChartSpec` JSON — the same JSON contract consumed by `@finterion/charts-spec`.
Rendering is done in the browser by `@finterion/charts-core`, so charts produced
from Python are pixel-identical to charts produced from TypeScript.

Interactive notebook charts support **Shift + drag** to box-zoom a time/price
region with a dashed selection box (Escape cancels) and **scrolling over a panel's Y-axis labels** to zoom
only that vertical scale. Normal dragging still pans; double-clicking the
Y-axis resets its scale. These controls are included in the offline embed
bundle and require no extra Python configuration.

## Install

From PyPI (once published):

```bash
pip install finterion-charts          # core: builder + cheap validator + codec
pip install "finterion-charts[schema]"   # add jsonschema-based strict validation
pip install "finterion-charts[pandas]"   # add pandas/numpy ergonomic builders
pip install "finterion-charts[jupyter]"  # add IPython iframe display helper
pip install "finterion-charts[all]"
```

From this monorepo (editable):

```bash
cd bindings/python
pip install -e ".[all,dev]"
```

## Quickstart

```python
from finterion_charts import ChartSpec, Indicator, Price, Marker

spec = (
    ChartSpec(theme="finterion-dark", background="#131722", grid="horizontal")
    .with_bars(time=time, open=o, high=h, low=l, close=c, volume=v)
    .with_column("rsi14", rsi)
    .add_panel(Price(id="price", weight=3, title="AAPL", type="candles"))
    .add_panel(Indicator.panel(
        id="rsi", weight=1, title="RSI 14",
        values="rsi14", color="#a3ff12",
        ref_lines=[30, 70], y_range=(0, 100),
    ))
    .add_marker(Marker(time=ts, side="buy",  price=lo, label="B"))
    .add_marker(Marker(time=ts, side="sell", price=hi, label="S"))
)

spec.validate()                   # raises ValueError on invalid spec
spec.to_json("chart.json")
url = spec.embed_url()            # https://charts.finterion.com/embed/#spec=…
```

See [`examples/aapl_supertrend.py`](examples/aapl_supertrend.py) for an end-to-end
example with OHLC, RSI, SuperTrend overlay, and buy/sell markers.

### Markers on indicator curves

Target a price or indicator panel with `panel_id`. For indicator panels,
`price` is the indicator's vertical value, not the instrument price:

```python
spec.add_marker(Marker(
    time=timestamp_ms, side="buy", price=30.0,
    panel_id="rsi", shape="circle",
))
display(spec.display_in_jupyter())
```

Circles are centered on the supplied coordinate. `side` controls green/up
versus red/down styling; it need not represent an executed trade.
Without `panel_id`, existing markers still appear only on price panels.
Without `shape`, the existing arrow style is preserved. The offline bundle
must be rebuilt after renderer changes with
`pnpm --filter @finterion/charts-embed-app... build` at the repository root.

### Decision cards

The main panel's right-hand legend lets you toggle long/short entries and exits
independently, plus undecided dots, using labeled eye icons alongside the series
controls. Filters also update hover targets and inspector choices.
Hover or focus a left-toolbar button for a description. **X axis placement**
opens a modal popover to choose a time-based panel or the bottom of the chart;
Apply confirms, while Cancel, Escape or an outside click leaves it unchanged.
The decision inspector starts with card
selectors for the hovered/pinned UTC timestamp, the actual signal outcome and
blocking reason, and the large actual-score readout with group capacity bars.
Optional `card.reason` (nullable), `strength`, `position`, and `qualification`
carry recorded signal and pre-signal context.
`card.reasonDescription` provides a readable explanation above the raw reason
code, without replacing that code or calculating trade eligibility.
Signal strength is distinct from
**score utilization** (score / maximum); neither is a win probability.
Group `minimumScore`, `minimumMatches`, and `aggregation`, plus rule `weight`
and `required`, drive the condition/weight/earned tables. Supply
`card.maximumScore` and each scoring group's `score`/`maximumScore`; missing
maxima are explicitly shown as not recorded, not inferred from earned points.
It does not invent `/100` normalization.

### Multi-chart canvas

Use one canvas instead of displaying separate chart iframes:

```python
from finterion_charts import ChartCanvas

canvas = ChartCanvas(
    title="Strategy exploration",
    charts={"BTC/EUR": btc_chart, "ETH/EUR": eth_chart},
    layout="single",
    columns=2,
    chart_height=720,
    selector={"type": "tabs", "label": "Symbol"},
)
display(canvas.display_in_jupyter(height=800))
```

`charts` maps stable, non-empty IDs (also used as labels) to `ChartSpec` objects
or chart-spec dictionaries. `layout="single"` shows one active chart; `"grid"`
shows selected charts with up to `columns` columns, stacking on narrow screens.
The Single/Grid buttons switch layouts interactively; set `layout_toggle=False`
to hide them. Each grid chart uses `chart_height` pixels; single mode fills the
available canvas height. `selected=["BTC/EUR"]` sets the initial selection;
by default all charts are selected for grid mode and the first is active in
single mode. An empty grid selection shows a prompt.

Selector types are `"dropdown"`, `"tabs"`, `"multiselect"` and `"checkboxes"`.
Dropdowns become native multi-select lists in grid mode; tabs become independent
toggle buttons; checkboxes become radio buttons in single mode. Charts stay
mounted when hidden, preserving their independent zoom, collapsed panels,
line visibility and pinned decisions. The canvas uses one offline iframe;
URL display mode works with an updated hosted embed app as well.

Hold Ctrl (or Cmd) while scrolling over the chart, its legends, or axes to zoom
the time scale at the pointer. Ordinary scrolling still scrolls tall charts.
The Powered by Finterion badge stays at the bottom of the visible chart area
while scrolling through panels.

Evidence below the score is split into numbered visual sections. Weighted rules
show status icons, references/timeframes, awarded points and optional
`maximumPoints` denominators; requirements and other evidence remain separate.
Group counters and thresholds are available in expandable recorded details.

Use `ChartSpec.add_decision(dict)` to append JSON-only evaluations (returns
`self`). These are independent of trade markers:

```python
spec.add_decision({
    "id": "entry-evaluation-42",
    "time": timestamp_ms,        # Unix seconds also accepted
    "panelId": "rsi",
    "value": 29.5,               # panel Y coordinate, not instrument price
    "action": "entry",           # rejected entries are orange
    "direction": "long",         # optional
    "card": {
        "title": "Entry evaluation",
        "status": "rejected",    # extensible outcome string
        "reasonDescription": "Entry blocked: the recorded minimum score was not met.",
        "summary": "Below the minimum score.",
        "score": 7, "minimumScore": 12,  # optional, raw units
        "groups": [{
            "id": "signal", "title": "Signal evidence",
            "rules": [{
                "id": "rsi-low", "label": "RSI below 30",
                "matched": True, "value": 29.5, "points": 7,
                "timeframe": "1h", "description": "Raw RSI",
            }],
        }],
    },
}).validate()
```

Nonempty decisions show a full-height, independently scrollable inspector
to the right of the chart and legend. Hover a bar to inspect its evaluations;
on narrow viewports it stacks below the chart.
Optional `signalType` values `scale_in` and `scale_out` render + and - symbols;
`stop_loss` and `take_profit` render SL/TP badges. Add `eventType: "trigger"`
for a hollow badge or `"fill"` for a solid badge. Triggers and fills have
separate legend filters, and simultaneous events remain individually selectable.
These events do not require confluence scores. Existing decision circles are
unchanged. `Marker(..., shape="plus")` and `shape="minus"` are also supported.

Drag its left edge to make it narrower or wider (220-800px, capped at 65% of the
chart width), or focus that divider and use Left/Right, Home or End.
Double-click the divider to reset its default 280-420px width. The header button
collapses and expands it, preserving its width and pinned card for that chart.
On narrow viewports, the collapsed inspector becomes a compact header.
coincident evaluations have a card count and compact selection buttons. Set
optional `label` on each annotation for a short card name such as `Long entry`.
Selecting a card type is preserved when resuming hover at later timestamps.
Neutral dots are smaller and faint; coincident neutral dots are drawn once
without discarding any cards. Timestamp-local card selectors are keyboard
accessible; timestamps are chosen by hovering the chart, not a dropdown.
Position-inapplicable exits use `card.status="not_triggered"` and grey dots,
selector accents and hover rings. The inspector shows "Not triggered" and,
when no score exists, "Not evaluated"; genuine pipeline rejections are unchanged.
Click a dot (not a drag) to pin its card and persistent highlight. Moving the
pointer away does not clear the selection; clicking another dot moves it.
Click empty plot space to clear the selection and follow hover again.
Clicking the selected dot again keeps it selected. Empty bars do not retain stale
cards. No decisions means no inspector. Hover within 12px of a decision dot to
snap the crosshair onto it and show a highlight ring and hand pointer. Click to
pin; click a different dot to switch the pinned timestamp. Chart panning starts
outside these magnetic targets.

For independently scrolling chart and decision columns, set
`spec.display.chart_min_height = 1600` and render with
`spec.display_in_jupyter(height=720)`. The chart stack retains its minimum height
inside the shorter viewport; the decision inspector has its own scrollbar.
Use the mouse wheel to scroll overflowing charts, or Ctrl/Command + wheel to zoom.
Without `chart_min_height`, the chart still fits its container as before.

`matched` may be true/false/null or absent: absent means neutral **Recorded**
evidence, while explicit null means **Not evaluated**. Values may be
string/number/boolean/null. Groups also accept optional boolean/null `matched`;
their result is never inferred from the rules (OR/threshold/veto logic may
differ). Statuses are not an enum. HTML is displayed as text. See the full
[decision contract](../../docs/spec.md#decision-annotations-and-inspector).
The bundled offline renderer must be rebuilt with
`pnpm --filter @finterion/charts-embed-app... build` before packaging the wheel.

Panels accept `collapsible=True` to enable their pane-collapse eye, including
the first panel, or `False` to keep a panel expanded. For example:
`Indicator.panel(id="equity", weight=2, values="portfolio.equity", collapsible=True)`.
Omitting the option preserves the default: only panels after the first collapse.
Collapsed panels retain a compact header and an expand control.

## Licence

**Finterion Community Licence v1.0** (source-available, not OSI-approved).
Free to use — including commercially — as long as the default "Powered by
Finterion" badge stays visible on rendered charts. To remove the badge or to
build a competing hosted charting service, you need a commercial licence:
contact licensing@finterion.com. See the `LICENSE` file shipped with the
wheel, or the [full text on GitHub](https://github.com/Finterion/charts/blob/main/LICENSE).
