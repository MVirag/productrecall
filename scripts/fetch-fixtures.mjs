// Download the live RSS feed and the N newest recall pages into test/fixtures.
// Usage: node scripts/fetch-fixtures.mjs [count=10]
import fs from 'node:fs';
import { FEED_URL, parseRss } from '../src/parse.js';

const n = Number(process.argv[2] || 10);
const out = new URL('../test/fixtures/', import.meta.url);
const xml = await (await fetch(FEED_URL)).text();
fs.writeFileSync(new URL('rss.xml', out), xml);
for (const item of parseRss(xml, n)) {
  const res = await fetch(item.url);
  fs.writeFileSync(new URL(`pages/${item.id}.html`, out), await res.text());
  console.log(res.status, item.id);
}
