// Translation with a fake Workers AI binding (the real model only runs on Cloudflare).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDetail } from '../src/parse.js';
import { translateRecall, textHash, TRANSLATE_MODEL } from '../src/translate.js';

const page = (id) => parseDetail(fs.readFileSync(new URL(`./fixtures/pages/${id}.html`, import.meta.url), 'utf8'), { id });

function fakeAI(reply) {
  const calls = [];
  return { calls, run: async (model, input) => { calls.push({ model, input }); return reply(input); } };
}

test('sends one JSON-mode request with all fields and keeps the Danish on gaps', async () => {
  const r = page('2026-nov-tilbagekald-af-oksekebab');
  const ai = fakeAI(() => ({ response: { title: 'Recall of beef kebab', lead: 'Dencon Foods A/S is recalling beef kebab…', stores: 'The product was sold at REMA 1000 and Nemlig.com.', reason: 'Bovine brain tissue was found.', action: '' } }));
  const en = await translateRecall(ai, r);
  assert.equal(ai.calls.length, 1);
  assert.equal(ai.calls[0].model, TRANSLATE_MODEL);
  assert.equal(ai.calls[0].input.response_format.type, 'json_schema');
  assert.match(ai.calls[0].input.prompt, /hjernevæv fra kvæg/);
  assert.doesNotMatch(ai.calls[0].input.prompt, /EAN: 5705518183096/, 'raw product list is not sent');
  assert.equal(en.title, 'Recall of beef kebab');
  assert.equal(en.action, r.action.text, 'empty translation of a non-empty field falls back to Danish');
  assert.equal(en.hash, textHash(r));
});

test('accepts a JSON string response with surrounding text', async () => {
  const r = page('2026-nov-tilbagekald-af-ispinde');
  const ai = fakeAI(() => ({ response: 'Here you go:\n{"title":"T","lead":"L","stores":"S","reason":"R","action":"A"}' }));
  const en = await translateRecall(ai, r);
  assert.deepEqual([en.title, en.action], ['T', 'A']);
});

test('textHash changes only when the Danish text changes', () => {
  const r = page('2026-nov-tilbagekald-af-oksekebab');
  const h = textHash(r);
  assert.equal(textHash(structuredClone(r)), h);
  const changed = structuredClone(r);
  changed.stores.text += ' Opdateret: også Netto.';
  assert.notEqual(textHash(changed), h);
});

test('a reply that is still Danish counts as a failure (retried later)', async () => {
  const r = page('2026-nov-tilbagekald-smaakager-coronet');
  const echo = fakeAI((input) => ({ response: JSON.parse(input.prompt.slice(input.prompt.indexOf('{'))) }));
  await assert.rejects(translateRecall(echo, r), /untranslated/);
  const empty = fakeAI(() => ({ response: { title: '', lead: '', stores: '', reason: '', action: '' } }));
  await assert.rejects(translateRecall(empty, r), /untranslated/);
});
