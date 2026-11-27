// Parsers for Fødevarestyrelsen's recall RSS feed and recall detail pages.
// Written against real pages saved in test/fixtures (2021–2026 layouts).

import { decodeEntities, clean, text, toLines } from './html.js';
import { detectStores } from '../public/shared/chains.js';

export const FEED_URL =
  'https://www.foedevarestyrelsen.dk/handlers/DynamicRss.ashx?id=8c2cdc12-6a58-43d1-8b4e-97aa96dedd0c';

/** Stable id from the recall URL, e.g. "2026-nov-tilbagekald-af-oksekebab". */
export function recallId(url) {
  const path = new URL(url).pathname.replace(/\/+$/, '');
  const i = path.indexOf('/tilbagekaldte-produkter/');
  const tail = i >= 0 ? path.slice(i + '/tilbagekaldte-produkter/'.length) : path.split('/').slice(-3).join('/');
  return tail.toLowerCase().replace(/[^a-z0-9æøå/-]/g, '').replace(/\//g, '-');
}

// ---------------------------------------------------------------- RSS

function tag(item, name) {
  const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!m) return '';
  return clean(decodeEntities(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '')));
}

/**
 * Parse the RSS feed. Only the first `limit` items are parsed (the feed holds
 * every recall since 2021, ~300 KB) to stay inside the Worker CPU budget.
 */
