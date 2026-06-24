# Themes

Four built-in themes are available. Pass the theme name as a string to the
`theme` prop (React) or `ChartOptions.theme` (core).

| Name | Appearance |
|------|-----------|
| `'tradingview-light'` | White background, muted grid, green/red candles — matches TradingView's default light skin |
| `'tradingview-dark'` | Dark navy background, same green/red palette |
| `'terminal-light'` | Cream/paper background, dark-green phosphor series — old line-printer aesthetic |
| `'terminal-dark'` | Pure-black background, bright phosphor-green series, red down candles |

The legacy names `'finterion-light'` and `'finterion-dark'` are kept as
aliases for `'tradingview-light'` and `'tradingview-dark'` respectively.

---

## React

```tsx
import { Chart } from '@finterion/charts-react';

// String name
<Chart theme="tradingview-dark" data={data} panels={panels} />
<Chart theme="terminal-light"   data={data} panels={panels} />
```

### Switching themes at runtime

Changing the `theme` prop re-mounts the chart engine with the new theme.
For a live theme-picker, lift the value into state:

```tsx
import { useState } from 'react';
import type { ThemeName } from '@finterion/charts-core';

const THEMES: ThemeName[] = [
  'tradingview-light',
  'tradingview-dark',
  'terminal-light',
  'terminal-dark',
];

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeName>('tradingview-dark');

  return (
    <>
      <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeName)}>
        {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <Chart theme={theme} data={data} panels={panels} />
    </>
  );
}
```

---

## Core (imperative)

```ts
import { Chart, createBuffer } from '@finterion/charts-core';

const chart = new Chart(container, {
  theme: 'terminal-dark',
  panels: [...],
});
chart.setData(createBuffer(bars));
```

---

## Custom theme

Pass a `ThemeTokens` object instead of a string to use a fully custom palette.
Every token is a CSS color string.

```ts
import type { ThemeTokens } from '@finterion/charts-core';

const myTheme: ThemeTokens = {
  bg:          '#0f0f14',   // canvas background
  surface:     'rgba(20,20,30,0.95)', // tooltip / legend surface
  border:      '#2a2a3a',   // panel borders
  text:        '#e8e8f0',   // primary axis labels
  textDim:     'rgba(232,232,240,0.5)', // secondary labels / titles
  grid:        '#1a1a28',   // grid lines
  up:          '#00c896',   // bullish candles / positive histogram
  upGlow:      'rgba(0,200,150,0.4)',
  down:        '#ff4060',   // bearish candles / negative histogram
  downGlow:    'rgba(255,64,96,0.4)',
  accent:      '#7c6aff',   // highlights
  accentGlow:  'rgba(124,106,255,0.4)',
  magenta:     '#e040fb',
  lime:        '#aeea00',
};

// React
<Chart theme={myTheme} data={data} panels={panels} />

// Core
const chart = new Chart(container, { theme: myTheme, panels });
```

---

## Python binding

The JSON spec accepts any of the four built-in name strings in `display.theme`:

```python
from finterion_charts import ChartSpec, Price, Theme

spec = (
    ChartSpec(theme=Theme.terminal_dark)   # enum — autocomplete
    # ChartSpec(theme="terminal-dark")     # raw string — also fine
    .with_bars(time=time, open=open_, high=high, low=low, close=close)
    .add_panel(Price(id="price", weight=1, type="line"))
)
spec.display()
```

Available enum members:

| Enum | String |
|------|--------|
| `Theme.tradingview_light` | `'tradingview-light'` |
| `Theme.tradingview_dark` | `'tradingview-dark'` |
| `Theme.terminal_light` | `'terminal-light'` |
| `Theme.terminal_dark` | `'terminal-dark'` |

Custom `ThemeTokens` objects cannot be expressed in JSON spec — use the React
or core API when you need a fully custom palette.
