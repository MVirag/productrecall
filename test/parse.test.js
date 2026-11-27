// Parser tests against real Fødevarestyrelsen pages saved 27 Nov 2026
// (see test/fixtures/README.md). Expected values were read off the pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRss, parseDetail, extractDates, recallId } from '../src/parse.js';

const dir = new URL('./fixtures/pages/', import.meta.url);
const page = (id) => parseDetail(fs.readFileSync(new URL(`${id}.html`, dir), 'utf8'), { id });
const iso = (list) => list.map((d) => d.iso);

test('RSS: real feed parses, newest first, recall links only', () => {
  const xml = fs.readFileSync(new URL('./fixtures/rss.xml', import.meta.url), 'utf8');
  const items = parseRss(xml);
  assert.equal(items.length, 526); // 527 items, one is a press release
  assert.equal(items[0].id, '2026-nov-tilbagekald-smaakager-coronet');
  assert.equal(items[0].published, '2026-11-27T09:32:32.000Z');
  assert.match(items[0].title, /mykotoksiner/);
  assert.ok(items.every((i) => i.url.includes('/tilbagekaldte-produkter/')));
  assert.deepEqual(parseRss(xml, 5).map((i) => i.id), items.slice(0, 5).map((i) => i.id));
});

test('recallId is stable', () => {
  assert.equal(
    recallId('https://www.foedevarestyrelsen.dk/nyheder/tilbagekaldte-produkter/2026/nov/tilbagekald-af-oksekebab'),
    '2026-nov-tilbagekald-af-oksekebab',
  );
});

test('extractDates handles the formats seen on the site', () => {
  assert.deepEqual(iso(extractDates('Bedst før 7/4-2028 og 12/4-2028')), ['2028-04-07', '2028-04-12']);
  assert.deepEqual(iso(extractDates('30.09.2026, 07.10.2026 og 08.10.2026')), ['2026-09-30', '2026-10-07', '2026-10-08']);
  assert.deepEqual(iso(extractDates('11.11-2026')), ['2026-11-11']);
  assert.deepEqual(iso(extractDates('04/06 2026')), ['2026-06-04']);
  assert.deepEqual(iso(extractDates('31. august 2022')), ['2022-08-31']);
  assert.deepEqual(iso(extractDates('Ingen dato')), []);
});

test('oksekebab (h2 layout, single product, EAN, REMA 1000)', () => {
  const r = page('2026-nov-tilbagekald-af-oksekebab');
  assert.equal(r.title, 'Tilbagekald af oksekebab');
  assert.equal(r.published, '2026-11-26T13:44:25Z');
  assert.match(r.image, /^https:\/\/cdn2\.gopublic\.dk\/fvst\/Media\/.+\.jpg\?width=960$/);
  assert.equal(r.products.length, 1);
  const p = r.products[0];
  assert.equal(p.name, "Heat'n Eat Okse kebab");
  assert.equal(p.size, '400 g');
  assert.deepEqual(iso(p.bestBefore), ['2028-04-07', '2028-04-12']);
  assert.deepEqual(p.ean, ['5705518183096']);
  assert.deepEqual(r.stores.chains, ['Rema 1000', 'Nemlig.com']);
  assert.equal(r.reason.category, 'bse_material');
  assert.equal(r.action.kind, 'return_or_discard');
  assert.match(r.recaller, /Dencon Foods/);
});

test('peking and (h1 layout, two products sharing one date)', () => {
  const r = page('2026-nov-tilbagekald-risiko-for-salmonella-i-peking-and');
  assert.equal(r.products.length, 2);
  assert.match(r.products[0].name, /Pekingand lår/);
  assert.equal(r.products[0].size, '225-275 g');
  assert.deepEqual(iso(r.products[0].bestBefore), ['2026-11-11']);
  assert.deepEqual(iso(r.products[1].bestBefore), ['2026-11-11']);
  assert.deepEqual(r.stores.chains, ['Lidl']);
  assert.equal(r.reason.category, 'salmonella');
  assert.ok(r.image);
});

test('Bisca (many products, dates wrapped onto the next line, nationwide)', () => {
  const r = page('2026-nov-tilbagekald-aebleskiver-og-smaakager');
  assert.ok(r.products.length >= 20, `got ${r.products.length}`);
  assert.ok(r.products.every((p) => /[a-zæøå]{3}/i.test(p.name)), 'no date-only product names');
  const digestive = r.products.find((p) => /Digestive/.test(p.name));
  assert.deepEqual(iso(digestive.bestBefore), ['2026-09-15', '2026-09-29', '2026-10-06']);
  assert.equal(digestive.size, '250g');
  assert.equal(r.stores.nationwide, true);
  assert.equal(r.reason.category, 'mycotoxin');
  assert.equal(r.action.kind, 'discard');
  assert.equal(r.image, null);
});

test('bagels (per-product "Solgt i", stregkode, Coop group)', () => {
  const r = page('2026-nov-tilbagekald-bagel-og-pizzadej');
  const pizza = r.products[0];
  assert.match(pizza.name, /^Pizzadej/);
  assert.equal(pizza.size, '275 g');
  assert.deepEqual(pizza.ean, ['5704262003025']);
  assert.match(pizza.soldAt, /REMA 1000/);
  for (const c of ['Netto', 'Føtex', 'Bilka', 'Rema 1000']) assert.ok(r.stores.chains.includes(c), c);
  assert.ok(r.stores.groups.includes('Coop'));
});