export function parseRss(xml, limit = Infinity) {
  const items = [];
  let pos = 0;
  while (items.length < limit) {
    const start = xml.indexOf('<item>', pos);
    if (start < 0) break;
    const end = xml.indexOf('</item>', start);
    if (end < 0) break;
    const raw = xml.slice(start, end);
    pos = end + 7;
    const link = tag(raw, 'link') || tag(raw, 'guid');
    if (!link || !/\/tilbagekaldte-produkter\//.test(link)) continue; // skip press releases etc.
    const pub = tag(raw, 'pubDate');
    items.push({
      id: recallId(link),
      url: link,
      title: tag(raw, 'title'),
      summary: tag(raw, 'description').replace(/\.\.$/, '…'),
      published: pub ? new Date(pub).toISOString() : null,
    });
  }
  return items;
}

// ---------------------------------------------------------------- detail page

const SECTION_RULES = [
  ['product', /hvilke[n]?\s+(?:fødevare|produkt|vare)|^produkt(?:er)?$|^vare(?:r|navn)?$/],
  ['stores', /solgt|hvor er produkt|forhandl/],
  ['reason', /hvorfor|årsag/],
  ['risk', /^risiko/],
  ['action', /hvad skal du|råd til forbruger/],
  ['recaller', /hvem tilbagekald|virksomhed/],
];

function sectionOf(heading) {
  const h = heading.toLowerCase();
  for (const [key, r] of SECTION_RULES) if (r.test(h)) return key;
  return null;
}

// Labels that appear inside product lines. Order matters only for display.
const LABELS = [
  ['name', /varenavn\s*:?/giu],
  ['brand', /(?:brand|mærke)\s*:/giu],
  ['size', /(?:netto[\s-]?indhold|netto[\s-]?vægt|vægt|størrelse|pakningsstørrelse)\s*:?/giu],
  ['useBy', /sidste\s+anvendelses[\s-]?dato(?:er|en)?\s*:?/giu],
  ['bestBefore', /bedst\s+før(?:[\s-]*dato(?:er|en)?)?\s*:?/giu],
  ['packed', /(?:pakkedato|pakket\s+den|produktionsdato|produceret\s+den)\s*:?/giu],
  ['ean', /(?:ean(?:[\s-]*(?:nr|kode|nummer|stregkode))?\.?(?:[^:\d]{0,30}:)?|stregkode(?:[^:\d]{0,30}:)?)\s*/giu],
  ['lot', /(?:lot(?:[\s-]*(?:nr|nummer|kode))?\.?|lotnummer|batch(?:[\s-]*(?:nr|nummer))?\.?|parti(?:[\s-]*(?:nr|nummer))?\.?|ref\.\s*nr\.?)\s*:?/giu],
  ['soldAt', /solgt\s+(?:i|hos|fra|på|til)\s*:?/giu],
  ['origin', /oprindelsesland\s*:?/giu],
  ['article', /(?:artikel|vare)[\s-]?nummer\s*:?/giu],
];

const WORD_BOUNDARY_BEFORE = /[a-zæøå0-9]/iu;

function findLabels(line) {
  // Paren depth per index, so "(solgt i Rema1000)" stays inside its value.
  const depth = [];
  let d = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '(') d++;
    depth.push(d);
    if (line[i] === ')') d = Math.max(0, d - 1);
  }
  const hits = [];
  for (const [field, r] of LABELS) {
    r.lastIndex = 0;
    let m;
    while ((m = r.exec(line))) {
      if (m[0].length === 0) { r.lastIndex++; continue; }
      const before = line[m.index - 1];
      if (before && WORD_BOUNDARY_BEFORE.test(before)) continue; // inside a word
      if (depth[m.index] > 0) continue;
      if (hits.some((h) => m.index < h.end && m.index + m[0].length > h.start)) continue;
      hits.push({ field, start: m.index, end: m.index + m[0].length });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

const MONTHS = {
  januar: 1, februar: 2, marts: 3, april: 4, maj: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, december: 12,
};

/** Extract dates from text like "7/4-2028 og 12/4-2028" or "31. august 2022". */
export function extractDates(s) {
  const out = [];
  const push = (raw, d, m, y) => {
    y = +y < 100 ? 2000 + +y : +y;
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return;
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!out.some((x) => x.iso === iso)) out.push({ raw, iso });
  };
  const num = /(?<!\d)(\d{1,2})\s?[./-]\s?(\d{1,2})(?:\s?[./-]\s?|\s)(\d{4}|\d{2})(?!\d)/g;
  let m;
  while ((m = num.exec(s))) push(m[0], +m[1], +m[2], m[3]);
  const named = /(?<!\d)(\d{1,2})\.?\s+(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)\s+(\d{4})/giu;
  while ((m = named.exec(s))) push(m[0], +m[1], MONTHS[m[2].toLowerCase()], m[3]);
  return out;
}

const SIZE_RE = /(?<![\w.,])(?:\d+(?:[.,]\d+)?\s*[x×]\s*)?\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(?:kg|g|gr|gram|ml|cl|dl|l|liter|stk\.?)(?![a-zæøå])(?:\s*\((?=[^)]*\d)[^)]*\))?/iu;
const NOTE_LINE = /^(?:pakket|produceret|fremstillet|importeret|distribueret|bemærk|obs|note|produktet|produkterne|tilbagekaldet|der er|det er|varen|varerne|følgende|læs mere)\b/iu;
const ALL_DATES = /alle\s+(?:bedst[\s-]*før|holdbarhed|sidste\s+anvendelses|datoer|lot|partier|udløbsdatoer)/iu;

function emptyProduct() {
  return { name: '', brand: '', size: '', bestBefore: [], useBy: [], packed: [], ean: [], lot: [], soldAt: '', allDates: false, notes: [] };
}

function hasAttributes(p) {
  return p.size || p.bestBefore.length || p.useBy.length || p.ean.length || p.lot.length || p.soldAt || p.allDates;
}

