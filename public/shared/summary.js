// Short "5-second" summary used by the feed card and the push notification,
// plus the decision of whether a recall should notify a given user.

import { matchMyStores } from './chains.js';
import { matchWords } from './words.js';

export const REASON_LABELS = {
  listeria: { da: 'Listeria', en: 'Listeria' },
  salmonella: { da: 'Salmonella', en: 'Salmonella' },
  ecoli: { da: 'E. coli', en: 'E. coli' },
  allergen: { da: 'Ikke-deklareret allergen', en: 'Undeclared allergen' },
  foreign_body: { da: 'Fremmedlegeme', en: 'Foreign body' },
  mycotoxin: { da: 'Mykotoksiner', en: 'Mycotoxins' },
  mould: { da: 'Mug', en: 'Mould' },
  pests: { da: 'Skadedyr/insekter', en: 'Insects/pests' },
  pesticide: { da: 'Pesticidrester', en: 'Pesticide residue' },
  botulism: { da: 'Botulisme', en: 'Botulism' },
  virus: { da: 'Virus', en: 'Virus' },
  bse_material: { da: 'Risikomateriale (kvæg)', en: 'Prohibited cattle material' },
  chemical: { da: 'Kemisk stof', en: 'Chemical contaminant' },
  bacteria: { da: 'Bakterier', en: 'Bacteria' },
  spoilage: { da: 'Fordærvet', en: 'Spoiled' },
  other: { da: 'Se opslaget', en: 'See notice' },
};

const FOREIGN = {
  metal: { da: 'metal', en: 'metal' }, glas: { da: 'glas', en: 'glass' },
  plast: { da: 'plastik', en: 'plastic' }, sten: { da: 'sten', en: 'stone' }, træ: { da: 'træ', en: 'wood' },
};

const ALLERGEN_EN = {
  mælk: 'milk', æg: 'egg', gluten: 'gluten', hvede: 'wheat', jordnødder: 'peanuts', nødder: 'nuts',
  soja: 'soy', selleri: 'celery', sennep: 'mustard', sesam: 'sesame', sulfit: 'sulphites',
  lupin: 'lupin', fisk: 'fish', krebsdyr: 'crustaceans', bløddyr: 'molluscs',
};

export const ACTION_LABELS = {
  return_or_discard: { da: 'Aflever i butikken eller kassér', en: 'Return to store or discard' },
  discard: { da: 'Kassér', en: 'Discard' },
  see_notice: { da: 'Se opslaget', en: 'See notice' },
};

export function reasonLabel(reason, lang = 'da') {
  if (!reason) return REASON_LABELS.other[lang];
  const base = (REASON_LABELS[reason.category] || REASON_LABELS.other)[lang];
  if (reason.category === 'allergen' && reason.allergens?.length) {
    const names = reason.allergens.map((a) => (lang === 'en' ? ALLERGEN_EN[a] || a : a));
    return lang === 'en' ? `Undeclared ${names.join(', ')}` : `Ikke-deklareret ${names.join(', ')}`;
  }
  if (reason.category === 'foreign_body' && FOREIGN[reason.detail]) {
    return `${base}: ${FOREIGN[reason.detail][lang]}`;
  }
  return base;
}

export function actionLabel(action, lang = 'da') {
  const a = (ACTION_LABELS[action?.kind] || ACTION_LABELS.see_notice)[lang];
  if (action?.allergyOnly) return lang === 'en' ? `If allergic: ${a.toLowerCase()}` : `Ved allergi: ${a.toLowerCase()}`;
  return a;
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** "Bedst før 07.04.2028 +1" / "Alle datoer" / "Lot L26…" */
export function datesLabel(product, lang = 'da') {
  if (!product) return '';
  if (product.allDates) return lang === 'en' ? 'All dates' : 'Alle datoer';
  const pick = (list, da, en) => {
    if (!list?.length) return '';
    const more = list.length > 1 ? ` +${list.length - 1}` : '';
    return `${lang === 'en' ? en : da} ${fmtDate(list[0].iso)}${more}`;
  };
  return (
    pick(product.bestBefore, 'Bedst før', 'Best before') ||
    pick(product.useBy, 'Sidste anv.', 'Use by') ||
    (product.lot?.length ? `Lot ${product.lot[0].slice(0, 24)}` : '')
  );
}

/** Store label, preferring the user's own chains. */
export function storeLabel(recall, myChains = [], lang = 'da') {
  const m = matchMyStores(recall.stores, myChains);
  const mine = [...m.direct, ...m.viaGroup];
  if (mine.length) return mine.slice(0, 2).join(', ') + (mine.length > 2 ? ` +${mine.length - 2}` : '');
  const named = [...(recall.stores?.chains || []), ...(recall.stores?.groups || [])];
  if (named.length) return named.slice(0, 2).join(', ') + (named.length > 2 ? ` +${named.length - 2}` : '');
  if (recall.stores?.nationwide) return lang === 'en' ? 'Supermarkets nationwide' : 'Supermarkeder i hele landet';
  return lang === 'en' ? 'Shops: see notice' : 'Butikker: se opslag';
}

/** Card / notification fields. */
export function summarize(recall, settings = {}, lang = settings.lang || 'da') {
  const myChains = settings.chains || [];
  const p = recall.products?.[0];
  const extra = (recall.products?.length || 0) - 1;
  const product = p?.name
    ? p.name + (extra > 0 ? (lang === 'en' ? ` +${extra} more` : ` +${extra} flere`) : '')
    : recall.title.replace(/^tilbagekald(?:else)?\s*(?:af|[-:–])?\s*/iu, '');
  const stores = matchMyStores(recall.stores, myChains);
  return {
    store: storeLabel(recall, myChains, lang),
    product,
    size: p?.size && !p.name?.includes(p.size) ? p.size : '',
    dates: datesLabel(p, lang),
    reason: reasonLabel(recall.reason, lang),
    action: actionLabel(recall.action, lang),
    mine: stores.direct.length > 0 || stores.viaGroup.length > 0,
    nationwide: stores.nationwide,
    viaGroup: stores.direct.length === 0 && stores.viaGroup.length > 0,
  };
}

/**
 * Should this recall notify this user, and why?
 * settings = { chains: [], mode: 'all' | 'mine', words: [] }
 */
export function decide(recall, settings = {}) {
  const words = matchWords(recall, settings.words);
  const stores = matchMyStores(recall.stores, settings.chains);
  const mineOrNationwide = stores.mine;
  const notify = settings.mode === 'mine' ? mineOrNationwide || words.length > 0 : true;
  return { notify, words, stores, highlight: stores.direct.length > 0 || stores.viaGroup.length > 0 || words.length > 0 };
}

/** Push notification payload. */
export function notificationFor(recall, settings = {}) {
  const lang = settings.lang || 'da';
  const s = summarize(recall, settings, lang);
  const d = decide(recall, settings);
  const flag = s.mine ? (lang === 'en' ? '⚠ Your store: ' : '⚠ Din butik: ') : d.words.length ? '⚠ ' : '';
  const title = `${flag}${s.store} · ${s.product}`;
  const body = [s.size, s.dates, s.reason, s.action].filter(Boolean).join(' · ');
  return {
    title: title.slice(0, 120),
    body: body.slice(0, 240),
    tag: recall.id,
    url: `/#/recall/${encodeURIComponent(recall.id)}`,
    image: recall.image || undefined,
  };
}
