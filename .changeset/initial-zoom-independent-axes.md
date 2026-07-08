---
"@finterion/charts-core": minor
"@finterion/charts-react": minor
"@finterion/charts-spec": minor
---

`initialZoom` supports independent x/y axes and values `> 100`

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
