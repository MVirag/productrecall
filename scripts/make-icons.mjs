// Render the app icons (PNG) from inline SVG with Playwright/Chromium.
// Usage: node scripts/make-icons.mjs   (needs `playwright` + a Chromium)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';

const RED = '#b3261e';
// Warning triangle with "!".
const glyph = (fg) => `
  <path d="M256 92 L436 404 H76 Z" fill="none" stroke="${fg}" stroke-width="34" stroke-linejoin="round"/>
  <rect x="236" y="190" width="40" height="122" rx="18" fill="${fg}"/>
  <circle cx="256" cy="352" r="22" fill="${fg}"/>`;

const icons = {
  'icon-192.png': { size: 192, svg: `<rect width="512" height="512" rx="112" fill="${RED}"/>${glyph('#fff')}` },
  'icon-512.png': { size: 512, svg: `<rect width="512" height="512" rx="112" fill="${RED}"/>${glyph('#fff')}` },
  // Maskable: full bleed, glyph inside the 80% safe zone.
  'maskable-512.png': { size: 512, svg: `<rect width="512" height="512" fill="${RED}"/><g transform="translate(256 262) scale(.72) translate(-256 -256)">${glyph('#fff')}</g>` },
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
