// Danish -> English translation of a recall with Cloudflare Workers AI.
// One model call per recall; the result is stored with the recall and only
// redone when the Danish text changes (pages get "Opdateret" edits).

export const TRANSLATE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// The raw product list is not translated: it's mostly names, dates and codes,
// the app shows it as a table with English labels, and on big recalls it made
// the answer too long.
const FIELDS = ['title', 'lead', 'stores', 'reason', 'action'];

function sourceOf(recall) {
  return {
    title: recall.title || '',
    lead: recall.lead || '',
    stores: recall.stores?.text || recall.raw?.stores || '',
    reason: recall.reason?.text || '',
    action: recall.action?.text || '',
  };
}

/** Small stable hash (FNV-1a) of the Danish text, to skip unchanged recalls. */
export function textHash(recall) {
  const s = JSON.stringify(sourceOf(recall));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(FIELDS.map((f) => [f, { type: 'string' }])),
  required: FIELDS,
};

/**
 * Translate a recall. Returns { title, lead, stores, reason, action,
 * model, hash, at } or throws. `ai` is the Workers AI binding (env.AI).
 */
export async function translateRecall(ai, recall) {
  const source = sourceOf(recall);
  const prompt = [
    'You translate Danish food recall notices from the Danish Veterinary and Food Administration into plain, clear English for consumers living in Denmark.',
    'Translate every value of the JSON object below from Danish to English. Keep the same keys.',
    'Translate "Tilbagekald"/"tilbagekalder" as "Recall"/"is recalling" (never "withdrawal").',
    'Rules: keep product names, brand names, store/chain names, addresses, EAN numbers, lot codes and dates exactly as written; keep line breaks; do not add, drop or explain anything; an empty string stays empty.',
    '',
    JSON.stringify(source),
  ].join('\n');

  // 1) All fields in one structured call.
  let data = {};
  try {
    const out = await ai.run(TRANSLATE_MODEL, {
      prompt,
      max_tokens: 3000,
      temperature: 0.1,
      response_format: { type: 'json_schema', json_schema: SCHEMA },
    });
    data = out?.response ?? out;
    if (typeof data === 'string') {
      const m = data.match(/\{[\s\S]*\}/);
      data = JSON.parse(m ? m[0] : data);
    }
  } catch {
    data = {}; // fall through to field-by-field
  }
  const result = {};
  for (const f of FIELDS) {
    const v = data?.[f];
    result[f] = typeof v === 'string' && v.trim() ? v.trim() : source[f];
  }

  // 2) Seen live: the model sometimes echoes the Danish back. Retry each
  //    unchanged field on its own with a plain prompt (no JSON mode).
  for (const f of FIELDS) {
    if (!source[f] || result[f] !== source[f]) continue;
    try {
      const out = await ai.run(TRANSLATE_MODEL, {
        prompt: [
          'Translate the following Danish text into plain English for a consumer.',
          'Translate "Tilbagekald" as "Recall". Keep product names, brands, store names, addresses, numbers and dates as written.',
          'Reply with the English translation only, no quotes or comments.',
          '',
          source[f],
        ].join('\n'),
        max_tokens: 1500,
        temperature: 0.1,
      });
      const raw = typeof out?.response === 'string' ? out.response : '';
      const v = raw.trim().replace(/^["“]|["”]$/g, '');
      if (v) result[f] = v;
    } catch {
      // keep Danish for this field
    }
  }

  // Still Danish where it matters: fail so it's retried later.
  if (source.reason && result.reason === source.reason) throw new Error('model returned untranslated text');
  return { ...result, model: TRANSLATE_MODEL, hash: textHash(recall), at: new Date().toISOString() };
}
