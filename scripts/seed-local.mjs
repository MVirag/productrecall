// Fill the LOCAL dev KV (wrangler dev) with recalls parsed from the saved
// fixtures, for working on the UI offline. Does not touch production.
//   node scripts/seed-local.mjs && npx wrangler kv key put --binding KV --local recalls --path .wrangler/seed-recalls.json
import fs from 'node:fs';
import { parseRss, parseDetail } from '../src/parse.js';

const fx = new URL('../test/fixtures/', import.meta.url);
const items = parseRss(fs.readFileSync(new URL('rss.xml', fx), 'utf8'), 40);
const recalls = [];
for (const f of fs.readdirSync(new URL('pages/', fx))) {
  const id = f.replace(/\.html$/, '');
  const meta = items.find((i) => i.id === id) || { id, url: `https://www.foedevarestyrelsen.dk/nyheder/tilbagekaldte-produkter/${id.replace(/^(\d{4})-([a-z]{3})-/, '$1/$2/')}` };
  const r = parseDetail(fs.readFileSync(new URL(`pages/${f}`, fx), 'utf8'), meta);
  r.fetchedAt = r.firstSeen = new Date().toISOString();
  recalls.push(r);
}
recalls.sort((a, b) => (b.published || '').localeCompare(a.published || ''));
fs.mkdirSync('.wrangler', { recursive: true });
fs.writeFileSync('.wrangler/seed-recalls.json', JSON.stringify(recalls));
console.log(`wrote ${recalls.length} recalls to .wrangler/seed-recalls.json`);
