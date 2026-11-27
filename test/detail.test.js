import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDetail } from '../src/parse.js';
import { splitProducts, uniqueStores, isCareful } from '../public/shared/detail.js';

const id = '2026-nov-tilbagekald-risiko-for-mykotoksiner-i-mel';
const recall = parseDetail(fs.readFileSync(new URL(`./fixtures/pages/${id}.html`, import.meta.url), 'utf8'), { id });

test('with no chains set nothing is flagged', () => {
  const { mine, others } = splitProducts(recall.products, []);
  assert.equal(mine.length, 0);
  assert.equal(others.length, recall.products.length);
});

test('products sold in the reader\'s chain are separated from the rest', () => {
  const { mine, others } = splitProducts(recall.products, ['Netto']);
  assert.equal(mine.length + others.length, recall.products.length);
  assert.ok(mine.length > 0 && others.length > 0, 'a mixed recall splits both ways');
  assert.ok(mine.every((p) => /netto|coop|salling|nationwide|hele landet/i.test(p.soldAt) || p.soldAt), 'only products with a store text can be flagged');
  assert.ok(others.every((p) => !/netto/i.test(p.soldAt || '')), 'a product naming Netto is never left in "others"');
});

test('a group name (Coop) counts for a chain it owns', () => {
  const p = [{ name: 'x', soldAt: 'Coop-butikker' }, { name: 'y', soldAt: 'Bilka og Føtex' }];
  const { mine, others } = splitProducts(p, ['SuperBrugsen']);
  assert.deepEqual(mine.map((x) => x.name), ['x']);
  assert.deepEqual(others.map((x) => x.name), ['y']);
});

test('where-sold text is de-duplicated', () => {
  const list = uniqueStores(recall.stores.text);
  assert.equal(new Set(list.map((s) => s.toLowerCase())).size, list.length);
  assert.ok(list.length < recall.stores.text.split('|').length, 'duplicates were dropped');
  assert.deepEqual(uniqueStores('Nemlig.com , Bilka | Netto | netto'), ['Nemlig.com, Bilka', 'Netto']);
});

test('cautious wording applies to every level that can hurt, not to quality or not-acute', () => {
  for (const l of ['health', 'allergy', 'possible', 'unstated']) assert.equal(isCareful(l), true, l);
  for (const l of ['notacute', 'unfit']) assert.equal(isCareful(l), false, l);
});
