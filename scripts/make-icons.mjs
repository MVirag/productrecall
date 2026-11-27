// Render the app icons (PNG) from inline SVG with Playwright/Chromium.
// Usage: node scripts/make-icons.mjs   (needs `playwright` + a Chromium)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';

const SLATE = '#2e343b';
// Bell, drawn with the same paths as the app bar mark (24px grid, 2px round stroke).
const glyph = (fg) => `
  <g transform="translate(61 61) scale(16.25)" fill="none" stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.268 21a2 2 0 0 0 3.464 0"/>
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
  </g>`;

const icons = {
  'icon-192.png': { size: 192, svg: `<rect width="512" height="512" rx="112" fill="${SLATE}"/>${glyph('#fff')}` },
  'icon-512.png': { size: 512, svg: `<rect width="512" height="512" rx="112" fill="${SLATE}"/>${glyph('#fff')}` },
  // Maskable: full bleed, glyph inside the 80% safe zone.
  'maskable-512.png': { size: 512, svg: `<rect width="512" height="512" fill="${SLATE}"/><g transform="translate(256 262) scale(.72) translate(-256 -256)">${glyph('#fff')}</g>` },
  // Android status-bar badge: white on transparent (only alpha is used).
  'badge-96.png': { size: 96, svg: glyph('#fff'), transparent: true },
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, { size, svg, transparent }] of Object.entries(icons)) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${svg}</svg></body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  fs.writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), buf);
  console.log(name, size, transparent ? '(transparent)' : '');
}
await browser.close();
