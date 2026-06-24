# Time axis formatting

By default the time axis uses an adaptive formatter that adjusts its label
style to the visible span:

| Visible range | Example labels |
|---|---|
| Minutes / hours | `14:30`, `15:00` |
| Hours + date | `03/15 09:00` |
| Days | `03/15`, `04/01` |
| Months | `03/2023` |
| Years | `2022-03` |

To override this, set the `timeFormat` option.

---

## Format string

Pass a template string containing any of the tokens below. All other
characters are preserved as-is.

| Token | Description | Example |
|-------|-------------|--------|
| `YYYY` | 4-digit UTC year | `2023` |
| `YY` | 2-digit UTC year | `23` |
| `MMM` | Short month name | `Jan` |
| `MM` | Zero-padded month (01–12) | `03` |
| `DD` | Zero-padded day (01–31) | `05` |
| `HH` | Zero-padded hour, 24h (00–23) | `14` |
| `mm` | Zero-padded minute (00–59) | `07` |

### React

```tsx
// "Jan 2023", "Feb 2023", …
<Chart timeFormat="MMM YYYY" ... />

// "05/03/2023"
<Chart timeFormat="DD/MM/YYYY" ... />

// "2023-03"
<Chart timeFormat="YYYY-MM" ... />
```

### Core (imperative)

```ts
const chart = new Chart(container, {
  timeFormat: 'MMM YYYY',
  // …
});
```

---

## Callback

For full control — locale-aware output, conditional formatting, custom
calendars — pass a `(t: number) => string` function. `t` is a UTC
millisecond epoch.

```tsx
// Locale-aware, using the browser's Intl API
<Chart
  timeFormat={(t) =>
    new Date(t).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
  }
  ...
/>

// Financial quarter labels
<Chart
  timeFormat={(t) => {
    const d = new Date(t);
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return `Q${q} ${d.getUTCFullYear()}`;
  }}
  ...
/>
```

The callback is called once per visible tick on every render — keep it cheap
(no I/O, no heavy computation).

---

## Python binding

The JSON spec's `display` block does not carry a `timeFormat` field — the
spec is renderer-agnostic and the time axis is a browser-side concern. When
you embed via `spec.display()` or `spec.show()` the default adaptive
formatter is used. To customise labels, render with the React component
instead of `ChartFromSpec`.
