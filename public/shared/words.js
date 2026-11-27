// Watch-word matching for Danish: compounds and inflections.
//   "mælk"  matches "letmælk", "mælken", "mælkeprodukter"
//   "letmælk" matches "mælk" (compound head)        "laks" ⇄ "røget laks"
//   "æg"    matches "æg", "æggene", "æggeblommer" but not "ægte"
// Shared by the Worker and the browser.

const LETTERS = /[a-zæøåäöüé0-9]+/gu;

export function normWord(s) {
  return (s || '').normalize('NFC').toLowerCase();
}

export function tokens(s) {
  return normWord(s).match(LETTERS) || [];
}

// Danish inflection endings, longest first (noun/adjective/definite/plural).
const SUFFIXES = ['erne', 'ene', 'ens', 'ets', 'ers', 'er', 'en', 'et', 'es', 'e', 's', 'r', 'n', 't'];
// Linking elements in compounds: "mælk-e-produkt", "pølse-s-..."
const LINKS = ['e', 's', ''];

/** Strip one inflection ending if the remaining stem is still long enough. */
export function stem(w) {
  for (const suf of SUFFIXES) {
    if (w.length - suf.length >= 3 && w.endsWith(suf)) return w.slice(0, -suf.length);
  }
  return w;
}

function isInflectionOf(token, word) {
  if (token === word) return true;
  if (!token.startsWith(word)) {
    // Doubled final consonant before an ending: "æg" -> "æggene", "kat" -> "katte"
    const last = word[word.length - 1];
    if (!token.startsWith(word + last)) return false;
    return SUFFIXES.includes(token.slice(word.length + 1)) || token.length === word.length + 1;
  }
  const rest = token.slice(word.length);
  return SUFFIXES.includes(rest);
}

/** Does a single-word watch term match a single token? */
export function wordMatchesToken(word, token) {
  if (!word || !token) return false;
  if (isInflectionOf(token, word)) return true;
  const w = stem(word);
  const t = stem(token);
  if (word.length <= 2) {
    // Very short words ("æg", "is"): exact/inflected, compound head ("hønseæg"),
    // or compound modifier with a doubled consonant/link ("æggeblomme").
    if (token.endsWith(word) && token.length > word.length + 2) return true;
    const last = word[word.length - 1];
    return token.startsWith(word + last + 'e') && token.length > word.length + 3;
  }
  if (w.length >= 3) {
    // Watch word inside a compound: "mælk" in "letmælk", "mælkeprodukt", "sødmælken".
    if (token.includes(w)) return true;
  }
  if (t.length >= 4) {
    // Compound watch word whose head is the token: "letmælk" vs "mælk",
    // "kyllingebryst" vs "brystet".
    for (const link of LINKS) {
      if (word.endsWith(link + t) && word.length > t.length + link.length + 1) return true;
    }
  }
  return false;
}

/**
 * Match one watch term (may be several words) against text.
 * Multi-word terms match if the whole phrase appears or if the last word
 * (the head noun in Danish) matches: "røget laks" ⇄ "laks".
 */
export function termMatches(term, text) {
  const tw = tokens(term);
  if (!tw.length) return false;
  const tt = tokens(text);
  if (tw.length > 1 && normWord(text).includes(tw.join(' '))) return true;
  const head = tw[tw.length - 1];
  return tt.some((t) => wordMatchesToken(head, t));
}

/** The searchable text of a recall for watch words. */
export function recallSearchText(recall) {
  const parts = [recall.title, recall.lead];
  for (const p of recall.products || []) parts.push(p.name, p.brand);
  if (recall.reason?.allergens) parts.push(...recall.reason.allergens);
  return parts.filter(Boolean).join(' \n ');
}

/** Returns the watch terms that match the recall. */
export function matchWords(recall, terms) {
  const text = recallSearchText(recall);
  return (terms || []).map((t) => t.trim()).filter(Boolean).filter((t) => termMatches(t, text));
}
