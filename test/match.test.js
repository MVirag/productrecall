// Matcher tests: store chains and Danish watch words, against real fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDetail } from '../src/parse.js';
import { detectStores, matchMyStores, DEFAULT_CHAINS } from '../public/shared/chains.js';
import { termMatches, matchWords } from '../public/shared/words.js';
import { decide, summarize, notificationFor } from '../public/shared/summary.js';

const dir = new URL('./fixtures/pages/', import.meta.url);
const page = (id) => parseDetail(fs.readFileSync(new URL(`${id}.html`, dir), 'utf8'), { id });

// ------------------------------------------------------------ stores

test('chain spellings', () => {
  assert.deepEqual(detectStores('Rema1000-butikker over hele landet').chains, ['Rema 1000']);
  assert.deepEqual(detectStores('REMA 1000 og hos Nemlig.com').chains, ['Rema 1000', 'Nemlig.com']);
  assert.deepEqual(detectStores('Coop 365').chains, ['365discount']);
  assert.deepEqual(detectStores('Coop 365').groups, []);
  assert.deepEqual(detectStores("Dagli'Brugsen og SuperBrugsen").chains.sort(), ["Dagli'Brugsen", 'SuperBrugsen'].sort());
  assert.deepEqual(detectStores('Netto indhold: 2 kg').chains, [], 'Netto indhold is not the chain');
  assert.equal(detectStores('Produkterne er solgt i supermarkedskæder i hele landet.').nationwide, true);
  assert.equal(detectStores('Lidl-butikker i hele landet').nationwide, false);
});

test('my stores: direct, via group, nationwide', () => {
  const muesli = page('2026-nov-tilbagekald-risiko-for-metal-i-mueslibarer'); // Coop Danmark, Dagrofa
  assert.deepEqual(matchMyStores(muesli.stores, ['Kvickly']).viaGroup, ['Kvickly']);
  assert.deepEqual(matchMyStores(muesli.stores, ['Meny']).viaGroup, ['Meny']);
  assert.equal(matchMyStores(muesli.stores, ['Lidl']).mine, false);

  const kebab = page('2026-nov-tilbagekald-af-oksekebab');
  assert.deepEqual(matchMyStores(kebab.stores, ['Rema 1000', 'Netto']).direct, ['Rema 1000']);

  const bisca = page('2026-nov-tilbagekald-aebleskiver-og-smaakager');
  const m = matchMyStores(bisca.stores, ['Lidl']);
  assert.equal(m.nationwide, true);
  assert.equal(m.mine, true, 'nationwide-unspecified counts as mine');
});

test('custom chain typed by the user', () => {
  const r = page('2026-nov-tilbagekald-risiko-for-mykotoksiner-i-mel');
  assert.deepEqual(matchMyStores(r.stores, ['Fleggaard', 'Kiwi']).direct, ['Fleggaard']);
  const pb = page('2026-nov-tilbagekald-chlorpyrifos-i-peanut-butter');
  assert.deepEqual(matchMyStores(pb.stores, ['helsebixen']).direct, ['helsebixen']);
});

test('every default chain is recognised by name', () => {
  for (const c of DEFAULT_CHAINS) assert.deepEqual(detectStores(`solgt i ${c}`).chains, [c], c);
});

// ------------------------------------------------------------ words

test('Danish compounds and inflections', () => {
  const yes = [
    ['mælk', 'letmælk'], ['mælk', 'Sødmælken'], ['mælk', 'mælkeprodukter'], ['letmælk', 'mælk'],
    ['laks', 'røget laks'], ['røget laks', 'laks'], ['laks', 'laksefilet'], ['laks', 'Røgelaksen'],
    ['pølse', 'pølser'], ['pølse', 'Spegepølsen'], ['ærter', 'Fine ærter'], ['ært', 'ærter'],
    ['æg', 'æg'], ['æg', 'æggene'], ['æg', 'hønseæg'], ['æg', 'æggeblommer'],
    ['kebab', 'Okse kebab'], ['and', 'Pekingand'], ['mel', 'Hvedemel'], ['småkager', 'småkage'],
    ['kylling', 'kyllingebryst'], ['kyllingebryst', 'brystet'], ['peanut butter', 'Peanut butter crunchy'],
  ];
  for (const [term, text] of yes) assert.ok(termMatches(term, text), `${term} ⇄ ${text}`);
  const no = [
    ['æg', 'ægte'], ['æg', 'Bæger'], ['is', 'risiko'], ['laks', 'lakrids'], ['mælk', 'mel'],
    ['ost', 'rosted'],
  ];
  for (const [term, text] of no) assert.ok(!termMatches(term, text), `${term} ✗ ${text}`);
});

