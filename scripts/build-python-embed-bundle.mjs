#!/usr/bin/env node
/**
 * Inline the embed app's Vite build into a single self-contained HTML file
 * and copy it into the Python binding so it ships in the wheel.
 *
 * This is what powers the offline `display_inline()` path in the Python
 * binding — no Node/Vite/internet required at runtime.
 *
 * Usage (from repo root):
 *
 *   pnpm --filter @finterion/charts-embed-app build
 *   node scripts/build-python-embed-bundle.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'apps/embed/dist');
const OUT_DIR = join(ROOT, 'bindings/python/src/finterion_charts/_static');
const OUT_FILE = join(OUT_DIR, 'embed.html');

if (!existsSync(DIST)) {
  console.error(
    `error: ${DIST} not found. Run \`pnpm --filter @finterion/charts-embed-app build\` first.`,
  );
  process.exit(1);
}

let html = readFileSync(join(DIST, 'index.html'), 'utf8');

// Inline <script type="module" src="/assets/foo.js"></script>
html = html.replace(
  /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g,
  (_match, src) => {
    const local = src.replace(/^\//, '');
    const code = readFileSync(join(DIST, local), 'utf8');
    // Defensive: keep `</script>` from prematurely closing the tag.
    const safe = code.replace(/<\/script>/gi, '<\\/script>');
    return `<script type="module">${safe}</script>`;
  },
);

// Inline <link rel="stylesheet" href="/assets/foo.css">
html = html.replace(
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/g,
  (_match, href) => {
    const local = href.replace(/^\//, '');
    const css = readFileSync(join(DIST, local), 'utf8');
    return `<style>${css}</style>`;
  },
);

// Inject the spec placeholder: a `<script>` tag that defines
// `window.__FINTERION_SPEC__` BEFORE the inlined module script runs.
// The Python side substitutes `__FINTERION_SPEC_JSON__` with `JSON.stringify(spec)`.
const placeholder =
  '<script>window.__FINTERION_SPEC__ = /*__FINTERION_SPEC_JSON__*/ null;</script>';

if (!html.includes('<div id="root"></div>')) {
  console.error('error: expected <div id="root"></div> mount point in index.html');
  process.exit(1);
}
html = html.replace('<div id="root"></div>', `<div id="root"></div>\n${placeholder}`);

// Sanity check: ensure no external asset references remain.
const extAssets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)];
if (extAssets.length) {
  console.error(`error: residual external asset references: ${extAssets.map((m) => m[1]).join(', ')}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, html, 'utf8');

const sizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
const assetCount = readdirSync(join(DIST, 'assets')).length;
console.log(`✓ wrote ${OUT_FILE} (${sizeKB} KB, ${assetCount} assets inlined)`);
