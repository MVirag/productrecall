// Recall categories taken from Fødevarestyrelsen's own wording.
// The app does not judge risk itself: it finds the sentence in the notice
// that states the risk, files the recall under that statement and shows the
// sentence as a quote. Nothing recognised -> "unstated" (never silenced by default).

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

// First rule whose wording appears in the notice wins. Order matters:
// "not acute" beats the generic health wording around it, and an explicit
// health statement beats "risk can't be ruled out".
const RULES = [
  ['allergy', /allergi(?:sk)?e? reaktion|allergi eller overfølsomhed/i],
  ['notacute', /ikke tale om en akut|ikke opleve akutte|ingen akutte?\b/i],
  ['health', /smitte|symptomer|sygdom|sygdomsfremkaldende|skader i|sundhedsrisiko|forgiftning|infektion/i],
  ['possible', /risiko[^.]*ikke (?:kan )?udelukkes|ikke udelukke[^.]*risiko/i],
  ['unfit', /uegnet som fødevare/i],
];

// Stock sentences on many notices that say nothing about this recall's risk.
const BOILERPLATE = /^(?:hvis du oplever symptomer|ved tvivl kontaktes|læs mere)/i;

// The notice itself mentions especially vulnerable groups.
const VULNERABLE = /gravid|særligt modtagelige|svækket immunforsvar|små børn|ældre/i;

export const LEVELS = ['health', 'allergy', 'possible', 'notacute', 'unfit', 'unstated'];

export const LEVEL_LABELS = {
  health: { da: 'Kan gøre dig syg', en: 'Can make you ill', icon: '●', emoji: '🔴' },
  allergy: { da: 'Farlig ved allergi', en: 'Dangerous if allergic', icon: '▲', emoji: '🟠' },
  possible: { da: 'Sundhedsrisiko kan ikke udelukkes', en: 'Health risk cannot be ruled out', icon: '◆', emoji: '🟠' },
  notacute: { da: 'Ikke akut', en: 'Not acute', icon: '◆', emoji: '🟡' },
  unfit: { da: 'Uegnet som fødevare', en: 'Unfit to eat', icon: '○', emoji: '⚪' },
  unstated: { da: 'Risiko ikke angivet', en: 'Risk not stated', icon: '■', emoji: '❗' },
};

function sentences(text) {
  return (text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !BOILERPLATE.test(s));
}

/** Category + the authority's sentence that decided it. */
export function classify(recall) {
  // The reason section first; lead and advice only if it says nothing.
  const pools = [sentences(recall.reason?.text), sentences(`${recall.lead || ''} ${recall.action?.text || ''}`)];
  for (const pool of pools) {
    for (const [level, re] of RULES) {
      const quote = pool.find((s) => re.test(s));
      if (quote) return { level, quote };
    }
  }
  return { level: 'unstated', quote: '' };
}

function allergenHits(recall, profileAllergens = []) {
  const found = recall.reason?.allergens || [];
  return profileAllergens.filter((a) => (COVERS[a] || [a]).some((x) => found.includes(x)));
}

/**
 * severity(recall, { allergens: [], vulnerable: false, quiet: [] })
 * -> { level, quote, allergens: [...household hits], vulnerableMentioned,
 *      personal, silent }
 * `silent` is only ever the user's own choice (settings.quiet), never ours,
 * and a household allergen hit is never silent.
 */
export function severity(recall, profile = {}) {
  const { level, quote } = classify(recall);
  const hits = allergenHits(recall, profile.allergens);
  const text = `${recall.reason?.text || ''} ${recall.lead || ''}`;
  const vulnerableMentioned = VULNERABLE.test(text);
  const personal = hits.length > 0 || (!!profile.vulnerable && vulnerableMentioned);
  const silent = hits.length === 0 && (profile.quiet || []).includes(level);
  return { level, quote, allergens: hits, vulnerableMentioned, personal, silent };
}

/** Short label, personalised when the household's allergy matches. */
export function severityText(sev, lang = 'da') {
  if (sev.allergens.length) {
    const names = sev.allergens.map((a) => ALLERGEN_LABELS[a]?.[lang] || a).join(', ');
    return lang === 'en' ? `Allergy in your household: ${names}` : `Allergi i din husstand: ${names}`;
  }
  return LEVEL_LABELS[sev.level][lang];
}

/** Note shown when the notice itself names vulnerable groups. */
export function vulnerableText(lang = 'da') {
  return lang === 'en' ? 'The notice mentions pregnant women or other vulnerable groups'
    : 'Opslaget nævner gravide eller andre særligt udsatte';
}
