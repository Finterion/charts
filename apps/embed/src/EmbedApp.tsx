import { useEffect, useState } from 'react';
import { ChartFromSpec } from '@finterion/charts-react';
import { decodeSpec, type ChartSpec } from '@finterion/charts-spec';

/**
 * A static, iframe-friendly embed page for Finterion ChartSpecs.
 *
 * Resolution order (first match wins):
 *  1. `?src=<url>`         — fetch JSON ChartSpec from a URL (CORS required)
 *  2. `#spec=<base64url>`  — inline base64url-encoded ChartSpec in the hash
 *  3. window.postMessage   — host page sends `{ type: 'finterion:spec', spec }`
 *
 * The hash form is preferred for forum embeds: hash payloads are not sent
 * to the server, so even huge specs stay client-side.
 */
export function EmbedApp() {
  const [spec, setSpec] = useState<ChartSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = new URL(window.location.href);
    const src = url.searchParams.get('src');

    // 1. ?src=<url>
    if (src) {
      fetch(src, { credentials: 'omit' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json: ChartSpec) => {
          if (!cancelled) setSpec(json);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(`Failed to load spec: ${e.message}`);
        });
      return () => {
        cancelled = true;
      };
    }

    // 2. #spec=<base64url>
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const encoded = params.get('spec');
    if (encoded) {
      try {
        setSpec(decodeSpec(encoded));
      } catch (e) {
        setError(`Failed to decode spec: ${(e as Error).message}`);
      }
      return;
    }

    // 3. window.postMessage({ type: 'finterion:spec', spec })
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; spec?: ChartSpec } | null;
      if (data && data.type === 'finterion:spec' && data.spec) {
        setSpec(data.spec);
      }
    };
    window.addEventListener('message', onMessage);

    // Tell parent we're ready, in case it wants to push a spec.
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'finterion:ready' }, '*');
    }

    return () => {
      cancelled = true;
      window.removeEventListener('message', onMessage);
    };
  }, []);

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#c44',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13,
          padding: 16,
          textAlign: 'center',
        }}
      >
        ⚠ {error}
      </div>
    );
  }

  if (!spec) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
        }}
      >
        Waiting for chart spec…
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ChartFromSpec spec={spec} />
    </div>
  );
}
