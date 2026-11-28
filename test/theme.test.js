// Theme switch, footer and admin page wiring that no other test covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const css = read('styles.css');

test('the two dark token blocks (system and forced) stay identical', () => {
  const sys = css.match(/prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}/)[1];
  const forced = css.match(/:root\[data-theme="dark"\] \{\n([\s\S]*?)\n\}/)[1];
  const norm = (b) => b.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  assert.equal(norm(sys), norm(forced));
});

test('index and admin pages set the saved theme before the stylesheet loads', () => {
  for (const f of ['index.html', 'admin.html']) {
    const html = read(f);
    const script = html.indexOf('dataset.theme');
    assert.ok(script > 0 && script < html.indexOf('styles.css'), f);
  }
});

test('Danish and English texts have the same keys, and the removed status texts are gone', async () => {
  const { STRINGS } = await import('../public/i18n.js');
  assert.deepEqual(Object.keys(STRINGS.da).sort(), Object.keys(STRINGS.en).sort());
  for (const k of ['status', 'feedError', 'weekNote']) assert.equal(k in STRINGS.da, false, k);
});

test('the owner dashboard is not linked from the app and not cached by the service worker', () => {
  assert.equal(/admin/.test(read('app.js')) || /admin/.test(read('index.html')), false);
  assert.match(read('sw.js'), /\^\\\/admin/);
  assert.match(read('admin.html'), /noindex/);
});
