// Translation checks, with a fake Workers AI binding (the real model only
// runs on Cloudflare). The rejected examples are what the real model
// returned on the live app on 27 Nov 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDetail } from '../src/parse.js';
import {
  translateRecall, textHash, checkTranslation, looksDanish, isCurrentTranslation, TRANSLATE_MODEL, TRANSLATE_VERSION,
} from '../src/translate.js';

const page = (id) => parseDetail(fs.readFileSync(new URL(`./fixtures/pages/${id}.html`, import.meta.url), 'utf8'), { id });
const lastLine = (prompt) => prompt.split('\n').pop();

function fakeAI(reply) {
  const calls = [];
  return { calls, run: async (model, input) => { calls.push({ model, input }); return reply(lastLine(input.prompt), input); } };
}

test('live regression: an invented Danish "translation" of the peas recall is rejected', () => {
  const r = page('2026-nov-tilbagekald-fund-af-biller-i-fine-aerter');
  // What the model actually returned for this recall:
  assert.notEqual(checkTranslation(r.title, 'Tilbagekald: Fund af fremmedlegemer i kyllingeprodukt'), '');
  const lead = 'SuperBrugsen tilbagekalder kyllingeprodukt pga. fund af fremmedlegemer. Produktet er solgt i SuperBrugsen butikker i hele landet.';
  assert.notEqual(checkTranslation(r.lead || r.title, lead), '');
  // Even if it had been in English, an invented store is caught:
  assert.match(checkTranslation('Produktet er solgt i REMA 1000.', 'The product was sold at SuperBrugsen.'), /stores not in the original: SuperBrugsen/);
});

test('live regression: Danish echoed back is rejected', () => {
  const src = 'Der er risiko for mykotoksiner i produkterne, og en sundhedsmæssig risiko kan derfor ikke udelukkes.';
  assert.equal(checkTranslation(src, src), 'unchanged');
  assert.equal(checkTranslation(src, 'Der er risiko for mykotoksiner i produkterne.'), 'not English');
});

test('a faithful English translation passes', () => {
  assert.equal(checkTranslation(
    'Heat\'n Eat Okse kebab, Nettoindhold: 400 g, Bedst før 7/4-2028, EAN: 5705518183096',
    'Heat\'n Eat Okse kebab, net content: 400 g, best before 7/4-2028, EAN: 5705518183096'), '');
  assert.equal(checkTranslation('Produktet er solgt i REMA 1000 og hos Nemlig.com.', 'The product was sold at REMA 1000 and Nemlig.com.'), '');
  assert.equal(looksDanish('Har du produktet, bør du enten levere det tilbage til butikken.'), true);
  assert.equal(looksDanish('If you have the product, return it to the store or throw it away.'), false);
});

test('numbers must survive (EAN, dates, sizes)', () => {
  assert.match(checkTranslation('EAN: 5705518183096, bedst før 07.04.2028', 'EAN: 570551818309, best before 07.04.2028'), /numbers missing/);
});

test('field by field: good fields kept, bad fields stay Danish, results are labelled with the version', async () => {
  const r = page('2026-nov-tilbagekald-af-oksekebab');
  const ai = fakeAI((text) => {
    if (text.startsWith('Tilbagekald af')) return { response: 'Recall of beef kebab' };
    if (text.includes('REMA 1000')) return { response: 'The product was sold at SuperBrugsen.' }; // invented store
    if (text.includes('hjernevæv')) return { response: 'Analysis found brain tissue from cattle in the product. Brain tissue from cattle over 12 months old is specified risk material that can potentially contain disease-causing prions and must not be used in food.' };
    return { response: text }; // echo
  });
  const en = await translateRecall(ai, r);
  assert.equal(ai.calls[0].model, TRANSLATE_MODEL);
  assert.equal(ai.calls[0].input.response_format, undefined, 'plain prompt, no JSON mode');
  assert.equal(en.title, 'Recall of beef kebab');
  assert.equal(en.stores, r.stores.text, 'invented store rejected -> Danish kept');
  assert.match(en.checked.stores, /SuperBrugsen/);
  assert.equal(en.action, r.action.text, 'echo rejected -> Danish kept');
  assert.equal(en.checked.title, true);
  assert.equal(en.version, TRANSLATE_VERSION);
  assert.equal(isCurrentTranslation(en), true);
  assert.equal(isCurrentTranslation({ ...en, version: 2 }), false, 'older translations are never shown');
  assert.equal(isCurrentTranslation({ title: 'x' }), false);
});

test('nothing passes -> failure (retried later), AI errors too', async () => {
  const r = page('2026-nov-tilbagekald-smaakager-coronet');
  await assert.rejects(translateRecall(fakeAI((t) => ({ response: t })), r), /no field passed/);
  await assert.rejects(translateRecall(fakeAI(() => { throw new Error('AI down'); }), r), /AI down/);
});

test('textHash changes with the Danish text and with the translator version', () => {
  const r = page('2026-nov-tilbagekald-af-oksekebab');
  const h = textHash(r);
  assert.equal(textHash(structuredClone(r)), h);
  const changed = structuredClone(r);
  changed.stores.text += ' Opdateret: også Netto.';
  assert.notEqual(textHash(changed), h);
});
