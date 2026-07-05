---
"@finterion/charts-core": minor
"@finterion/charts-react": minor
"@finterion/charts-spec": minor
---

Add `alignByDuration` helper, `'duration'` timeFormat preset, and runtime `setTimeFormat`

- **`alignByDuration(curves, options?)`** — new helper in `@finterion/charts-core` that aligns any number of same-cadence time-series to a shared elapsed-ms axis (indexed from `0`). Longest curve sets the axis length; shorter curves are right-padded with `NaN` (or a caller-provided `padValue`). Bar spacing is inferred from the longest curve's timestamps or overridden via `barIntervalMs`. Solves the common "compare N backtests with different date ranges" case.
- **`'duration'` timeFormat preset** — pass `timeFormat: 'duration'` to render axis ticks and tooltip time as compact elapsed labels (`3M`, `1Y 6M`, `6M 5d`) instead of calendar dates. Exposed as a `resolveTimeFormatter` option and via the exported `formatDurationLabel(ms)` primitive.
- **Tooltip now honours `timeFormat`** — the first tooltip line was previously hard-coded to ISO date; it now routes through the configured formatter, so `'duration'` mode reads correctly.
- **`Chart.setTimeFormat(fmt)`** — runtime setter on the core chart class. `@finterion/charts-react` wires this into a `useEffect` so the `timeFormat` prop is now reactive (was construction-only).
- **`display.timeFormat` in `ChartSpec`** — new JSON-serialisable string field on the `display` block of `@finterion/charts-spec`, threaded through the compiler. Enables the duration preset (and any token template) from a pure spec, including from Python.

New exports from `@finterion/charts-core`: `alignByDuration`, `DurationSeriesInput`, `AlignByDurationOptions`, `AlignByDurationResult`, `formatDurationLabel`, `resolveTimeFormatter`.
