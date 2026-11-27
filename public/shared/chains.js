// Danish grocery chains, the groups that own them, and store-text matching.
// Shared by the Worker (notifications) and the browser (highlighting).

export const DEFAULT_CHAINS = [
  'Netto', 'Føtex', 'Bilka', 'Rema 1000', 'Lidl', 'Aldi', 'SuperBrugsen',
  'Kvickly', 'Meny', 'Spar', '365discount', 'Løvbjerg',
];

// Known chains with the spellings Fødevarestyrelsen uses. Patterns run on
// normalised text (lowercase, NFC). Boundaries are explicit because \b does
// not treat æøå as word characters.
const L = '(?<![a-zæøåäöüé0-9])';
const R = '(?![a-zæøåäöüé0-9])';
const re = (body) => new RegExp(L + '(?:' + body + ')' + R, 'u');

export const CHAINS = {
  'Netto': re('netto(?!\\s*(?:indhold|vægt))'),
  'Føtex': re('føtex|fotex'),
  'Bilka': re('bilka'),
  'Rema 1000': re('rema\\s*-?\\s*1000|rema'),
  'Lidl': re('lidl'),
  'Aldi': re('aldi'),
  'SuperBrugsen': re('super\\s*-?\\s*brugsen'),
  'Kvickly': re('kvickly'),
  'Meny': re('meny'),
  'Spar': re('spar(?:-butikker)?'),
  '365discount': re('365\\s*discount|coop\\s*365'),
  'Løvbjerg': re('løvbjerg'),
  "Dagli'Brugsen": re("dagli'?\\s*brugsen"),
  'Lokal Brugsen': re('lokal\\s*brugsen'),
  'Brugsen': re('(?<!super\\s?|dagli\'?\\s?|lokal\\s?)brugsen'),
  'Irma': re('irma'),
  'Min Købmand': re('min\\s*købmand'),
  'Letkøb': re('letkøb'),
  'ABC Lavpris': re('abc(?:\\s*lavpris)?'),
  'Nemlig.com': re('nemlig(?:\\.com)?'),
  'Wolt Market': re('wolt(?:\\s*market)?'),
  'Normal': re('normal-butikker'),
  'Matas': re('matas'),
  'Fakta': re('fakta'),
  'Hjem-IS': re('hjem[\\s-]?is'),
  'Fleggaard': re('fleggaard'),
};

// Groups that are named instead of chains ("solgt hos Coop Danmark").
export const GROUPS = {
  'Coop': {
    pattern: re("coop(?!\\s*365)(?:'?s)?(?:\\s*danmark)?(?:-butikker)?|coop\\s*amba"),
    chains: ['SuperBrugsen', 'Kvickly', '365discount', "Dagli'Brugsen", 'Lokal Brugsen', 'Brugsen', 'Irma'],
  },
  'Salling Group': {
    pattern: re('salling(?:\\s*group)?|dansk\\s*supermarked'),
    chains: ['Netto', 'Føtex', 'Bilka'],
  },
  'Dagrofa': {
    pattern: re('dagrofa(?:-butikker)?'),
    chains: ['Meny', 'Spar', 'Min Købmand', 'Letkøb'],
  },
};

// "Sold in supermarkets nationwide" without naming anyone.
const NATIONWIDE = /supermarked|dagligvare|detailhandl|landsdækkende|forhandlere i hele landet|butikker i hele landet/u;

export function norm(s) {
  return (s || '').normalize('NFC').toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ');
}

/**
 * Detect chains in a free-text "where sold" string.
 * Returns { chains: [...named chains], groups: [...named groups], nationwide }.
 */
export function detectStores(storesText) {
  const t = norm(storesText);
  const chains = Object.keys(CHAINS).filter((c) => CHAINS[c].test(t));
  const groups = Object.keys(GROUPS).filter((g) => GROUPS[g].pattern.test(t));
  const nationwide = chains.length === 0 && groups.length === 0 && NATIONWIDE.test(t);
  return { chains, groups, nationwide };
}

function chainKey(name) {
  const n = norm(name).replace(/[^a-zæøå0-9]/g, '');
  return Object.keys(CHAINS).find((c) => norm(c).replace(/[^a-zæøå0-9]/g, '') === n);
}

/**
 * Does a recall concern any of the user's chains?
 * recall.stores = { text, chains, groups, nationwide } (from the parser).
 * Returns { direct: [...], viaGroup: [...], nationwide, mine }.
 */
export function matchMyStores(stores, myChains) {
  const direct = [];
  const viaGroup = [];
  const text = norm(stores?.text);
  for (const mine of myChains || []) {
    const key = chainKey(mine);
    if (key) {
      if (stores?.chains?.includes(key)) direct.push(mine);
      else if ((stores?.groups || []).some((g) => GROUPS[g].chains.includes(key))) viaGroup.push(mine);
    } else {
      // A custom chain the user typed: plain normalised substring search.
      const n = norm(mine).trim();
      if (n.length >= 2 && text.includes(n)) direct.push(mine);
    }
  }
  const nationwide = !!stores?.nationwide;
  return { direct, viaGroup, nationwide, mine: direct.length > 0 || viaGroup.length > 0 || nationwide };
}
