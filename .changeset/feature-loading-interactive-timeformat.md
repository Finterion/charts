---
"@finterion/charts-core": minor
"@finterion/charts-react": minor
"@finterion/charts-spec": minor
---

Add `loading` prop, `interactive` flag, `timeFormat`, and `kind: 'background'` indicator

- **`loading?: boolean`** — renders a theme-aware MUI-style circular spinner overlay on the chart while data is being fetched or computed; the chart engine stays mounted (no remount cost on transition)
- **`interactive?: boolean`** — disables mouse/touch pan and zoom for static/embedded charts (default `true`)
- **`timeFormat?: string | ((t: number) => string)`** — custom time-axis label format; supports tokens (`YYYY`, `MMM`, `DD`, etc.) or a callback receiving a ms-epoch timestamp
- **`kind: 'background'`** — new `IndicatorSeries` kind that fills pixel-space vertical bands (independent of the y-scale); useful for highlighting date ranges such as train/test splits
- Updated terminal theme `accent` tokens to phosphor green so the loading spinner is on-brand for both `terminal-light` and `terminal-dark`
