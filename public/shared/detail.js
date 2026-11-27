// Detail-screen helpers: which products are sold in the reader's stores, a
// de-duplicated "where sold" list, and which severity levels need cautious wording.

import { detectStores, matchMyStores, norm } from './chains.js';

// Levels where a missed recall could hurt: "no match" must never read as "safe".
const CAREFUL = new Set(['health', 'allergy', 'possible', 'unstated']);
export const isCareful = (level) => CAREFUL.has(level);

/**
 * Split a recall's products into those sold in the reader's chains and the rest.
 * With no chains set, nothing is flagged and every product is "others".
 */
export function splitProducts(products = [], myChains = []) {
  if (!myChains.length) return { mine: [], others: [...products] };
  const mine = [];
  const others = [];
  for (const p of products) {
    const stores = { text: p.soldAt || '', ...detectStores(p.soldAt || '') };
    (p.soldAt && matchMyStores(stores, myChains).mine ? mine : others).push(p);
  }
  return { mine, others };
}

/** "A | B | A" or "Nemlig.com , Bilka" -> ["A", "B"] / ["Nemlig.com, Bilka"], each entry once. */
export function uniqueStores(text = '') {
  const seen = new Set();
  const out = [];
  for (const raw of String(text).split('|')) {
    const entry = raw.replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
    const key = norm(entry);
    if (entry && !seen.has(key)) { seen.add(key); out.push(entry); }
  }
  return out;
}
