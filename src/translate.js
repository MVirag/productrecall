// Danish -> English translation of a recall with Cloudflare Workers AI.
//
// Seen live (27 Nov 2026): the model can return Danish unchanged, and once
// returned an invented recall (a SuperBrugsen chicken product) as the
// "translation" of a REMA 1000 peas recall. So every translated field is
// checked before use, and any field that fails keeps Fødevarestyrelsen's
// Danish text. A translation is never more trustworthy than its checks.

import { detectStores } from '../public/shared/chains.js';

export const TRANSLATE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// Bump to discard every stored translation made by older, weaker code.
export const TRANSLATE_VERSION = 3;
// The raw product list is not translated: names, dates and codes are shown
// as a table with English labels anyway.
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

/** Stable hash (FNV-1a) of the Danish text + translator version. */
export function textHash(recall) {
  const s = `v${TRANSLATE_VERSION}:${JSON.stringify(sourceOf(recall))}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** A stored translation is shown only if it was made (and checked) by this version. */
export function isCurrentTranslation(en) {
  return !!en && en.version === TRANSLATE_VERSION;
}

// ---------------------------------------------------------------- checks

const DA_WORDS = /(?<![\p{L}])(?:og|er|det|den|af|til|på|med|der|som|ikke|har|kan|bør|du|en|et|fra|ved|hvor|eller|produktet|produkterne|butikken|solgt|tilbagekald\p{L}*)(?![\p{L}])/giu;
const EN_WORDS = /\b(?:the|and|is|are|of|to|in|on|with|that|not|has|have|can|should|you|from|at|where|or|product|products|store|stores|sold|recall\w*)\b/gi;

export function looksDanish(text) {
  const da = (text.match(DA_WORDS) || []).length + (text.match(/[æøå]/gi) || []).length / 3;
  const en = (text.match(EN_WORDS) || []).length;
  return da > en;
}

const numbers = (s) => (s.match(/\d+/g) || []).filter((n) => n.length >= 2);

/**
 * Is `out` an acceptable English rendering of `src`? Returns '' when it
 * passes, otherwise the reason it was rejected.
 */
export function checkTranslation(src, out) {
  if (!out || !out.trim()) return 'empty';
  if (out.trim() === src.trim()) return 'unchanged';
  if (looksDanish(out)) return 'not English';
  const s = detectStores(src);
  const known = new Set([...s.chains, ...s.groups]);
  const o = detectStores(out);
  const invented = [...o.chains, ...o.groups].filter((c) => !known.has(c));
  if (invented.length) return `stores not in the original: ${invented.join(', ')}`;
  const missing = numbers(src).filter((n) => !out.includes(n));
  if (missing.length) return `numbers missing: ${missing.slice(0, 3).join(', ')}`;
  const ratio = out.length / Math.max(1, src.length);
  if (src.length > 40 && (ratio < 0.5 || ratio > 2.2)) return 'length differs too much';
  return '';
}

// ---------------------------------------------------------------- translate

function promptFor(text) {
  return [
    'Translate the following Danish text from a Danish food recall notice into plain English for a consumer.',
    'Translate "Tilbagekald" as "Recall". Keep product names, brands, store names, addresses, numbers and dates exactly as written.',
    'Translate only what is there. Do not add, remove or invent anything.',
    'Reply with the English translation only, no quotes or comments.',
    '',
    text,
  ].join('\n');
}

/**
 * Translate a recall field by field. Returns { title, lead, stores, reason,
 * action, checked: { field: true | reason }, model, version, hash, at }.
 * Fields that fail a check keep the Danish text. Throws if nothing passed.
 */
export async function translateRecall(ai, recall) {
  const source = sourceOf(recall);
  const result = {};
  const checked = {};
  for (const f of FIELDS) {
    result[f] = source[f];
    if (!source[f]) continue;
    let out = '';
    try {
      const res = await ai.run(TRANSLATE_MODEL, { prompt: promptFor(source[f]), max_tokens: 1500, temperature: 0 });
      out = typeof res?.response === 'string' ? res.response.trim().replace(/^["“]|["”]$/g, '') : '';
    } catch (e) {
      checked[f] = `error: ${String(e.message || e).slice(0, 80)}`;
      continue;
    }
    const problem = checkTranslation(source[f], out);
    if (problem) checked[f] = problem;
    else {
      result[f] = out;
      checked[f] = true;
    }
  }
  if (!FIELDS.some((f) => checked[f] === true)) {
    const why = FIELDS.filter((f) => source[f]).map((f) => `${f}: ${checked[f]}`).join('; ');
    throw new Error(`no field passed the checks (${why})`.slice(0, 300));
  }
  return { ...result, checked, model: TRANSLATE_MODEL, version: TRANSLATE_VERSION, hash: textHash(recall), at: new Date().toISOString() };
}
