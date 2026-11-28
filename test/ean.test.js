// Barcode matching against the barcodes printed in the 17 real notices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDetail } from '../src/parse.js';
import { validCodes } from '../public/scan.js';
import { hasValidCheckDigit, gtin14, compareCodes, matchRecalls, barcodeCoverage, formatCode, digitsOnly } from '../public/shared/ean.js';

const dir = new URL('./fixtures/pages/', import.meta.url);
const recalls = fs.readdirSync(dir).map((f) => parseDetail(fs.readFileSync(new URL(f, dir), 'utf8'), { id: f.replace(/\.html$/, ''), url: `https://x/${f}` }));
const byId = (id) => recalls.find((r) => r.id === id);

test('check digit: real barcodes pass, a misread digit fails', () => {
  assert.equal(hasValidCheckDigit('5705518183096'), true); // kebab, from the notice
  assert.equal(hasValidCheckDigit('5705518183097'), false);
  assert.equal(hasValidCheckDigit('4056489835035'), true); // ice lollies (Lidl)
  assert.equal(hasValidCheckDigit('73513537'), true); // EAN-8 example
  assert.equal(hasValidCheckDigit('12345'), false);
  assert.equal(hasValidCheckDigit(''), false);
});

test('UPC-A and EAN-13 are the same product; spaces and dashes are ignored', () => {
  assert.equal(gtin14('036000291452'), gtin14('0036000291452'));
  assert.equal(gtin14('5705 5181 8309 6'), '05705518183096');
  assert.equal(gtin14('1234'), null);
  assert.equal(digitsOnly('EAN: 5705-518183096'), '5705518183096');
  assert.equal(formatCode('5705518183096'), '5 705518 183096');
});

test('every barcode printed in the real notices finds its own recall', () => {
  let checked = 0;
  for (const r of recalls) {
    for (const p of r.products) {
      for (const ean of p.ean) {
        if (!hasValidCheckDigit(ean)) continue;
        const hits = matchRecalls(recalls, ean);
        const mine = hits.find((h) => h.recall.id === r.id);
        assert.ok(mine, `${r.id}: ${ean}`);
        assert.ok(mine.products.includes(p), `${r.id}: product ${p.name}`);
        assert.equal(mine.loose, false);
        checked++;
      }
    }
  }
  assert.equal(checked, 28, '28 of the 30 printed barcodes are valid');
});

test('the same number on 12 digits (UPC-A form) matches too', () => {
  // 036000291452 -> not in the notices; use a real EAN-13 that starts with 0
  const fake = [{ id: 'a', published: '2026-01-01', products: [{ name: 'X', ean: ['0036000291452'] }] }];
  assert.equal(matchRecalls(fake, '036000291452').length, 1);
  assert.equal(matchRecalls(fake, '0036000291452').length, 1);
});

test('kebab barcode opens the kebab recall with that product', () => {
  const hits = matchRecalls(recalls, '5705518183096');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].recall.id, '2026-nov-tilbagekald-af-oksekebab');
  assert.equal(hits[0].products[0].name, "Heat'n Eat Okse kebab");
});

test('a product that is not recalled matches nothing', () => {
  assert.deepEqual(matchRecalls(recalls, '5701234567893'), []); // valid shape, in no notice
  assert.deepEqual(matchRecalls(recalls, ''), []);
  assert.deepEqual(matchRecalls(null, '5705518183096'), []);
});

test('malformed number on a real notice (14 digits, bad check digit): approximate match on manufacturer + item', () => {
  // mel recall prints 57058300165631 for "Rema1000 Hvedemel": not a valid code
  assert.equal(hasValidCheckDigit('57058300165631'), false);
  assert.equal(compareCodes('57058300165631', '5705830016560'), 'loose', 'same first 12 digits');
  assert.equal(hasValidCheckDigit('5705830016560'), true);
  assert.equal(compareCodes('57058300165631', '5705830016591'), null, 'another item of the same manufacturer');
  assert.equal(compareCodes('57058300165631', '5705830016561'), null, 'a scan with a bad check digit is never matched');
  const hit = matchRecalls(recalls, '5705830016560').find((h) => h.recall.id === '2026-nov-tilbagekald-risiko-for-mykotoksiner-i-mel');
  assert.ok(hit, 'found through the malformed number');
  assert.equal(hit.loose, true);
  assert.equal(compareCodes('123', '5705830016560'), null);
  // a valid printed number is never matched loosely
  assert.equal(compareCodes('5705518183096', '5705518183089'), null);
});

test('coverage: how many recalls carry barcodes at all (the honest limit of scanning)', () => {
  const c = barcodeCoverage(recalls);
  assert.equal(c.recalls, 17);
  assert.equal(c.withEan, 9);
  assert.deepEqual(barcodeCoverage([]), { recalls: 0, withEan: 0 });
});

test('newest recall first when a product is in several recalls', () => {
  const two = [
    { id: 'old', published: '2026-01-01', products: [{ ean: ['5705518183096'] }] },
    { id: 'new', published: '2026-06-01', products: [{ ean: ['5705518183096'] }] },
  ];
  assert.deepEqual(matchRecalls(two, '5705518183096').map((h) => h.recall.id), ['new', 'old']);
});

test('scanner only passes codes with a valid check digit and a barcode length', () => {
  assert.deepEqual(validCodes(['5705518183096', '5705518183097', 'abc', '1234', '5705 5181 83096', '57058300165631']), ['5705518183096', '5705518183096']);
  assert.deepEqual(validCodes([]), []);
});
