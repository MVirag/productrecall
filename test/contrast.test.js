// The colour tokens in public/styles.css must keep their contrast in both themes.
// Text >= 4.5:1, borders / focus rings / icons >= 3:1 (WCAG 2.2 AA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const lightBlock = css.match(/:root \{([\s\S]*?)\n\}/)[1];
const darkBlock = css.match(/prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme=\"light\"\]\) \{([\s\S]*?)\n  \}/)[1];
const parse = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
const THEMES = { light: parse(lightBlock), dark: { ...parse(lightBlock), ...parse(darkBlock) } };

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const T = 4.5, U = 3;
const PAIRS = [
  // text on the three grounds
  ['ink', 'bg', T], ['ink', 'surface', T], ['ink', 'surface-sunken', T],
  ['ink-muted', 'bg', T], ['ink-muted', 'surface', T], ['ink-muted', 'surface-sunken', T],
  // app bar, nav pills (current is a slab: bar text on on-bar), primary button
  ['on-bar', 'bar', T], ['on-bar', 'bar-hover', T], ['on-bar', 'bar-active', T], ['bar', 'on-bar', T],
  ['on-brand', 'brand', T], ['on-brand', 'brand-hover', T], ['on-brand', 'brand-active', T],
  // level text on the sticker and on its tag tint; solid tags and badge glyphs on the level fill
  // the health sticker keeps its tint on hover and press
  ['ink', 'health-tint', T], ['ink-muted', 'health-tint', T], ['ink-muted', 'health-tint-hover', T], ['ink-muted', 'health-tint-active', T],
  ['health', 'health-tint-hover', T], ['health', 'health-tint-active', T],
  ['health', 'surface', T], ['health', 'bg', T], ['health', 'health-tint', T], ['on-health', 'health-fill', T],
  ['allergy', 'surface', T], ['allergy', 'bg', T], ['allergy', 'allergy-tint', T], ['on-allergy', 'allergy-fill', T],
  ['notacute', 'surface', T], ['notacute', 'bg', T], ['notacute', 'notacute-tint', T], ['on-notacute', 'notacute-fill', T],
  ['unfit', 'surface', T], ['unfit', 'bg', T], ['unfit', 'unfit-tint', T], ['on-unfit', 'unfit-fill', T],
  ['ok', 'surface', T], ['ok', 'ok-tint', T],
  // control edges, focus rings, sticker frames
  ['border-control', 'surface', U], ['border-control', 'bg', U], ['border-control', 'surface-sunken', U],
  ['focus', 'surface', U], ['focus', 'bg', U], ['focus-on-bar', 'bar', U],
  ['frame', 'surface', U], ['frame', 'bg', U], ['health-fill', 'surface', U], ['health-fill', 'bg', U],
  ['brand', 'bg', U], ['brand', 'surface', U],
];

for (const [theme, tok] of Object.entries(THEMES)) {
  test(`colour contrast holds in the ${theme} theme`, () => {
    const failures = [];
    for (const [fg, bg, min] of PAIRS) {
      assert.ok(tok[fg] && tok[bg], `token missing in ${theme}: ${fg} or ${bg}`);
      const r = ratio(tok[fg], tok[bg]);
      if (r < min) failures.push(`${fg} on ${bg}: ${r.toFixed(2)} < ${min}`);
    }
    assert.deepEqual(failures, []);
  });
}
