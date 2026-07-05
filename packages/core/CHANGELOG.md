# @finterion/charts-core

## 1.2.0

### Minor Changes

- [`25e683c`](https://github.com/Finterion/charts/commit/25e683cf0eaa4ecbab10c4e05ff5089a01f375f1) Thanks [@MDUYN](https://github.com/MDUYN)! - Add `alignByDuration` helper, `'duration'` timeFormat preset, and runtime `setTimeFormat`

  - **`alignByDuration(curves, options?)`** — new helper in `@finterion/charts-core` that aligns any number of same-cadence time-series to a shared elapsed-ms axis (indexed from `0`). Longest curve sets the axis length; shorter curves are right-padded with `NaN` (or a caller-provided `padValue`). Bar spacing is inferred from the longest curve's timestamps or overridden via `barIntervalMs`. Solves the common "compare N backtests with different date ranges" case.
  - **`'duration'` timeFormat preset** — pass `timeFormat: 'duration'` to render axis ticks and tooltip time as compact elapsed labels (`3M`, `1Y 6M`, `6M 5d`) instead of calendar dates. Exposed as a `resolveTimeFormatter` option and via the exported `formatDurationLabel(ms)` primitive.
  - **Tooltip now honours `timeFormat`** — the first tooltip line was previously hard-coded to ISO date; it now routes through the configured formatter, so `'duration'` mode reads correctly.
  - **`Chart.setTimeFormat(fmt)`** — runtime setter on the core chart class. `@finterion/charts-react` wires this into a `useEffect` so the `timeFormat` prop is now reactive (was construction-only).
  - **`display.timeFormat` in `ChartSpec`** — new JSON-serialisable string field on the `display` block of `@finterion/charts-spec`, threaded through the compiler. Enables the duration preset (and any token template) from a pure spec, including from Python.

  New exports from `@finterion/charts-core`: `alignByDuration`, `DurationSeriesInput`, `AlignByDurationOptions`, `AlignByDurationResult`, `formatDurationLabel`, `resolveTimeFormatter`.

## 1.1.0

### Minor Changes

- [`98e92c0`](https://github.com/Finterion/charts/commit/98e92c0fafd349be97bc5189d7c755538ad40142) Thanks [@MDUYN](https://github.com/MDUYN)! - Add `loading` prop, `interactive` flag, `timeFormat`, and `kind: 'background'` indicator

  - **`loading?: boolean`** — renders a theme-aware MUI-style circular spinner overlay on the chart while data is being fetched or computed; the chart engine stays mounted (no remount cost on transition)
  - **`interactive?: boolean`** — disables mouse/touch pan and zoom for static/embedded charts (default `true`)
  - **`timeFormat?: string | ((t: number) => string)`** — custom time-axis label format; supports tokens (`YYYY`, `MMM`, `DD`, etc.) or a callback receiving a ms-epoch timestamp
  - **`kind: 'background'`** — new `IndicatorSeries` kind that fills pixel-space vertical bands (independent of the y-scale); useful for highlighting date ranges such as train/test splits
  - Updated terminal theme `accent` tokens to phosphor green so the loading spinner is on-brand for both `terminal-light` and `terminal-dark`

## 1.0.0

### Major Changes

- **Licence change.** This package is now distributed under the **Finterion Community License v1.0** (source-available, not OSI-approved). Versions prior to 1.0.0 remain available under MIT. The library is still free for commercial use, but charts must display the default "Powered by Finterion" attribution badge unless you obtain a commercial licence (`licensing@finterion.com`).

### Minor Changes

- **Branding badge.** Charts now render a small "Powered by Finterion" attribution badge in a dedicated row below the time axis. Configurable via the new `branding` option (`true | false | BrandingOptions`). The badge tracks the active theme and re-renders on `setTheme()` / `setDisplayOptions()` so the wordmark stays legible across themes.
- New `BrandingOptions` type exported from the package.

## 0.2.0

### Minor Changes

- [`d10ccfc`](https://github.com/Finterion/charts/commit/d10ccfc56e88c439dd94b3ee8d8f6008fd220c17) Thanks [@MDUYN](https://github.com/MDUYN)! - Initial public release