test('müslibarer (groups named instead of chains, foreign body metal)', () => {
  const r = page('2026-nov-tilbagekald-risiko-for-metal-i-mueslibarer');
  assert.equal(r.products[0].size, '120 g, 6 × 20 g');
  assert.deepEqual(iso(r.products[0].bestBefore), ['2027-09-10']);
  assert.deepEqual(r.stores.groups.sort(), ['Coop', 'Dagrofa']);
  assert.equal(r.reason.category, 'foreign_body');
  assert.equal(r.reason.detail, 'metal');
});

test('ispinde (undeclared allergen: egg, allergy-only advice)', () => {
  const r = page('2026-nov-tilbagekald-af-ispinde');
  assert.equal(r.reason.category, 'allergen');
  assert.deepEqual(r.reason.allergens, ['æg']);
  assert.equal(r.action.allergyOnly, true);
  assert.deepEqual(r.products[0].ean, ['4056489835035']);
  assert.deepEqual(iso(r.products[0].bestBefore), ['2028-04-21']);
});

test('peanut butter (explicit Brand label, many chains)', () => {
  const r = page('2026-nov-tilbagekald-chlorpyrifos-i-peanut-butter');
  assert.equal(r.products.length, 2);
  assert.equal(r.products[0].brand, 'Urtekram');
  assert.ok(!r.products[0].brandGuessed);
  assert.equal(r.products[0].size, '230 g');
  for (const c of ['SuperBrugsen', 'Kvickly', 'Løvbjerg', 'Spar', 'Meny']) assert.ok(r.stores.chains.includes(c), c);
  assert.equal(r.reason.category, 'pesticide');
  assert.match(r.updated, /Opdateret/);
});

test('fine ærter (lot code, origin note)', () => {
  const r = page('2026-nov-tilbagekald-fund-af-biller-i-fine-aerter');
  const p = r.products[0];
  assert.deepEqual(p.ean, ['5705830610904']);
  assert.ok(p.lot[0].startsWith('L26'));
  assert.deepEqual(iso(p.bestBefore), ['2028-09-02', '2028-09-03']);
  assert.equal(r.products.length, 1, 'the "Pakket af…" line is a note, not a product');
  assert.equal(r.reason.category, 'pests');
});

test('mel (EAN as "Stregkode", "Solgt til" label)', () => {
  const r = page('2026-nov-tilbagekald-risiko-for-mykotoksiner-i-mel');
  assert.ok(r.products.length >= 10);
  assert.ok(!r.products.some((p) => /^Solgt/i.test(p.name)));
  assert.deepEqual(r.products[0].ean, ['5701075203659']);
  assert.ok(r.stores.chains.includes('Netto'));
});

test('grønkål (use-by dates, lot, parenthesised store notes)', () => {
  const r = page('2025-nov-listeria-i-hakket-groenkaal');
  const p = r.products[0];
  assert.deepEqual(iso(p.useBy), ['2025-11-25', '2025-11-27']);
  assert.equal(p.size, '250g');
  assert.equal(r.reason.category, 'listeria');
  assert.ok(r.stores.chains.includes('Rema 1000'));
});

test('leverpostej (Varenavn/Brand labels, ABC shop list)', () => {
  const r = page('2026-jun-salmonella-i-raa-leverpostej');
  const p = r.products[0];
  assert.match(p.name, /Leverpostej/);
  assert.equal(p.brand, 'Slagter Norlyk');
  assert.equal(p.useBy.length, 9);
  assert.deepEqual(p.ean, ['5715835003588']);
  assert.deepEqual(r.stores.chains, ['ABC Lavpris']);
});

test('flæskesvær (all best-before dates recalled)', () => {
  const r = page('2025-mar-salmonella-i-flaeskesvaer');
  assert.equal(r.products[0].allDates, true);
  assert.equal(r.products[0].brand, 'Snack Day');
  assert.ok(!r.uncertain.includes('dates'));
});

test('2021 layout (<strong>Label:</strong>)', () => {
  const r = page('2021-jun-tilbagekald-smarties-push-up-i-asker-a-4-stk');
  const p = r.products[0];
  assert.match(p.name, /Smarties/);
  assert.equal(p.size, '4 x 85 ml');
  assert.deepEqual(iso(p.bestBefore), ['2022-08-31']);
  assert.deepEqual(p.ean, ['7613034528995']);
  assert.equal(r.reason.category, 'pesticide');
  assert.equal(r.action.kind, 'return_or_discard');
});

test('2022 layout (bold <span> labels inside <div>s)', () => {
  const r = page('2022-aug-mug-paa-moshgifler');
  assert.equal(r.products[0].name, 'MOSHgifler');
  assert.equal(r.products[0].size, '160 g');
  assert.deepEqual(iso(r.products[0].bestBefore), ['2022-10-31', '2022-11-30']);
  assert.ok(r.stores.chains.includes('Meny'));
  assert.equal(r.reason.category, 'mould');
});

test('every fixture yields title, date, product, reason text and action text', () => {
  for (const f of fs.readdirSync(dir)) {
    const r = page(f.replace(/\.html$/, ''));
    assert.ok(r.title, `${f}: title`);
    assert.ok(r.published, `${f}: published`);
    assert.ok(r.products.length > 0, `${f}: products`);
    assert.ok(r.reason.text.length > 20, `${f}: reason`);
    assert.ok(r.action.text.length > 10, `${f}: action`);
    assert.notEqual(r.reason.category, 'other', `${f}: reason category`);
    assert.notEqual(r.action.kind, 'see_notice', `${f}: action kind`);
  }
});
