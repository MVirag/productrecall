// The colour tokens in public/styles.css must keep their contrast in both themes.
// Text >= 4.5:1, borders / focus rings / icons >= 3:1 (WCAG 2.2 AA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const lightBlock = css.match(/:root \{([\s\S]*?)\n\}/)[1];
const darkBlock = css.match(/prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}/)[1];
const parse = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
const THEMES = { light: parse(lightBlock), dark: { ...parse(lightBlock), ...parse(darkBlock) } };

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const T = 4.5, U = 3;
const PAIRS = [
  ['ink', 'bg', T], ['ink', 'surface', T], ['ink', 'surface-sunken', T],
  ['ink-muted', 'bg', T], ['ink-muted', 'surface', T], ['ink-muted', 'surface-sunken', T],
  ['on-bar', 'bar', T], ['on-brand', 'brand', T], ['on-brand', 'brand-hover', T],
  ['sev-acute', 'surface', T], ['sev-acute', 'bg', T], ['sev-acute', 'sev-acute-tint', T], ['on-sev-solid', 'sev-acute-solid', T],
  ['sev-allergy', 'surface', T], ['sev-allergy', 'sev-allergy-tint', T], ['on-sev-solid', 'sev-allergy-solid', T],
  ['sev-longterm', 'surface', T], ['sev-longterm', 'sev-longterm-tint', T], ['on-sev-solid', 'sev-longterm', T],
  ['sev-quality', 'surface', T], ['sev-quality', 'sev-quality-tint', T], ['on-sev-solid', 'sev-quality', T],
  ['ink', 'surface-sunken', T],
  ['mine', 'surface', T], ['mine', 'bg', T], ['mine', 'mine-tint', T],
  ['ok', 'surface', T], ['ok', 'ok-tint', T],
  ['border-control', 'surface', U], ['border-control', 'bg', U], ['border-control', 'surface-sunken', U],
  ['focus', 'surface', U], ['focus', 'bg', U], ['focus-on-bar', 'bar', U],
  ['mine', 'surface', U], ['mine', 'bg', U], ['sev-acute', 'sev-acute-tint', U],
  ['brand', 'bg', U], ['brand', 'surface', U], ['sev-allergy-solid', 'surface', U],
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
