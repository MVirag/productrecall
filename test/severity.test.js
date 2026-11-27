// Categories come from Fødevarestyrelsen's own wording. Expected values below
// were read off the 17 real notices in test/fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDetail } from '../src/parse.js';
import { classify, severity, severityText } from '../public/shared/severity.js';
import { decide, notificationFor } from '../public/shared/summary.js';

const dir = new URL('./fixtures/pages/', import.meta.url);
const page = (id) => parseDetail(fs.readFileSync(new URL(`${id}.html`, dir), 'utf8'), { id });

const EXPECTED = {
  '2026-nov-tilbagekald-af-oksekebab': ['health', /sygdomsfremkaldende prioner/],
  '2024-jan-e-coli-stec-i-skiveskaaret-poelse': ['health', /Symptomerne på infektion med E\.coli/],
  '2026-nov-tilbagekald-risiko-for-metal-i-mueslibarer': ['health', /potentiel sundhedsrisiko/],
  '2025-mar-salmonella-i-flaeskesvaer': ['health', /risiko for smitte med Salmonella/],
  '2026-jun-salmonella-i-raa-leverpostej': ['health', /risiko for smitte med Salmonella/],
  '2026-nov-tilbagekald-risiko-for-salmonella-i-peking-and': ['health', /sundhedsrisiko/],
  '2025-nov-listeria-i-hakket-groenkaal': ['health', /listeriabakterier kan give/],
  '2026-nov-tilbagekald-af-ispinde': ['allergy', /allergisk reaktion/],
  '2026-nov-tilbagekald-aebleskiver-og-smaakager': ['notacute', /ikke tale om en akut sundhedsmæssig påvirkning/],
  '2026-nov-tilbagekald-bagel-og-pizzadej': ['notacute', /ikke tale om en akut/],
  '2026-nov-tilbagekald-risiko-for-mykotoksiner-i-mel': ['notacute', /ikke tale om en akut/],
  '2026-nov-tilbagekald-smaakager-coronet': ['notacute', /ikke tale om en akut/],
  '2026-nov-tilbagekald-chlorpyrifos-i-peanut-butter': ['notacute', /ikke opleve akutte symptomer/],
  '2021-jun-tilbagekald-smarties-push-up-i-asker-a-4-stk': ['possible', /sundhedsmæssig risiko ikke udelukkes/],
  '2022-aug-mug-paa-moshgifler': ['unfit', /uegnet som fødevare/],
  '2026-nov-tilbagekald-fund-af-biller-i-fine-aerter': ['unfit', /uegnet som fødevare/],
  '2026-nov-tilbagekald-spind-fra-moel-i-knaekkede-byggryn': ['unfit', /uegnet som fødevare/],
};

test('every real notice is filed by its own risk sentence', () => {
  assert.equal(Object.keys(EXPECTED).length, fs.readdirSync(dir).length, 'covers all fixtures');
  for (const [id, [level, quote]] of Object.entries(EXPECTED)) {
    const c = classify(page(id));
    assert.equal(c.level, level, id);
    assert.match(c.quote, quote, id);
  }
});

test('stock "if you get symptoms" sentence does not count as a risk statement', () => {
  const r = { reason: { text: 'Mugdannelse gør, at produktet er uegnet som fødevare.' }, action: { text: 'Hvis du oplever symptomer i forbindelse med indtag af produktet, bør du kontakte din egen læge.' } };
  assert.equal(classify(r).level, 'unfit');
});

test('no recognised wording -> "risk not stated", never silent by default', () => {
  const r = { reason: { text: 'Produktet er tilbagekaldt af virksomheden.' }, lead: '', action: { text: 'Aflever det i butikken.' } };
  const s = severity(r);
  assert.equal(s.level, 'unstated');
  assert.equal(s.quote, '');
  assert.equal(s.silent, false);
});

test('silence is only the user\'s choice, and never for a household allergen', () => {
  const myc = page('2026-nov-tilbagekald-aebleskiver-og-smaakager');
  assert.equal(severity(myc).silent, false, 'default: everything makes a sound');
  assert.equal(severity(myc, { quiet: ['notacute'] }).silent, true);
  const egg = page('2026-nov-tilbagekald-af-ispinde');
  assert.equal(severity(egg, { quiet: ['allergy'] }).silent, true, 'quiet allergy for a household without egg allergy');
  assert.equal(severity(egg, { quiet: ['allergy'], allergens: ['æg'] }).silent, false, 'own allergen always sounds');
});

test('household allergen and vulnerable groups are facts from the notice', () => {
  const egg = page('2026-nov-tilbagekald-af-ispinde');
  const s = severity(egg, { allergens: ['æg'] });
  assert.deepEqual(s.allergens, ['æg']);
  assert.equal(severityText(s, 'da'), 'Allergi i din husstand: Æg');
  assert.equal(severityText(s, 'en'), 'Allergy in your household: Egg');
  assert.deepEqual(severity({ reason: { category: 'allergen', allergens: ['hvede'], text: '' } }, { allergens: ['gluten'] }).allergens, ['gluten']);

  const listeria = page('2025-nov-listeria-i-hakket-groenkaal');
  assert.equal(severity(listeria).vulnerableMentioned, true, 'the notice names pregnancy / weak immune system');
  assert.equal(severity(listeria, { vulnerable: true }).personal, true);
  assert.equal(severity(page('2026-nov-tilbagekald-risiko-for-salmonella-i-peking-and'), { vulnerable: true }).vulnerableMentioned, false,
    'no extra warning when the notice itself does not mention vulnerable groups');
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

test('notification shows the category label from the notice', () => {
  const kebab = notificationFor(page('2026-nov-tilbagekald-af-oksekebab'), {});
  assert.match(kebab.title, /^🔴 /);
  assert.match(kebab.body, /^Kan gøre dig syg · /);
  const en = notificationFor(page('2026-nov-tilbagekald-smaakager-coronet'), { lang: 'en', quiet: ['notacute'] });
  assert.match(en.title, /^🟡 /);
  assert.match(en.body, /^Not acute · /);
  assert.equal(en.silent, true);
});

test('coversAllergen: wheat counts as gluten, other names match exactly', async () => {
  const { coversAllergen } = await import('../public/shared/severity.js');
  assert.equal(coversAllergen('hvede', ['gluten']), true);
  assert.equal(coversAllergen('gluten', ['gluten']), true);
  assert.equal(coversAllergen('mælk', ['gluten']), false);
  assert.equal(coversAllergen('mælk', []), false);
  assert.equal(coversAllergen('mælk', ['mælk', 'æg']), true);
});
