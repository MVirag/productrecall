// Tiny, dependency-free HTML helpers. The recall pages are simple CMS output,
// so we only need entity decoding and "HTML fragment -> lines of text".
// (Cloudflare Workers' free plan has a 10 ms CPU budget, so avoid a full DOM.)

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aelig: 'æ', AElig: 'Æ', oslash: 'ø', Oslash: 'Ø', aring: 'å', Aring: 'Å',
  auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü',
  eacute: 'é', Eacute: 'É', egrave: 'è', aacute: 'á', oacute: 'ó', iacute: 'í',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', times: '×',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bdquo: '„', deg: '°', frac12: '½',
  shy: '', zwnj: '', zwj: '',
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return e in NAMED ? NAMED[e] : m;
  });
}

/** Normalise whitespace, drop zero-width characters. */
export function clean(s) {
  return s
    .replace(/[​‌‍﻿­]/g, '')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** Strip tags from a fragment and return clean text. */
export function text(fragment) {
  return clean(decodeEntities(fragment.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')));
}

const BLOCK = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|table|section)\b[^>]*>/gi;

/**
 * Turn an HTML fragment into an array of lines. Headings are returned as
 * { heading: 'text' } markers; bold "Label:" spans at the start of a block
 * are also flagged as headings so the old 2021/2022 layouts work too.
 */
export function toLines(fragment) {
  let s = fragment
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    // Mark headings before the generic block split.
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, t) => `\n\u0001${t}\n`)
    // Bold labels like <strong>Årsag:</strong> or <span style="font-weight: bolder">Solgt i:</span>
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => (/:\s*$/.test(text(t)) ? `\n\u0001${t}\n` : t))
    .replace(/<span[^>]*font-weight:\s*(?:bold|bolder|[6-9]00)[^>]*>([\s\S]*?)<\/span>/gi, (_, t) =>
      (/:\s*$/.test(text(t)) ? `\n\u0001${t}\n` : t))
    .replace(BLOCK, '\n');
  const out = [];
  for (const raw of s.split('\n')) {
    const isHeading = raw.includes('\u0001');
    const t = text(raw.replace(/\u0001/g, ''));
    if (!t) continue;
    out.push(isHeading ? { heading: t.replace(/:\s*$/, '') } : t);
  }
  return out;
}
