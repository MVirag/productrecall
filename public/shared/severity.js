// How serious is a recall, for this household?
// Levels: acute > allergy > longterm > quality. "other" = unknown reason,
// treated as urgent so nothing serious is ever silenced by mistake.

// The 14 EU allergens, keyed like the parser's allergen names.
export const ALLERGENS = [
  'gluten', 'krebsdyr', 'æg', 'fisk', 'jordnødder', 'soja', 'mælk',
  'nødder', 'selleri', 'sennep', 'sesam', 'sulfit', 'lupin', 'bløddyr',
];

export const ALLERGEN_LABELS = {
  gluten: { da: 'Gluten', en: 'Gluten' }, krebsdyr: { da: 'Krebsdyr', en: 'Crustaceans' },
  æg: { da: 'Æg', en: 'Egg' }, fisk: { da: 'Fisk', en: 'Fish' },
  jordnødder: { da: 'Jordnødder', en: 'Peanuts' }, soja: { da: 'Soja', en: 'Soy' },
  mælk: { da: 'Mælk', en: 'Milk' }, nødder: { da: 'Nødder', en: 'Tree nuts' },
  selleri: { da: 'Selleri', en: 'Celery' }, sennep: { da: 'Sennep', en: 'Mustard' },
  sesam: { da: 'Sesam', en: 'Sesame' }, sulfit: { da: 'Sulfit', en: 'Sulphites' },
  lupin: { da: 'Lupin', en: 'Lupin' }, bløddyr: { da: 'Bløddyr', en: 'Molluscs' },
};

// Parser allergen names that fall under a profile allergen.
const COVERS = { gluten: ['gluten', 'hvede'] };

const LEVEL_OF = {
  listeria: 'acute', salmonella: 'acute', ecoli: 'acute', foreign_body: 'acute',
  botulism: 'acute', virus: 'acute', bacteria: 'acute',
  allergen: 'allergy',
  mycotoxin: 'longterm', pesticide: 'longterm', chemical: 'longterm', bse_material: 'longterm',
  pests: 'quality', mould: 'quality', spoilage: 'quality',
};

// Extra risk for pregnant women, small children, elderly, weak immune system.
const VULNERABLE = new Set(['listeria', 'salmonella', 'ecoli', 'botulism']);

export const LEVEL_LABELS = {
  acute: { da: 'Akut risiko – spis den ikke', en: 'Acute risk – do not eat', icon: '●', short: { da: 'Akut', en: 'Acute' } },
  allergy: { da: 'Kun farlig ved allergi', en: 'Only a risk if allergic', icon: '▲', short: { da: 'Allergi', en: 'Allergy' } },
  longterm: { da: 'Langsigtet risiko – ingen akutte symptomer', en: 'Long-term risk – no acute symptoms', icon: '◆', short: { da: 'Langsigtet', en: 'Long-term' } },
  quality: { da: 'Uegnet som fødevare – ikke akut farlig', en: 'Unfit to eat – not acutely dangerous', icon: '○', short: { da: 'Uegnet', en: 'Unfit' } },
  other: { da: 'Se opslaget for risiko', en: 'See the notice for the risk', icon: '●', short: { da: 'Se opslag', en: 'See notice' } },
};

function allergenHits(recall, profileAllergens = []) {
  const found = recall.reason?.allergens || [];
  return profileAllergens.filter((a) => (COVERS[a] || [a]).some((x) => found.includes(x)));
}

/**
 * severity(recall, { allergens: [], vulnerable: false })
 * -> { level, urgent, personal, allergens: [...hits], vulnerable: bool }
 */
export function severity(recall, profile = {}) {
  const category = recall.reason?.category || 'other';
  let level = LEVEL_OF[category] || 'other';
  // Histamine poisoning is acute even though it's "chemical".
  if (category === 'chemical' && /histamin/i.test(recall.reason?.text || '')) level = 'acute';
  const hits = level === 'allergy' ? allergenHits(recall, profile.allergens) : [];
  const vulnerable = !!profile.vulnerable && VULNERABLE.has(category);
  const personal = hits.length > 0 || vulnerable;
  const urgent = level === 'acute' || level === 'other' || hits.length > 0;
  return { level, urgent, personal, allergens: hits, vulnerable };
}

/** One-line explanation for card/detail. */
export function severityText(sev, lang = 'da') {
  if (sev.level === 'allergy' && sev.allergens.length) {
    const names = sev.allergens.map((a) => ALLERGEN_LABELS[a]?.[lang] || a).join(', ');
    return lang === 'en' ? `Allergy in your household: ${names}` : `Allergi i din husstand: ${names}`;
  }
  const base = LEVEL_LABELS[sev.level][lang];
  if (sev.vulnerable) {
    return lang === 'en'
      ? `${base}. Extra serious for pregnant women and small children`
      : `${base}. Ekstra alvorlig for gravide og små børn`;
  }
  return base;
}