/** Parse the "Hvilken fødevare tilbagekaldes" lines into products. */
export function parseProducts(lines) {
  const products = [];
  let cur = emptyProduct();
  const commit = () => {
    if (cur.name || hasAttributes(cur)) products.push(cur);
    cur = emptyProduct();
  };

  let lastDateField = 'bestBefore';
  for (const line of lines) {
    // A line that is only dates continues the previous date label
    // ("Karen Volf Fuldkorn 250g bedst før:" / "22-09-2026 og 06-10-2026").
    const onlyDates = extractDates(line);
    if (onlyDates.length && !/[a-zæøå]{3,}/iu.test(line.replace(/\b(?:og|and|samt|\+)\b/giu, '').replace(/\d{1,2}\.\s?(?:januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)/giu, ''))) {
      for (const d of onlyDates) if (!cur[lastDateField].some((x) => x.iso === d.iso)) cur[lastDateField].push(d);
      continue;
    }
    if (ALL_DATES.test(line)) {
      cur.allDates = true;
      continue;
    }
    const hits = findLabels(line);
    const prefix = clean(line.slice(0, hits.length ? hits[0].start : line.length)).replace(/[,;:]$/, '').trim();
    const nameHit = hits.find((h) => h.field === 'name');

    let name = '';
    if (nameHit) {
      const next = hits.find((h) => h.start > nameHit.start);
      name = clean(line.slice(nameHit.end, next ? next.start : line.length));
    } else if (prefix && !NOTE_LINE.test(prefix) && prefix.split(' ').length <= 14 && /[a-zæøå]/iu.test(prefix)) {
      name = prefix;
    } else if (prefix && !hits.length) {
      cur.notes.push(prefix);
    }

    if (name) {
      // A new name after the current product already has a name -> new product.
      if (cur.name) commit();
      cur.name = name;
      if (!cur.size) {
        const sm = name.match(SIZE_RE);
        if (sm) cur.size = clean(sm[0]);
      }
      const brandInName = name.match(/af\s+mærket\s+([^\s,.(]+(?:\s+[A-ZÆØÅ][^\s,.(]*)?)/u);
      if (brandInName && !cur.brand) cur.brand = brandInName[1];
    }

    hits.forEach((h, i) => {
      const end = i + 1 < hits.length ? hits[i + 1].start : line.length;
      const value = clean(line.slice(h.end, end)).replace(/^[:\-–\s]+|[,;\s]+$/g, '');
      switch (h.field) {
        case 'name': break;
        case 'brand': if (value) cur.brand = value; break;
        case 'size': if (value) cur.size = value.replace(/\.$/, ''); break;
        case 'bestBefore':
        case 'useBy':
        case 'packed': {
          lastDateField = h.field;
          const ds = extractDates(value);
          cur[h.field].push(...ds.filter((x) => !cur[h.field].some((y) => y.iso === x.iso)));
          if (!ds.length && value && !/^[,.;]$/.test(value) && h.field !== 'packed') cur.notes.push(`${line.slice(h.start, h.end).trim()} ${value}`);
          break;
        }
        case 'ean': {
          const nums = value.match(/\d[\d ]{6,16}\d/g) || [];
          for (const n of nums) {
            const digits = n.replace(/ /g, '');
            if ((digits.length === 8 || digits.length === 13 || digits.length === 12 || digits.length === 14) && !cur.ean.includes(digits)) cur.ean.push(digits);
          }
          break;
        }
        case 'lot': if (value) cur.lot.push(value); break;
        case 'soldAt': if (value) cur.soldAt = cur.soldAt ? `${cur.soldAt}; ${value}` : value; break;
        default: if (value) cur.notes.push(`${line.slice(h.start, h.end).trim()} ${value}`);
      }
    });
  }
  commit();

  // Several bare names followed by shared attributes ("lår", "brystfilet", then
  // "Bedst før: ...") -> copy the dates/lots back onto the bare names.
  for (let i = products.length - 2; i >= 0; i--) {
    const p = products[i], next = products[i + 1];
    if (!p.bestBefore.length && !p.useBy.length && !p.lot.length && !p.allDates && !p.ean.length) {
      if (!p.bestBefore.length) p.bestBefore = [...next.bestBefore];
      if (!p.useBy.length) p.useBy = [...next.useBy];
      if (!p.lot.length) p.lot = [...next.lot];
      if (!p.soldAt) p.soldAt = next.soldAt;
      p.allDates = p.allDates || next.allDates;
      p.inheritedFromNext = true;
    }
  }
  return products;
}

// ---------------------------------------------------------------- reason / action

const ALLERGENS = [
  ['mælk', /mælk|laktose|mælkeprotein/u], ['æg', /(?<![a-zæøå])æg(?![a-zæøå])/u],
  ['gluten', /gluten/u], ['hvede', /hvede/u],
  ['jordnødder', /jordnød|peanut/u], ['nødder', /(?<!jord)nødder|hasselnød|mandel|mandler|cashew|valnød|pistacie|pekan/u],
  ['soja', /soja/u], ['selleri', /selleri/u], ['sennep', /sennep/u], ['sesam', /sesam/u],
  ['sulfit', /sulfit|svovldioxid/u], ['lupin', /lupin/u], ['fisk', /(?<![a-zæøå])fisk/u],
  ['krebsdyr', /krebsdyr|rejer/u], ['bløddyr', /bløddyr|muslinger/u],
];

const REASONS = [
  ['listeria', /listeria/iu],
  ['salmonella', /salmonella/iu],
  ['ecoli', /e\.?\s?coli|stec|vtec/iu],
  ['allergen', /ikke[\s-]?deklarer|udeklarer|ikke fremgår af mærkningen|allergen/iu],
  ['foreign_body', /fremmedlegem|metal|glas(?:skår|stykker)?(?![a-zæøå])|plast(?:stykker)?(?![a-zæøå])|sten(?![a-zæøå])|træsplint/iu],
  ['mycotoxin', /mykotoksin|aflatoksin|ochratoksin|patulin|deoxynivalenol/iu],
  ['mould', /(?<![a-zæøå])mug(?:dannelse)?(?![a-zæøå])|skimmel/iu],
  ['pests', /biller|møl(?![a-zæøå]{2})|insekt|skadedyr|larver|mider|gnaver|mus(?:e)?ekskrement/iu],
  ['pesticide', /pesticid|ethylenoxid|chlorpyrifos|2-chlorethanol/iu],
  ['botulism', /botulin|clostridium/iu],
  ['virus', /norovirus|hepatitis/iu],
  ['bse_material', /hjernevæv|risikomateriale/iu],
  ['chemical', /histamin|bly(?![a-zæøå])|kadmium|kviksølv|dioxin|pcb|alkaloid|for højt indhold/iu],
  ['bacteria', /bakterie|bacillus|staphylococcus|cronobacter|campylobacter/iu],
  ['spoilage', /fordærv|gæring|bombage|utæt/iu],
];

export function classifyReason(reasonText, extraText = '') {
  const t = `${reasonText} ${extraText}`;
  for (const [key, r] of REASONS) {
    if (!r.test(t)) continue;
    if (key === 'allergen') {
      const lower = t.toLowerCase();
      // Look for the allergen next to the "undeclared" wording first.
      const near = lower.match(/(?:ikke[\s-]?deklarer\w*|udeklarer\w*)\s+(\S+(?:\s+\S+)?)/u)?.[1] || '';
      const found = ALLERGENS.filter(([, a]) => a.test(near)).map(([n]) => n);
      const any = found.length ? found : ALLERGENS.filter(([, a]) => a.test(lower)).map(([n]) => n);
      return { category: key, allergens: any.slice(0, 3), sure: any.length > 0 };
    }
    if (key === 'foreign_body') {
      const what = t.match(/metal|glas|plast|sten|træ/iu)?.[0]?.toLowerCase();
      return { category: key, detail: what || '', sure: true };
    }
    return { category: key, sure: true };
  }
  return { category: 'other', sure: false };
}

export function classifyAction(actionText) {
  const t = actionText.toLowerCase();
  const back = /(?:levere|aflevere|tage|returnere|bringe)\s+(?:\S+\s+){0,3}tilbage|returner|tilbage til butikken/u.test(t);
  const discard = /kasser/u.test(t);
  const allergyOnly = /(?:har du|er du|personer med)\s+(?:\S+\s+){0,2}(?:allergi|overfølsom)/u.test(t);
  const kind = back ? 'return_or_discard' : discard ? 'discard' : 'see_notice';
  return { kind, allergyOnly, sure: back || discard };
}

// ---------------------------------------------------------------- page

function pickImage(head) {
  const m = head.match(/<img\b[^>]*\bsrc="([^"]+)"/i);
  if (!m) return null;
  try {
    const u = new URL(decodeEntities(m[1]), 'https://www.foedevarestyrelsen.dk');
    if (!/gopublic\.dk$|foedevarestyrelsen\.dk$/.test(u.hostname)) return null;
    u.searchParams.set('width', '960');
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Parse one recall detail page.
 * @param {string} html  full page HTML
 * @param {object} meta  RSS item ({ id, url, title, summary, published })
 */
export function parseDetail(html, meta = {}) {
  const start = html.indexOf('<h1');
  const footer = html.indexOf('<footer', start);
  const main = html.slice(start, footer > 0 ? footer : undefined);

  const title = text(main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') || meta.title || '';
  const published = main.match(/data-date="([^"]+)"/)?.[1] || meta.published || null;
  const leadHtml = main.match(/<p class="lead">([\s\S]*?)<\/p>/i)?.[1] || '';
  const lead = text(leadHtml);
  const updated = lead.match(/opdateret\b.*$/iu)?.[0] || '';

  const textStart = main.indexOf('<div class="text">');
  const head = textStart > 0 ? main.slice(0, textStart) : '';
  const image = pickImage(head.replace(/<div class="labels">[\s\S]*?<\/div>/, ''));

  const body = textStart > 0 ? main.slice(textStart) : main;
  const lines = toLines(body);

  const sections = {};
  let current = null;
  for (const l of lines) {
    if (typeof l === 'object') {
      current = sectionOf(l.heading) || current;
      continue;
    }
    if (!current) continue;
    (sections[current] ||= []).push(l);
  }
  // Trim the "Læs mere ..." link lines.
  for (const k of Object.keys(sections)) sections[k] = sections[k].filter((l) => !/^læs mere\b/iu.test(l));

  const uncertain = [];
  const products = parseProducts(sections.product || []);
  if (!products.length) uncertain.push('products');

  // Brand: explicit label > "af mærket X" > first word of the product name.
  for (const p of products) {
    if (!p.brand && p.name) {
      p.brand = p.name.split(/[\s,]+/)[0].replace(/[^\p{L}\p{N}'&.-]/gu, '');
      p.brandGuessed = true;
    }
  }
  if (products.some((p) => p.brandGuessed)) uncertain.push('brand');
  if (products.some((p) => !p.bestBefore.length && !p.useBy.length && !p.lot.length && !p.allDates)) uncertain.push('dates');

  const storesText = [
    ...(sections.stores || []),
    ...products.map((p) => p.soldAt).filter(Boolean),
  ].join(' | ');
  const stores = { text: storesText, ...detectStores(storesText) };
  if (!stores.chains.length && !stores.groups.length && !stores.nationwide) uncertain.push('stores');

  const reasonText = [...(sections.reason || []), ...(sections.risk || [])].join(' ');
  const reason = { text: reasonText, ...classifyReason(reasonText, `${title} ${lead}`) };
  if (!reason.sure) uncertain.push('reason');

  const actionText = (sections.action || []).join(' ') || lead;
  const action = { text: actionText, ...classifyAction(actionText) };
  if (!action.sure) uncertain.push('action');

  return {
    id: meta.id || (meta.url ? recallId(meta.url) : ''),
    url: meta.url || '',
    title,
    lead,
    updated,
    published,
    image,
    products,
    stores,
    reason,
    action,
    recaller: (sections.recaller || []).join(', '),
    uncertain,
    raw: {
      product: (sections.product || []).join('\n'),
      stores: (sections.stores || []).join('\n'),
      reason: reasonText,
      action: (sections.action || []).join('\n'),
    },
  };
}

/** Minimal recall built from the RSS item alone (used if the page fails). */
export function fromRssOnly(item) {
  return {
    id: item.id, url: item.url, title: item.title, lead: item.summary, updated: '',
    published: item.published, image: null, products: [],
    stores: { text: '', chains: [], groups: [], nationwide: false },
    reason: { text: '', ...classifyReason('', `${item.title} ${item.summary}`) },
    action: { text: item.summary, ...classifyAction(item.summary) },
    recaller: '', uncertain: ['detail_page'], raw: {},
  };
}
