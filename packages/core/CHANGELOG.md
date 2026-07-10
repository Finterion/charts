# @finterion/charts-core

## 1.4.0

### Minor Changes

- [`88f827e`](https://github.com/Finterion/charts/commit/88f827e5f02bd6351e1f84843969118e4d9e9fb5) Thanks [@MDUYN](https://github.com/MDUYN)! - Add `vbar` panel — vertical categorical bar chart

  `vbar` is the vertical counterpart to `hbar`: categorical **x**-axis, value
  **y**-axis, same option shape (`categories`, `values`, `positiveColor`,
  `negativeColor`, `showMean`, `format`, `xLabel`, `yLabel`).

  The y-range picks itself intelligently based on the data:

  - Mixed-sign values → symmetric around zero (matches `hbar`'s signed-returns look).
  - All-positive or all-negative values → tight around min/max, so count / magnitude
    series fill the plot instead of wasting half of it below zero.

  ```ts
  {
    id: 'monthly-pnl', kind: 'vbar', weight: 1, title: 'Monthly P&L',
    vbar: {
      categories: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      values: [0.03, -0.01, 0.05, 0.02, -0.02, 0.04, 0.01, 0.03, -0.03, 0.02, 0.05, 0.04],
      showMean: true,
      format: (v) => `${(v * 100).toFixed(1)}%`,
    },
  }
  ```

  `showMean: true` draws a dashed horizontal mean line with a `mean X` label.
  Fully JSON-round-trippable via `@finterion/charts-spec` (matching
  `VBarPanelSpec` + JSON Schema branch).

## 1.3.0

### Minor Changes

- [`1989b05`](https://github.com/Finterion/charts/commit/1989b05b7d25a3d1d3baa2fea0f19512314248bb) Thanks [@MDUYN](https://github.com/MDUYN)! - `initialZoom` supports independent x/y axes and values `> 100`

  - **New object shape** — `initialZoom` now accepts either a single number
    (applied to both axes) or an object `{ x?, y? }` to zoom the two axes
    independently. Any missing axis defaults to `100` (fit-to-data).
    Backwards-compatible: passing a number behaves the same as before for
    values `<= 100`.
  - **Values `> 100` no longer silently clamped** — they now zoom OUT past
    the data extent, adding empty padding on the affected axis. On the
    x-axis, extra empty bars are drawn on either side; on the y-axis, the
    range is expanded around the midpoint. e.g. `initialZoom={120}` adds
    ~10% breathing room on every edge of both axes;
    `initialZoom={{ x: 100, y: 200 }}` fits the x-axis and adds 50% padding
    on the y-axis only.
  - **Fix** — the initial y-scale now survives React re-mounting the panels
    via `setPanels`; previously, `initialZoom > 100` snapped the y-axis
    back to fit-to-data on the first render.
  - **Renderer robustness** — `computeTimeTicks`/`drawTimeAxis` are now safe
    against viewport indices outside the data buffer (needed by the new
    x-axis padding). Data-anchored timestamps are read from clamped
    indices; padded regions extrapolate using the mean bar interval.
  - **JSON schema** — `display.initialZoom` in `@finterion/charts-spec` now
    accepts either a positive number or an object `{ x?, y? }`.

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
