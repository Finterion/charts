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

The vertical crosshair snaps to the nearest bar center. Hover, pan, and
cursor-anchored zoom use the same canvas width in both standalone and embedded charts.

### Pan and zoom

Drag normally to pan the shared time axis. **Shift + drag** inside a price or
indicator panel draws a dashed selection box: release to zoom the time axis to that
region and that panel's Y-axis to the selected values. Dragging in either
direction works; the selection stays within the starting panel. Press
**Escape** to cancel. Tiny selections (less than 4 pixels on either axis) do
nothing, and time zoom retains a minimum span of 10 bars where available.

**Scroll over the Y-axis labels** to zoom only that panel's vertical range,
without Ctrl/Cmd and without changing the time axis or scrolling the page.
Existing Y-axis dragging and double-click autoscale reset remain available;
reset also clears a box-selected vertical range.
Normal wheel behavior over the plot is unchanged, including Ctrl/Cmd zoom
when panels overflow. These gestures are disabled by `interactive: false`;
box zoom is unavailable while Compare points is active.

Decision annotations can set `signalType` to `scale_in`, `scale_out`,
`stop_loss`, or `take_profit`. Scale decisions use + and - symbols.
Protective exits use SL/TP badges: `eventType: 'trigger'` is hollow and
`eventType: 'fill'` is solid, with separate legend filters and inspector cards.
Simultaneous triggers and fills are offset left/right so both can be selected.
Existing annotations without these optional fields retain their circle markers.
Trade markers also accept `shape: 'plus'` and `shape: 'minus'`.

### Compare points

The left-hand vertical toolbar contains **Main time axis** and **Compare points**
icon buttons. Hover a button for its tooltip; active tools are highlighted.
Use Tab to focus the tools and Up/Down arrows to move between them.
Use **Hide toolbar** at the bottom of the sidebar to reclaim the chart space;
the small **Show toolbar** tab on the left edge brings it back. Hiding the
toolbar preserves active tools and selected comparison points.
**Main time axis** moves the shared time axis below the main panel (click again
to return it to the bottom).

Click **Compare points** in that toolbar, then click timestamps in any
price or indicator panel. Each click adds a numbered point across the shared
time panels; clicking a selected timestamp again removes it. The right-hand
side panel compares OHLCV, indicators, overlays and both bounds of bands,
including hidden series. Add as many points as needed and scroll the table
horizontally to compare them.

The first selected point is the baseline. Subsequent columns show the value,
absolute change and percentage change (`100 * (value - baseline) / abs(baseline)`).
A zero baseline has no percentage change; missing/non-finite values show `N/A`.
Removing the baseline makes the next selected point the baseline.
Non-time panels (such as scatter plots and heatmaps) are explicitly marked as
not timestamp-comparable.

Use **Remove** or **Clear all** to manage points. **Close** (or the toolbar
button) returns to normal chart navigation and the decision inspector; reopening
Compare restores the selection. Points stay anchored to timestamps during
pan/zoom and data updates; timestamps removed from the data are discarded.
Comparison is available in React, JSON-spec embeds and Python's bundled offline
renderer without extra configuration, and is disabled for non-interactive charts.

---

## Installation

### JavaScript / TypeScript

```bash
# npm
npm install @finterion/charts-core @finterion/charts-react @finterion/charts-spec

# pnpm
pnpm add @finterion/charts-core @finterion/charts-react @finterion/charts-spec
```

| Package | npm |
| --- | --- |
| `@finterion/charts-core` | [![npm](https://img.shields.io/npm/v/@finterion/charts-core)](https://www.npmjs.com/package/@finterion/charts-core) |
| `@finterion/charts-react` | [![npm](https://img.shields.io/npm/v/@finterion/charts-react)](https://www.npmjs.com/package/@finterion/charts-react) |
| `@finterion/charts-spec` | [![npm](https://img.shields.io/npm/v/@finterion/charts-spec)](https://www.npmjs.com/package/@finterion/charts-spec) |

### Python

```bash
pip install finterion-charts
```

[![PyPI](https://img.shields.io/pypi/v/finterion-charts)](https://pypi.org/project/finterion-charts/)

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

## Releasing

Versioning is managed with [Changesets](https://github.com/changesets/changesets).

1. After making a change, add a changeset:

   ```bash
   pnpm changeset
   ```

   Pick the affected packages and a `patch` / `minor` / `major` bump. Commit
   the resulting markdown file in `.changeset/`.

2. When merged to `main`, the [`release` workflow](.github/workflows/release.yml)
   opens a "Version Packages" PR that bumps versions and updates `CHANGELOG.md`.

3. Merging that PR triggers `pnpm release`, which builds and **stages** npm
   tarballs using `npm stage publish`. Published or already-staged versions are
   skipped so reruns can safely resume a partial release. Tarballs are packed
   with pnpm so internal `workspace:*` dependencies become actual versions.

4. A maintainer reviews the stage IDs in the workflow summary and approves
   each package from a local terminal with npm **11.21.1** or newer:

   ```bash
   npm login
   npm stage list @finterion/charts-core
   npm stage list @finterion/charts-spec
   npm stage list @finterion/charts-react
   npm stage view <stage-id>
   npm stage approve <stage-id>
   ```

   Approval prompts for 2FA. Approve core, then spec, then react so dependencies
   are available first. A successful staging workflow does **not** mean the
   packages are publicly available; it does not create published GitHub releases
   or git tags. Verify all three versions after approval with
   `npm view <package>@<version> version`.

The workflow can also be started manually with **Run workflow** after a token
update or to resume staging. Rerunning an older run uses its old workflow code;
start a new run after merging workflow changes.

The three publishable packages (`@finterion/charts-core`, `@finterion/charts-react`,
`@finterion/charts-spec`) are versioned together (`linked`); the playground and
embed apps are `private` and never published.

### One-time setup before the first release

- Add `NPM_TOKEN` (a stage-only token with read/write access to all three
  packages) to the repo's GitHub Actions secrets. No 2FA bypass is needed.
- Ensure the `@finterion` npm org exists and the token owner has package write
  access. Approving maintainers must have 2FA enabled on their npm accounts.
- The first time the workflow runs, it stages the versions in `package.json`
  without requiring an initial changeset.
- Local `pnpm release` also requires npm 11.21.1 or newer and npm authentication.
  See [npm's staged publishing documentation](https://docs.npmjs.com/cli/v11/commands/npm-stage).

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

---

## Licence

Finterion Charts is released under the **[Finterion Community Licence v1.0](LICENSE)** — a source-available licence (not OSI-approved "open source").

**Free for everyone, with one condition:**

- Use it in any project, including commercial products and internal tools
- Fork it, modify it, redistribute it
- Self-host the embed bundle, ship the Python wheel, vendor the source
- **You must keep the "Powered by Finterion" badge visible** on every rendered chart
- You may not strip the badge, market a fork as "Finterion Charts", or build a competing hosted charting service on top of it

**Want to remove the badge?** That's what the **commercial licence** is for. Email [licensing@finterion.com](mailto:licensing@finterion.com).

Finterion's own websites and products operate under an implicit commercial licence and run the library with `branding={false}`. See [LICENSE](LICENSE) for the full text.
