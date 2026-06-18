# @finterion/charts-core

## 1.0.0

### Major Changes

- **Licence change.** This package is now distributed under the **Finterion Community License v1.0** (source-available, not OSI-approved). Versions prior to 1.0.0 remain available under MIT. The library is still free for commercial use, but charts must display the default "Powered by Finterion" attribution badge unless you obtain a commercial licence (`licensing@finterion.com`).

### Minor Changes

- **Branding badge.** Charts now render a small "Powered by Finterion" attribution badge in a dedicated row below the time axis. Configurable via the new `branding` option (`true | false | BrandingOptions`). The badge tracks the active theme and re-renders on `setTheme()` / `setDisplayOptions()` so the wordmark stays legible across themes.
- New `BrandingOptions` type exported from the package.

## 0.2.0

### Minor Changes

- [`d10ccfc`](https://github.com/Finterion/charts/commit/d10ccfc56e88c439dd94b3ee8d8f6008fd220c17) Thanks [@MDUYN](https://github.com/MDUYN)! - Initial public release