test('known limitation: words of 4+ letters also match inside unrelated compounds', () => {
  // Substring matching is what makes compounds work ("mælk" in "sødmælken"),
  // so "laks" also matches "laksefarvet". Acceptable: default mode notifies anyway.
  assert.ok(termMatches('laks', 'laksefarvet'));
  assert.ok(!termMatches('and', 'i hele landet'), '3-letter words only match at compound edges');
});

test('watch words against real recalls', () => {
  assert.deepEqual(matchWords(page('2026-nov-tilbagekald-af-oksekebab'), ['kebab', 'laks']), ['kebab']);
  assert.deepEqual(matchWords(page('2026-nov-tilbagekald-risiko-for-mykotoksiner-i-mel'), ['hvedemel']), ['hvedemel']);
  assert.deepEqual(matchWords(page('2026-nov-tilbagekald-af-ispinde'), ['æg']), ['æg'], 'allergen counts');
  assert.deepEqual(matchWords(page('2026-nov-tilbagekald-aebleskiver-og-smaakager'), ['pebernød']), ['pebernød']);
  assert.deepEqual(matchWords(page('2026-nov-tilbagekald-fund-af-biller-i-fine-aerter'), ['ærter', 'mælk']), ['ærter']);
});

// ------------------------------------------------------------ decide / summary

test('notification modes', () => {
  const kebab = page('2026-nov-tilbagekald-af-oksekebab'); // REMA 1000
  const bisca = page('2026-nov-tilbagekald-aebleskiver-og-smaakager'); // nationwide
  assert.equal(decide(kebab, { mode: 'all', chains: ['Netto'] }).notify, true);
  assert.equal(decide(kebab, { mode: 'mine', chains: ['Netto'] }).notify, false);
  assert.equal(decide(kebab, { mode: 'mine', chains: ['Rema 1000'] }).notify, true);
  assert.equal(decide(kebab, { mode: 'mine', chains: ['Netto'], words: ['kebab'] }).notify, true, 'word overrides');
  assert.equal(decide(bisca, { mode: 'mine', chains: ['Netto'] }).notify, true, 'nationwide counts');
  assert.equal(decide(kebab, { mode: 'all', chains: ['Rema 1000'] }).highlight, true);
});

test('card summary and push text', () => {
  const kebab = page('2026-nov-tilbagekald-af-oksekebab');
  const s = summarize(kebab, { chains: ['Rema 1000'] });
  assert.deepEqual(
    { store: s.store, product: s.product, size: s.size, dates: s.dates, action: s.action, mine: s.mine },
    {
      store: 'Rema 1000', product: "Heat'n Eat Okse kebab", size: '400 g',
      dates: 'Bedst før 07.04.2028 +1', action: 'Aflever i butikken eller kassér', mine: true,
    },
  );
  const n = notificationFor(kebab, { chains: ['Rema 1000'] });
  assert.equal(n.title, "🔴 Din butik: Rema 1000 · Heat'n Eat Okse kebab");
  assert.equal(n.body, 'Kan gøre dig syg · 400 g · Bedst før 07.04.2028 +1 · Risikomateriale (kvæg) · Aflever i butikken eller kassér');
  assert.equal(n.silent, false);
  assert.equal(n.url, '/#/recall/2026-nov-tilbagekald-af-oksekebab');

  const en = notificationFor(page('2026-nov-tilbagekald-af-ispinde'), { lang: 'en', chains: [] });
  assert.match(en.title, /^🟠 Lidl · Gelatelli/);
  assert.match(en.body, /Undeclared egg/);
  assert.match(en.body, /If allergic/);

  const bisca = summarize(page('2026-nov-tilbagekald-aebleskiver-og-smaakager'), {});
  assert.equal(bisca.store, 'Supermarkeder i hele landet');
  assert.match(bisca.product, /\+\d+ flere$/);
});
