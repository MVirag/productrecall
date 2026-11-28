// Barcode (EAN / GTIN) matching: does a scanned code appear in a recall?
// Shared by the app and the tests. Pure functions, no DOM.
//
// Codes are compared as 14-digit GTINs (shorter codes zero-padded), so the
// same product matches whether a reader reports it as EAN-13, UPC-A (12
// digits, = EAN-13 with a leading 0) or EAN-8.

export const digitsOnly = (s) => String(s ?? '').replace(/\D/g, '');

/** GS1 check digit test for 8, 12, 13 and 14 digit codes. */
export function hasValidCheckDigit(code) {
  const c = digitsOnly(code);
  if (![8, 12, 13, 14].includes(c.length)) return false;
  const d = c.split('').map(Number);
  const check = d.pop();
  let sum = 0;
  d.reverse().forEach((x, i) => { sum += x * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

/** 14-digit key for a code with 8-14 digits, or null. */
export function gtin14(code) {
  const c = digitsOnly(code);
  return c.length >= 8 && c.length <= 14 ? c.padStart(14, '0') : null;
}

/**
 * Does the number printed in a notice stand for the scanned code?
 * - 'exact': the printed number is a valid code and equals the scan.
 * - 'loose': the printed number is NOT a valid code (a typo on the notice,
 *   seen live: 14 digits with a bad check digit) but its first 12 digits,
 *   which carry manufacturer and item, equal the scan's.
 * - null: no match.
 */
export function compareCodes(printed, scanned) {
  const p = digitsOnly(printed);
  const key = gtin14(scanned);
  if (!key || !hasValidCheckDigit(scanned)) return null;
  if (hasValidCheckDigit(p)) return gtin14(p) === key ? 'exact' : null;
  const s = digitsOnly(scanned);
  if (s.length === 13 && (p.length === 13 || p.length === 14) && p.slice(0, 12) === s.slice(0, 12)) return 'loose';
  return null;
}

/**
 * Find recall products whose barcode matches `code`.
 * Returns [{ recall, products: [product…], loose }] newest recall first.
 * `loose` is true when every hit came from a malformed number on the notice.
 */
export function matchRecalls(recalls, code) {
  if (!gtin14(code)) return [];
  const hits = [];
  for (const recall of recalls || []) {
    const products = [];
    let loose = true;
    for (const p of recall.products || []) {
      for (const printed of p.ean || []) {
        const m = compareCodes(printed, code);
        if (!m) continue;
        if (!products.includes(p)) products.push(p);
        if (m === 'exact') loose = false;
      }
    }
    if (products.length) hits.push({ recall, products, loose });
  }
  return hits.sort((a, b) => (b.recall.published || '').localeCompare(a.recall.published || ''));
}

/** How much of the feed can be matched by barcode at all. */
export function barcodeCoverage(recalls) {
  const list = recalls || [];
  const withEan = list.filter((r) => (r.products || []).some((p) => (p.ean || []).length)).length;
  return { recalls: list.length, withEan };
}

/** "5705 5181 8309 6" style grouping for display. */
export function formatCode(code) {
  const c = digitsOnly(code);
  if (c.length === 13) return `${c[0]} ${c.slice(1, 7)} ${c.slice(7)}`;
  if (c.length === 8) return `${c.slice(0, 4)} ${c.slice(4)}`;
  return c;
}
