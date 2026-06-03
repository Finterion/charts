# Embedding

The `apps/embed` Vite app is a static, single-bundle iframe target. Drop it on
any CDN and you get instant, sandboxed chart embedding for any host that
allows iframes — forums, blogs, docs sites, Notion, etc.

It accepts a `ChartSpec` through three input channels, in priority order:

| Channel | Use when |
| --- | --- |
| `?src=<url>` | Spec is hosted on a CORS-enabled endpoint. |
| `#spec=<base64url>` | Forum embeds. The hash never hits the server. |
| `postMessage({ type: 'finterion:spec', spec })` | The host page is in your control and wants to push specs dynamically. |

---

## URL-hash share links

```ts
import { encodeSpec } from '@finterion/charts-spec';

const url = `https://charts.finterion.com/embed/#spec=${encodeSpec(spec)}`;
```

Then:

```html
<iframe src="https://charts.finterion.com/embed/#spec=eyJ2ZXJzaW9u…"
        width="640" height="320" loading="lazy"
        sandbox="allow-scripts" />
```

`encodeSpec` is a base64url encoding of `JSON.stringify(spec)`. No compression,
no signing — keep specs under ~32 KB to stay under common URL-length limits
(or use `?src=` for larger payloads).

`decodeSpec` is the inverse, used internally by the embed app.

## Hosted-spec embeds (`?src=`)

```html
<iframe src="https://charts.finterion.com/embed/?src=https://example.com/spec.json"
        width="640" height="320" loading="lazy" />
```

The embed app `fetch`es the URL with `credentials: 'omit'`. Your endpoint must
serve `Access-Control-Allow-Origin: *` (or echo the embed origin).

## Dynamic embeds (`postMessage`)

When the iframe mounts it posts `{ type: 'finterion:ready' }` to its parent.
The parent then sends the spec:

```ts
const iframe = document.querySelector('iframe')!;

window.addEventListener('message', (ev) => {
  if (ev.source === iframe.contentWindow && (ev.data as any)?.type === 'finterion:ready') {
    iframe.contentWindow!.postMessage({ type: 'finterion:spec', spec }, '*');
  }
});
```

This avoids encoding the spec into a URL and lets you swap charts without
remounting the iframe.

---

## Markdown shortcode pattern

If you control the forum's renderer, the cleanest UX is a fenced code block:

````markdown
```finterion-chart
{ "version": 1, "data": { … }, "panels": [ … ] }
```
````

Rendering script (paste into your forum theme):

```html
<script type="module">
  import { ChartFromSpec } from 'https://cdn.jsdelivr.net/npm/@finterion/charts-react/+esm';
  // … hydrate every <pre><code class="language-finterion-chart"> on the page
</script>
```

Or, simpler, replace each block with an iframe pointing at the embed app:

```js
document.querySelectorAll('pre > code.language-finterion-chart').forEach((el) => {
  const spec = JSON.parse(el.textContent);
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(spec))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const iframe = document.createElement('iframe');
  iframe.src = `https://charts.finterion.com/embed/#spec=${b64}`;
  iframe.width = '100%'; iframe.height = '320'; iframe.loading = 'lazy';
  iframe.style.border = '0';
  el.closest('pre').replaceWith(iframe);
});
```

---

## Sizing & responsiveness

The embed page renders the chart at `100vw × 100vh`, so size is controlled by
the iframe element. For responsive embeds:

```html
<div style="position:relative; width:100%; padding-top:50%;">
  <iframe style="position:absolute; inset:0; width:100%; height:100%; border:0;"
          src="…/embed/#spec=…" loading="lazy"></iframe>
</div>
```

## Security notes

- The embed app contains no `eval` and no dynamic code execution. The spec is
  pure data; the worst a malicious spec can do is render a misleading chart.
- Always set `sandbox="allow-scripts"` on third-party embeds — drop
  `allow-same-origin` unless you actively need it.
- If you allow `?src=` from arbitrary URLs, treat the embed app like any
  open-redirect surface: don't host it on the same origin as authenticated
  user content.

## Server-side rendering (future)

`compileSpec` is environment-agnostic. Wiring it to `node-canvas` would let
you serve PNG snapshots from `/embed.png?spec=…` for forums that strip
iframes. Not yet implemented.
