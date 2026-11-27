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
  assert.equal(ai.calls[0].model, TRANSLATE_MODEL);
  assert.equal(ai.calls[0].input.response_format.type, 'json_schema');
  assert.match(ai.calls[0].input.prompt, /hjernevæv fra kvæg/);
  assert.doesNotMatch(ai.calls[0].input.prompt, /EAN: 5705518183096/, 'raw product list is not sent');
  assert.equal(en.title, 'Recall of beef kebab');
  assert.equal(ai.calls.length, 2, 'the empty action field is retried on its own');
  assert.equal(ai.calls[1].input.response_format, undefined, 'retry uses a plain prompt');
  assert.equal(en.action, r.action.text, 'still empty after the retry -> Danish kept for that field');
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

test('echoed Danish (seen live on the Coronet recall) is retried field by field', async () => {
  const r = page('2026-nov-tilbagekald-smaakager-coronet');
  // JSON call echoes Danish; plain per-field calls translate.
  const ai = fakeAI((input) => input.response_format
    ? { response: JSON.parse(input.prompt.slice(input.prompt.indexOf('{'))) }
    : { response: `EN: ${input.prompt.split('\n').pop().slice(0, 30)}` });
  const en = await translateRecall(ai, r);
  assert.ok(ai.calls.length >= 4, 'one structured call + one per non-empty field');
  assert.match(en.title, /^EN: /);
  assert.match(en.reason, /^EN: /);
});

test('still Danish after the retries counts as a failure (retried later)', async () => {
  const r = page('2026-nov-tilbagekald-smaakager-coronet');
  const echoAll = fakeAI((input) => input.response_format
    ? { response: JSON.parse(input.prompt.slice(input.prompt.indexOf('{'))) }
    : { response: input.prompt.split('\n').pop() });
  await assert.rejects(translateRecall(echoAll, r), /untranslated/);
  const broken = fakeAI(() => { throw new Error('AI down'); });
  await assert.rejects(translateRecall(broken, r), /untranslated/);
});

test('a half-translated reply only retries the Danish fields (kebab title case)', async () => {
  const r = page('2026-nov-tilbagekald-af-oksekebab');
  const ai = fakeAI((input) => input.response_format
    ? { response: { title: r.title, lead: 'L', stores: 'S', reason: 'R', action: 'A' } }
    : { response: 'Recall of beef kebab' });
  const en = await translateRecall(ai, r);
  assert.equal(ai.calls.length, 2);
  assert.equal(en.title, 'Recall of beef kebab');
});
