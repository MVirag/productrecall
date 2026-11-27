// Severity levels and household profile, against real fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDetail } from '../src/parse.js';
import { severity, severityText } from '../public/shared/severity.js';
import { decide, notificationFor } from '../public/shared/summary.js';

const dir = new URL('./fixtures/pages/', import.meta.url);
const page = (id) => parseDetail(fs.readFileSync(new URL(`${id}.html`, dir), 'utf8'), { id });

test('levels for real recalls', () => {
  const cases = {
    '2026-nov-tilbagekald-risiko-for-salmonella-i-peking-and': 'acute',
    '2025-nov-listeria-i-hakket-groenkaal': 'acute',
    '2026-nov-tilbagekald-risiko-for-metal-i-mueslibarer': 'acute',
    '2026-nov-tilbagekald-af-ispinde': 'allergy',
    '2026-nov-tilbagekald-aebleskiver-og-smaakager': 'longterm',
    '2026-nov-tilbagekald-chlorpyrifos-i-peanut-butter': 'longterm',
    '2026-nov-tilbagekald-fund-af-biller-i-fine-aerter': 'quality',
    '2022-aug-mug-paa-moshgifler': 'quality',
  };
  for (const [id, level] of Object.entries(cases)) assert.equal(severity(page(id)).level, level, id);
});

test('urgency: acute is urgent, others quiet unless personal', () => {
  assert.equal(severity(page('2025-nov-listeria-i-hakket-groenkaal')).urgent, true);
  assert.equal(severity(page('2026-nov-tilbagekald-aebleskiver-og-smaakager')).urgent, false);
  const egg = page('2026-nov-tilbagekald-af-ispinde');
  assert.equal(severity(egg).urgent, false, 'egg allergen, household without egg allergy');
  const s = severity(egg, { allergens: ['æg'] });
  assert.deepEqual(s.allergens, ['æg']);
  assert.equal(s.urgent, true);
  assert.equal(s.personal, true);
  assert.equal(severityText(s, 'da'), 'Allergi i din husstand: Æg');
  assert.equal(severityText(s, 'en'), 'Allergy in your household: Egg');
});

test('unknown reason is never silenced', () => {
  const s = severity({ reason: { category: 'other', text: '' } });
  assert.equal(s.level, 'other');
  assert.equal(s.urgent, true);
});

test('gluten profile covers wheat allergen', () => {
  const r = { reason: { category: 'allergen', allergens: ['hvede'], text: '' } };
  assert.deepEqual(severity(r, { allergens: ['gluten'] }).allergens, ['gluten']);
});

test('vulnerable household: listeria flagged as extra serious', () => {
  const r = page('2025-nov-listeria-i-hakket-groenkaal');
  const s = severity(r, { vulnerable: true });
  assert.equal(s.vulnerable, true);
  assert.match(severityText(s, 'da'), /Ekstra alvorlig for gravide og små børn/);
  assert.equal(severity(page('2026-nov-tilbagekald-aebleskiver-og-smaakager'), { vulnerable: true }).vulnerable, false);
});

test('"only my stores" mode: household allergen notifies even from another chain', () => {
  const egg = page('2026-nov-tilbagekald-af-ispinde'); // Lidl
  assert.equal(decide(egg, { mode: 'mine', chains: ['Netto'] }).notify, false);
  assert.equal(decide(egg, { mode: 'mine', chains: ['Netto'], allergens: ['æg'] }).notify, true);
  const n = notificationFor(egg, { chains: ['Netto'], allergens: ['æg'] });
  assert.match(n.title, /^🟠 Lidl/);
  assert.match(n.body, /^Allergi i din husstand: Æg · /);
  assert.equal(n.silent, false);
});

test('acute notification is loud and marked red', () => {
  const n = notificationFor(page('2026-nov-tilbagekald-risiko-for-salmonella-i-peking-and'), {});
  assert.match(n.title, /^🔴 Lidl · Fersk Pekingand/);
  assert.match(n.body, /^Akut · /);
  assert.equal(n.silent, false);
});
