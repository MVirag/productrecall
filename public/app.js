import { STRINGS } from './i18n.js';
import { DEFAULT_CHAINS } from './shared/chains.js';
import { summarize, decide } from './shared/summary.js';
import { ALLERGENS, ALLERGEN_LABELS, LEVEL_LABELS, LEVELS, vulnerableText, coversAllergen } from './shared/severity.js';
import { icon } from './icons.js';
import { isCareful, splitProducts, uniqueStores } from './shared/detail.js';
import { digitsOnly, hasValidCheckDigit, matchRecalls, barcodeCoverage, formatCode } from './shared/ean.js';

// ------------------------------------------------------------ settings (on device)

const SETTINGS_KEY = 'tilbagekald.settings.v1';
const defaults = { lang: 'da', mode: 'all', chains: [], extraChains: [], words: [], allergens: [], vulnerable: false, quiet: [], theme: 'system' };

function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}
let settings = loadSettings();
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  syncSubscription();
}
const t = (k) => STRINGS[settings.lang][k] ?? STRINGS.da[k] ?? k;
const SHARED_KEYS = ['chains', 'extraChains', 'mode', 'words', 'lang', 'allergens', 'vulnerable', 'quiet'];
const serverSettings = () => ({
  chains: settings.chains, mode: settings.mode, words: settings.words, lang: settings.lang,
  allergens: settings.allergens, vulnerable: settings.vulnerable, quiet: settings.quiet,
});

// Settings travel in a link: #/import/<base64url JSON>. Nothing goes to a server.
function encodeSettings() {
  const json = JSON.stringify(Object.fromEntries(SHARED_KEYS.map((k) => [k, settings[k]])));
  return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeSettings(code) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  const out = {};
  const strList = (v) => (Array.isArray(v) ? v.map(String).map((x) => x.slice(0, 40)).slice(0, 40) : []);
  out.chains = strList(obj.chains);
  out.extraChains = strList(obj.extraChains);
  out.words = strList(obj.words);
  out.allergens = strList(obj.allergens).filter((a) => ALLERGENS.includes(a));
  out.mode = obj.mode === 'mine' ? 'mine' : 'all';
  out.lang = obj.lang === 'en' ? 'en' : 'da';
  out.vulnerable = obj.vulnerable === true;
  out.quiet = strList(obj.quiet).filter((l) => LEVELS.includes(l));
  return out;
}

async function share({ title, text, url }, msgEl) {
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return; }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    if (msgEl) msgEl.textContent = t('copied');
  } catch (e) {
    if (e?.name !== 'AbortError' && msgEl) msgEl.textContent = url;
  }
}

// ------------------------------------------------------------ tiny DOM helper

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// One date format everywhere: dd.mm.yyyy, as printed on Danish packs and notices (both languages).
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Copenhagen' }) : '');
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString(settings.lang === 'en' ? 'en-GB' : 'da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('never'));
const fmtDay = (d) => d.iso.split('-').reverse().join('.');

// ------------------------------------------------------------ data

let cache = { recalls: null, lastPoll: null, offline: false };

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.status), { data, status: res.status });
  return data;
}

// `via` ("scan") tells the server why the list is wanted; the request is the same one the app needs anyway.
async function loadRecalls(via) {
  try {
    const d = await api(via ? `/api/recalls?via=${via}` : '/api/recalls');
    cache = { recalls: d.recalls, lastPoll: d.lastPoll, offline: d._fromCache || false };
  } catch (e) {
    if (!cache.recalls) throw e;
  }
  return cache;
}

// ------------------------------------------------------------ push

async function swReg() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.ready;
}

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await swReg();
  return reg?.pushManager ? reg.pushManager.getSubscription() : null;
}

async function subscribe() {
  const cfg = await api('/api/config');
  if (!cfg.vapidPublicKey) throw new Error(t('notifNotConfigured'));
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(t('notifDenied'));
  const reg = await swReg();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(cfg.vapidPublicKey) });
  await api('/api/subscribe', { subscription: sub.toJSON(), settings: serverSettings() });
  return sub;
}

async function unsubscribe() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api('/api/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

let syncTimer;
function syncSubscription() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const sub = await currentSubscription().catch(() => null);
    if (sub) api('/api/subscribe', { subscription: sub.toJSON(), settings: serverSettings() }).catch(() => {});
  }, 600);
}

// ------------------------------------------------------------ views

const main = () => {
  const el = document.getElementById('main');
  // replaceChildren() would print "null" for skipped optional parts.
  return { replaceChildren: (...nodes) => el.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false)) };
};

function setTitle(text) {
  document.title = text ? `${text} · ${t('appName')}` : t('appName');
}

// Detail screen: the recall as a door sticker, a die-cut badge holding the level's shape plus the verdict.
// A note under the verdict says who is especially at risk, when the notice names them.
function sevSticker(s, note = null) {
  const lvl = s.severity.level;
  return h('div', { class: `sticker sev-${lvl}` },
    h('div', { class: 'die' }, icon(lvl)),
    h('div', { class: 'sticker-text' },
      h('p', { class: 'verdict' }, s.severityText),
      note ? h('p', { class: 'sticker-note' }, icon('users'), h('span', {}, note)) : null));
}

function badgeFor(s, d) {
  const mine = (text) => h('span', { class: 'badge badge-mine' }, icon('target'), text);
  if (s.mine) return mine(`${t('yourStore')}${s.viaGroup ? ` (${t('viaGroup')})` : ''}`);
  if (d.words.length) return mine(`${t('watchHit')}: ${d.words.join(', ')}`);
  if (s.nationwide) return h('span', { class: 'badge' }, t('nationwide'));
  return null;
}

const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);

// What the recall is about, as tags coloured by the recall's level.
// One tag per undeclared allergen; an allergen in the household profile is filled.
function reasonTags(r, s) {
  const lvl = `sev-${s.severity.level}`;
  const al = r.reason?.category === 'allergen' ? r.reason.allergens || [] : [];
  if (!al.length) return h('p', { class: 'card-reasons' }, h('span', { class: `tag ${lvl}` }, s.reason));
  return h('p', { class: 'card-reasons' }, al.map((a) => {
    const hit = coversAllergen(a, settings.allergens);
    return h('span', { class: `tag ${lvl}${hit ? ' tag-solid' : ''}` }, hit ? icon('target') : null, ALLERGEN_LABELS[a]?.[settings.lang] || cap(a));
  }));
}

// The feed asks for a small copy of the photo; if it will not load, the card simply has no photo.
function thumbSrc(url, width = 160) {
  try {
    const u = new URL(url);
    if (u.searchParams.has('width')) u.searchParams.set('width', String(width));
    return u.toString();
  } catch { return url; }
}

function card(r) {
  const s = summarize(r, settings, settings.lang);
  const d = decide(r, settings);
  const lvl = s.severity.level;
  const badge = badgeFor(s, d);
  const meta = [s.size, s.dates].filter(Boolean).join(' · ');
  return h('li', {},
    h('a', { class: `card sev-${lvl}${d.highlight ? ' card-mine' : ''}${r.image ? ' has-photo' : ''}`, href: `#/recall/${encodeURIComponent(r.id)}` },
      h('div', { class: 'die' }, icon(lvl)),
      h('div', { class: 'card-content' },
        h('p', { class: 'verdict' }, s.severityText),
        h('h2', { class: 'product' }, s.product),
        reasonTags(r, s),
        meta ? h('p', { class: 'facts-line' }, meta) : null,
        h('p', { class: 'card-action' }, icon('done'), s.action),
        badge ? h('div', { class: 'card-tags' }, badge) : null),
      // The feed asks for a small copy of the photo; if it will not load, the card simply has no photo.
      r.image ? h('img', {
        class: 'thumb', src: thumbSrc(r.image), alt: '', width: 64, height: 64, loading: 'lazy', referrerpolicy: 'no-referrer',
        onerror: (e) => { e.target.closest('.card').classList.remove('has-photo'); e.target.remove(); },
      }) : null,
      h('div', { class: 'card-meta' },
        h('span', { class: 'store' }, s.store),
        h('time', { datetime: r.published }, fmtDate(r.published)))));
}

async function viewFeed() {
  setTitle('');
  const tok = navToken;
  const m = main();
  m.replaceChildren(h('p', { class: 'muted', role: 'status' }, t('loading')));
  try {
    const { recalls, lastPoll } = await loadRecalls();
    if (tok !== navToken) return;
    const list = recalls.length ? h('ul', { class: 'cards' }, recalls.map(card)) : h('p', { class: 'muted' }, t('emptyFeed'));
    m.replaceChildren(
      h('h1', { class: 'visually-hidden' }, t('navFeed')),
      !navigator.onLine ? h('p', { class: 'notice' }, t('offline')) : null,
      h('a', { href: '#/scan', class: 'btn scan-cta' }, icon('scan'), t('scanCta')),
      list,
      h('p', { class: 'muted small' }, `${t('lastCheck')}: ${fmtTime(lastPoll)}`),
    );
  } catch {
    if (tok !== navToken) return;
    m.replaceChildren(h('p', { class: 'notice' }, t('loadError')));
  }
}

function productBlock(p, mine = false) {
  const rows = [
    [t('size'), p.size],
    [t('bestBefore'), p.allDates ? t('allDates') : p.bestBefore.map(fmtDay).join(', ')],
    [t('useBy'), p.useBy.map(fmtDay).join(', ')],
    [t('lot'), p.lot.join(', ')],
    [t('ean'), p.ean.join(', ')],
    [t('soldAt'), p.soldAt],
  ].filter(([, v]) => v);
  return h('li', { class: 'product-item' },
    h('h3', {}, p.name || '—'),
    mine ? h('p', { class: 'product-flag' }, h('span', { class: 'badge badge-mine' }, icon('target'), t('yourStore'))) : null,
    h('dl', {}, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])));
}

function checker(r, careful = false) {
  const out = h('p', { class: 'check-result', role: 'status', 'aria-live': 'polite' });
  const dateIn = h('input', { type: 'date', id: 'packdate' });
  const eanIn = h('input', { type: 'text', id: 'packean', inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9 ]*' });
  const allDates = r.products.some((p) => p.allDates);
  const dates = new Set(r.products.flatMap((p) => [...p.bestBefore, ...p.useBy].map((d) => d.iso)));
  const eans = new Set(r.products.flatMap((p) => p.ean));
  const run = () => {
    const parts = [];
    let level = '';
    if (dateIn.value) {
      if (allDates) { parts.push(t('checkResultAll')); level = 'bad'; }
      else if (!dates.size) parts.push(t('checkResultNoDates'));
      else if (dates.has(dateIn.value)) { parts.push(t('checkResultYes')); level = 'bad'; }
      else if (careful) parts.push(t('checkResultNoCareful'));
      else { parts.push(t('checkResultNo')); level = level || 'ok'; }
    }
    const ean = eanIn.value.replace(/\D/g, '');
    if (ean.length >= 8 && eans.size) {
      if (eans.has(ean)) { parts.push(t('eanYes')); level = 'bad'; } else parts.push(t('eanNo'));
    }
    out.textContent = parts.join(' ');
    out.className = `check-result ${level}`;
  };
  dateIn.addEventListener('input', run);
  eanIn.addEventListener('input', run);
  // Coming from a scan: the barcode is already known, so only the date is left to type.
  if (scanContext?.exact.includes(r.id) && eans.size) { eanIn.value = scanContext.code; run(); }
  return h('section', { class: 'checker', 'aria-labelledby': 'chk' },
    h('h2', { id: 'chk' }, t('doIHave')),
    allDates ? h('p', { class: 'check-result bad' }, t('checkResultAll')) : h('p', { class: 'muted' }, t('doIHaveHelp')),
    h('label', { for: 'packdate' }, t('packDate')), dateIn,
    h('button', { type: 'button', class: 'linkbtn', onclick: () => { out.textContent = t('checkResultUnreadable'); out.className = 'check-result bad'; } }, t('cantReadDate')),
    eans.size ? [h('label', { for: 'packean' }, t('packEan')), eanIn] : null,
    out);
}

function factRow(iconName, title, label) {
  const ic = icon(iconName, { md: true });
  ic.classList.add('fact-icon');
  return h('li', { class: 'fact' }, ic,
    h('div', { class: 'fact-text' }, h('p', { class: 'fact-title' }, title), h('p', { class: 'muted small' }, label)));
}

let lastRecall = null;
// `via` is "push" when the reader came from a notification; `reuse` redraws without asking the server again.
async function viewRecall(id, via, reuse = false) {
  const tok = navToken;
  const m = main();
  m.replaceChildren(h('p', { class: 'muted', role: 'status' }, t('loading')));
  let r;
  if (reuse && lastRecall?.id === id) {
    r = lastRecall;
  } else {
    try {
      r = await api(`/api/recalls/${encodeURIComponent(id)}${via === 'push' ? '?via=push' : ''}`);
    } catch {
      r = cache.recalls?.find((x) => x.id === id);
    }
    lastRecall = r || null;
  }
  if (tok !== navToken) return;
  if (!r) {
    m.replaceChildren(h('p', { class: 'notice' }, t('notFound')), h('a', { href: '#/', class: 'btn' }, t('back')));
    return;
  }
  const s = summarize(r, settings, settings.lang);
  const d = decide(r, settings);
  setTitle(s.product);
  const unsure = (r.uncertain || []).map((k) => STRINGS[settings.lang].unsureFields[k] || k);
  // English: show the machine translation unless the reader asked for the original.
  const en = settings.lang === 'en' && r.en && !showOriginal.has(r.id) ? r.en : null;
  const tx = {
    title: en?.title || r.title, lead: en?.lead || r.lead, stores: en?.stores || r.stores?.text,
    reason: en?.reason || r.reason?.text, action: en?.action || r.action?.text,
  };
  const shareMsg = h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
  const recallUrl = `${location.origin}/#/recall/${encodeURIComponent(r.id)}`;
  const shareText = [s.severityText, `${s.store} · ${s.product}`, [s.dates, s.reason, s.action].filter(Boolean).join(' · ')].join('\n');
  const careful = isCareful(s.severity.level);

  // Authority quote: three lines, then "read the full quote".
  const quote = s.severity.quote;
  const quoteBox = quote ? h('blockquote', { class: 'authority' },
    h('span', { class: 'small muted' }, settings.lang === 'en' ? 'Fødevarestyrelsen (in Danish): ' : 'Fødevarestyrelsen: '),
    h('span', { class: 'authority-text' }, `“${quote}”`)) : h('p', { class: 'muted small' }, t('noRiskStatement'));
  if (quote && quote.length > 140) {
    quoteBox.classList.add('is-clamped');
    const toggle = h('button', { type: 'button', class: 'linkbtn', 'aria-expanded': 'false', onclick: () => {
      const clamped = quoteBox.classList.toggle('is-clamped');
      toggle.textContent = clamped ? t('readMore') : t('readLess');
      toggle.setAttribute('aria-expanded', String(!clamped));
    } }, t('readMore'));
    quoteBox.append(toggle);
  }

  // Products: on a big recall, the ones sold in the reader's stores come first.
  const products = r.products || [];
  const { mine: myProducts, others: otherProducts } = splitProducts(products, settings.chains);
  const flagged = products.length > 3 && myProducts.length > 0 && otherProducts.length > 0;
  const productList = (list) => h('ul', { class: 'products' }, list.map((p) => productBlock(p, flagged && myProducts.includes(p))));
  const productSection = products.length ? h('section', {},
    h('h2', {}, `${t('products')} (${products.length})`),
    flagged ? h('p', { class: 'muted small' }, t('productsMine').replace('{n}', myProducts.length).replace('{total}', products.length)) : null,
    flagged ? [productList(myProducts), h('details', { class: 'more' }, h('summary', {}, `${t('otherProducts')} (${otherProducts.length})`), productList(otherProducts))]
      : productList(products)) : null;

  const thumb = r.image ? h('a', { class: 'thumb-link', href: r.image, target: '_blank', rel: 'noopener', 'aria-label': `${t('productImage')}: ${s.product}` },
    h('img', {
      class: 'thumb thumb-lg', src: thumbSrc(r.image, 240), alt: '', width: 96, height: 96, loading: 'lazy', referrerpolicy: 'no-referrer',
      onerror: (e) => { const head = e.target.closest('.detail-head'); head?.classList.remove('has-photo'); e.target.closest('.thumb-link').remove(); },
    })) : null;

  const whereSold = uniqueStores(tx.stores);
  // Everything the facts list already says, plus the notice's own text, behind one disclosure.
  const moreParts = [
    tx.lead ? h('p', { class: 'lead' }, tx.lead) : null,
    whereSold.length ? h('section', {}, h('h2', {}, t('whereSold')), h('ul', { class: 'plain-list' }, whereSold.map((x) => h('li', {}, x)))) : null,
    tx.reason ? h('section', {}, h('h2', {}, t('why')), h('p', {}, tx.reason)) : null,
    !careful && tx.action ? h('section', {}, h('h2', {}, t('whatToDo')), h('p', {}, tx.action)) : null,
    r.recaller ? h('section', {}, h('h2', {}, t('recaller')), h('p', {}, r.recaller)) : null,
  ].filter(Boolean);

  m.replaceChildren(
    h('div', { class: 'back-row' },
      h('a', { href: '#/', class: 'back' }, icon('arrow-left'), t('back')),
      h('button', { type: 'button', class: 'btn btn-quiet icon-btn', 'aria-label': t('share'), onclick: () => share({ title: s.product, text: shareText, url: recallUrl }, shareMsg) }, icon('share'))),
    shareMsg,
    h('article', { class: 'detail' },
      sevSticker(s, s.severity.vulnerableMentioned ? vulnerableText(settings.lang) : null),
      quoteBox,
      h('div', { class: `detail-head${thumb ? ' has-photo' : ''}` },
        thumb,
        h('div', { class: 'detail-title' },
          badgeFor(s, d),
          h('h1', {}, tx.title),
          h('p', { class: 'muted small' }, `${t('published')} ${fmtDate(r.published)}`, r.updated ? ` · ${r.updated}` : ''))),
      settings.lang === 'en' && r.en ? h('p', { class: 'muted small' },
        showOriginal.has(r.id) ? 'Showing the original Danish text. ' : 'Machine-translated from Danish. ',
        h('button', { type: 'button', class: 'linkbtn', onclick: () => {
          if (showOriginal.has(r.id)) showOriginal.delete(r.id); else showOriginal.add(r.id);
          viewRecall(r.id, undefined, true);
        } }, showOriginal.has(r.id) ? 'Show English' : 'Show original')) : null,
      settings.lang === 'en' && !r.en ? h('p', { class: 'muted small' }, 'English translation not ready yet – showing the Danish notice.') : null,
      h('ul', { class: 'facts' },
        factRow('done', s.action, t('whatToDo')),
        factRow('tag', s.reason, t('why')),
        factRow('pin', s.store, t('whereSold'))),
      unsure.length ? h('p', { class: 'muted small' }, `${t('unsure')}: ${unsure.join(', ')}.`) : null,
      products.length ? checker(r, careful) : null,
      productSection,
      careful && tx.action ? h('section', {}, h('h2', {}, t('whatToDo')), h('p', {}, tx.action)) : null,
      moreParts.length ? h('details', { class: 'more' }, h('summary', {}, t('readFull')), ...moreParts) : null,
      h('p', {}, h('a', { href: r.url, class: 'btn btn-primary', target: '_blank', rel: 'noopener' }, t('official'), icon('external'))),
      r.raw?.product ? h('details', { class: 'more' }, h('summary', {}, t('rawText')),
        ...Object.entries(r.raw).filter(([, v]) => v).map(([k, v]) => h('pre', { 'data-k': k }, v))) : null,
    ),
  );
  window.scrollTo(0, 0);
}

const showOriginal = new Set();
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  if (location.hash.startsWith('#/settings')) route();
});

function toggleList(names, selected, onToggle, onRemove, label = (x) => x) {
  return h('ul', { class: 'chips' }, names.map((name) =>
    h('li', {},
      h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(selected.includes(name)),
        onclick: () => onToggle(name),
      }, label(name)),
      onRemove ? h('button', { type: 'button', class: 'chip-x', 'aria-label': `${t('remove')} ${name}`, onclick: () => onRemove(name) }, '×') : null)));
}

function addForm(id, placeholder, onAdd) {
  const input = h('input', { type: 'text', id, placeholder, autocomplete: 'off', enterkeyhint: 'done' });
  return h('form', { class: 'add-form', onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { onAdd(v); } } },
    input, h('button', { class: 'btn', type: 'submit' }, t('add')));
}

async function viewSettings() {
  setTitle(t('navSettings'));
  const m = main();
  const rerender = () => viewSettings();
  const sub = await currentSubscription().catch(() => null);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const msg = h('p', { class: 'small', role: 'status', 'aria-live': 'polite' });

  const notifState = !supported ? t('notifUnsupported')
    : Notification.permission === 'denied' ? t('notifDenied')
    : sub ? t('notifOn') : t('notifOff');

  const allChains = [...DEFAULT_CHAINS, ...settings.extraChains];

  m.replaceChildren(
    h('h1', {}, t('navSettings')),

    h('section', { class: 'panel' },
      h('h2', {}, t('notifications')),
      h('p', {}, notifState),
      supported && Notification.permission !== 'denied' ? h('div', { class: 'row' },
        sub
          ? [h('button', { class: 'btn', type: 'button', onclick: async () => {
              msg.textContent = '…';
              try { await api('/api/test', { endpoint: sub.endpoint }); msg.textContent = t('testSent'); }
              catch (e) { msg.textContent = `${t('sendFailed')}: ${e.data?.detail || e.message}`; }
            } }, t('testNotif')),
            h('button', { class: 'btn btn-quiet', type: 'button', onclick: async () => { await unsubscribe(); rerender(); } }, t('disable'))]
          : h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
              msg.textContent = '…';
              try { await subscribe(); rerender(); } catch (e) { msg.textContent = e.message; }
            } }, t('enable'))) : null,
      msg),

    installEvent ? h('section', { class: 'panel' },
      h('p', {}, t('installHelp')),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { installEvent.prompt(); await installEvent.userChoice; installEvent = null; rerender(); } }, t('install'))) : null,

    h('section', { class: 'panel' },
      h('h2', { id: 'mode-h' }, t('mode')),
      h('div', { role: 'radiogroup', 'aria-labelledby': 'mode-h', class: 'radios' },
        ['all', 'mine'].map((mode) => h('label', { class: 'radio' },
          h('input', { type: 'radio', name: 'mode', value: mode, checked: settings.mode === mode,
            onchange: () => { settings.mode = mode; saveSettings(); } }),
          mode === 'all' ? t('modeAll') : t('modeMine')))),
      h('p', { class: 'muted small' }, t('modeMineHelp'))),

    h('section', { class: 'panel' },
      h('h2', {}, t('myStores')),
      h('p', { class: 'muted small' }, t('myStoresHelp')),
      toggleList(allChains, settings.chains, (name) => {
        settings.chains = settings.chains.includes(name) ? settings.chains.filter((c) => c !== name) : [...settings.chains, name];
        saveSettings(); rerender();
      }),
      settings.extraChains.length ? toggleList(settings.extraChains, [], () => {}, (name) => {
        settings.extraChains = settings.extraChains.filter((c) => c !== name);
        settings.chains = settings.chains.filter((c) => c !== name);
        saveSettings(); rerender();
      }) : null,
      h('label', { for: 'addstore' }, t('addStore')),
      addForm('addstore', t('addStorePlaceholder'), (v) => {
        if (!allChains.some((c) => c.toLowerCase() === v.toLowerCase())) settings.extraChains.push(v);
        if (!settings.chains.includes(v)) settings.chains.push(v);
        saveSettings(); rerender();
      })),

    h('section', { class: 'panel' },
      h('h2', {}, t('household')),
      h('p', { class: 'muted small' }, t('householdHelp')),
      h('h3', { id: 'allergy-h' }, t('allergies')),
      toggleList(ALLERGENS, settings.allergens, (a) => {
        settings.allergens = settings.allergens.includes(a) ? settings.allergens.filter((x) => x !== a) : [...settings.allergens, a];
        saveSettings(); rerender();
      }, null, (a) => ALLERGEN_LABELS[a][settings.lang]),
      h('label', { class: 'radio' },
        h('input', { type: 'checkbox', checked: settings.vulnerable, onchange: (e) => { settings.vulnerable = e.target.checked; saveSettings(); } }),
        t('vulnerable')),
      h('p', { class: 'muted small' }, t('vulnerableHelp'))),

    h('section', { class: 'panel' },
      h('h2', {}, t('quietTitle')),
      h('p', { class: 'muted small' }, t('quietHelp')),
      ...LEVELS.filter((l) => l !== 'unstated').map((l) => h('label', { class: 'radio' },
        h('input', { type: 'checkbox', checked: settings.quiet.includes(l), onchange: (e) => {
          settings.quiet = e.target.checked ? [...new Set([...settings.quiet, l])] : settings.quiet.filter((x) => x !== l);
          saveSettings();
        } }),
        h('span', { class: 'row-label' }, h('span', { class: `sev-ic sev-${l}` }, icon(l)), ' ', LEVEL_LABELS[l][settings.lang])))),

    h('section', { class: 'panel' },
      h('h2', {}, t('words')),
      h('p', { class: 'muted small' }, t('wordsHelp')),
      settings.words.length ? toggleList(settings.words, settings.words, () => {}, (w) => {
        settings.words = settings.words.filter((x) => x !== w); saveSettings(); rerender();
      }) : null,
      h('label', { for: 'addword', class: 'visually-hidden' }, t('words')),
      addForm('addword', t('wordsPlaceholder'), (v) => {
        for (const w of v.split(',').map((x) => x.trim()).filter(Boolean)) if (!settings.words.includes(w)) settings.words.push(w);
        saveSettings(); rerender();
      })),

    h('section', { class: 'panel' },
      h('h2', { id: 'theme-h' }, t('themeTitle')),
      h('div', { role: 'radiogroup', 'aria-labelledby': 'theme-h', class: 'seg-group' },
        [['system', 'monitor', 'themeSystem'], ['light', 'sun', 'themeLight'], ['dark', 'moon', 'themeDark']].map(([value, ic, key]) => h('label', { class: 'seg' },
          h('input', { type: 'radio', name: 'theme', value, class: 'visually-hidden', checked: settings.theme === value,
            onchange: () => { settings.theme = value; saveSettings(); applyTheme(); } }),
          h('span', { class: 'seg-face' }, icon(ic), t(key))))),
      h('p', { class: 'muted small' }, t('themeHelp'))),

    h('section', { class: 'panel' },
      h('h2', { id: 'lang-h' }, t('language')),
      h('div', { role: 'radiogroup', 'aria-labelledby': 'lang-h', class: 'radios' },
        [['da', 'Dansk'], ['en', 'English']].map(([code, label]) => h('label', { class: 'radio', lang: code },
          h('input', { type: 'radio', name: 'lang', value: code, checked: settings.lang === code,
            onchange: () => { settings.lang = code; saveSettings(); applyLang(); rerender(); } }),
          label)))),

    h('section', { class: 'panel' },
      h('h2', {}, t('shareSettings')),
      h('p', { class: 'muted small' }, t('shareSettingsHelp')),
      h('button', { type: 'button', class: 'btn', onclick: () => share({
        title: t('appName'), text: t('shareSettingsText'), url: `${location.origin}/#/import/${encodeSettings()}`,
      }, msg) }, icon('share'), t('shareSettings'))),

    h('section', { class: 'panel small' },
      h('h2', {}, t('privacyTitle')),
      h('button', { type: 'button', class: 'btn', onclick: (e) => openPrivacy(e.currentTarget) }, icon('shield'), t('privacyOpen'))),
  );
}

function viewImport(code) {
  const m = main();
  let incoming;
  try { incoming = decodeSettings(code); } catch {
    m.replaceChildren(h('p', { class: 'notice' }, t('importBad')), h('a', { href: '#/settings', class: 'btn' }, t('navSettings')));
    return;
  }
  setTitle(t('importTitle'));
  const allergenNames = incoming.allergens.map((a) => ALLERGEN_LABELS[a][settings.lang]);
  const rows = [
    [t('myStores'), incoming.chains.join(', ') || '—'],
    [t('mode'), incoming.mode === 'mine' ? t('modeMine') : t('modeAll')],
    [t('allergies'), allergenNames.join(', ') || '—'],
    [t('vulnerable'), incoming.vulnerable ? t('yes') : '—'],
    [t('words'), incoming.words.join(', ') || '—'],
  ];
  m.replaceChildren(
    h('h1', {}, t('importTitle')),
    h('p', {}, t('importHelp')),
    h('dl', { class: 'panel import' }, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
        settings = { ...settings, ...incoming };
        saveSettings(); applyLang();
        location.hash = '#/settings';
      } }, t('importUse')),
      h('a', { href: '#/', class: 'btn btn-quiet' }, t('cancel'))),
  );
}

// ------------------------------------------------------------ barcode scan

let activeScanner = null;
// Bumped on every navigation: a screen that finishes loading after the reader has moved on must not draw itself.
let navToken = 0;
let scanContext = null; // { code, exact: [recall ids] } after a scan, so the pack check can reuse the barcode

function stopScanner() {
  navToken += 1;
  activeScanner?.stop();
  activeScanner = null;
}

const SCAN_STATES = {
  starting: 'scanStarting', scanning: 'scanScanning', denied: 'scanDenied',
  nocamera: 'scanNoCamera', unsupported: 'scanUnsupported', error: 'scanError',
};

function openScanResult(code) {
  navigator.vibrate?.(60);
  location.hash = `#/scan/${code}`;
}

async function viewScan() {
  setTitle(t('scanTitle'));
  const m = main();
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true, 'aria-label': t('scanVideoLabel') });
  const viewfinder = h('div', { class: 'scanner' }, video, h('div', { class: 'scan-frame', 'aria-hidden': 'true' }));
  const helpLine = h('p', { class: 'muted' }, t('scanHelp'));
  const status = h('p', { class: 'scan-status', role: 'status', 'aria-live': 'polite' }, t('scanStarting'));
  const torchBtn = h('button', { type: 'button', class: 'btn btn-quiet', hidden: true }, icon('zap'), t('scanTorchOn'));
  const photoIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'visually-hidden', id: 'scanphoto' });
  const photoBtn = h('label', { class: 'btn btn-quiet file-btn' }, icon('image'), t('scanPhoto'), photoIn);
  const codeIn = h('input', { type: 'text', id: 'scancode', inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'search', pattern: '[0-9 ]*', 'aria-describedby': 'scancode-err' });
  const codeErr = h('p', { class: 'scan-error small', id: 'scancode-err', role: 'alert' });

  photoIn.addEventListener('change', async () => {
    const file = photoIn.files?.[0];
    photoIn.value = '';
    if (!file) return;
    status.textContent = t('scanPhotoBusy');
    try {
      const { decodePhoto } = await import('./scan.js');
      const code = await decodePhoto(file);
      if (code) openScanResult(code); else status.textContent = t('scanPhotoNone');
    } catch {
      status.textContent = t('scanPhotoNone');
    }
  });
  const manual = (e) => {
    e.preventDefault();
    const digits = digitsOnly(codeIn.value);
    if (digits.length < 8 || digits.length > 14) {
      codeErr.textContent = t('scanManualShort');
      codeIn.setAttribute('aria-invalid', 'true');
      return;
    }
    openScanResult(digits);
  };

  m.replaceChildren(
    h('div', { class: 'back-row' }, h('a', { href: '#/', class: 'back' }, icon('arrow-left'), t('back'))),
    h('h1', {}, t('scanTitle')),
    helpLine,
    viewfinder,
    status,
    h('div', { class: 'row' }, torchBtn, photoBtn),
    h('section', { class: 'panel scan-manual' },
      h('form', { onsubmit: manual, novalidate: true },
        h('label', { for: 'scancode' }, t('scanManual')),
        h('div', { class: 'add-form' }, codeIn, h('button', { class: 'btn btn-primary', type: 'submit' }, t('scanManualCheck'))),
        codeErr)),
    h('p', { class: 'muted small' }, t('scanLimit')),
  );

  const token = navToken;
  const setState = (name) => {
    status.textContent = t(SCAN_STATES[name] || 'scanError');
    const off = name !== 'scanning' && name !== 'starting';
    viewfinder.classList.toggle('is-off', off);
    helpLine.hidden = off; // no frame on screen, so no "hold it inside the frame"
    if (off) torchBtn.hidden = true;
  };
  let scanner;
  try {
    const { startScanner } = await import('./scan.js');
    scanner = await startScanner(video, { onCode: openScanResult, onState: setState });
  } catch {
    setState('error');
    return;
  }
  if (token !== navToken) { scanner.stop(); return; } // the reader left the screen while the camera was starting
  activeScanner = scanner;
  if (scanner.canTorch) {
    torchBtn.hidden = false;
    torchBtn.addEventListener('click', async () => {
      const on = await scanner.toggleTorch();
      torchBtn.replaceChildren(icon('zap'), t(on ? 'scanTorchOff' : 'scanTorchOn'));
    });
  }
}

async function viewScanResult(code) {
  setTitle(t('scanTitle'));
  const tok = navToken;
  const m = main();
  m.replaceChildren(h('p', { class: 'muted', role: 'status' }, t('loading')));
  let recalls;
  try {
    ({ recalls } = await loadRecalls('scan'));
  } catch {
    if (tok !== navToken) return;
    m.replaceChildren(h('p', { class: 'notice' }, t('loadError')), h('a', { href: '#/scan', class: 'btn' }, t('resultAgain')));
    return;
  }
  if (tok !== navToken) return;
  const valid = hasValidCheckDigit(code);
  const hits = valid ? matchRecalls(recalls, code) : [];
  const cov = barcodeCoverage(recalls);
  scanContext = { code, exact: hits.filter((x) => !x.loose).map((x) => x.recall.id) };

  let body;
  if (!valid) {
    body = h('p', { class: 'notice', role: 'status' }, t('resultInvalid'));
  } else if (hits.length) {
    body = [
      h('h1', {}, hits.length === 1 ? t('resultMatchOne') : t('resultMatchMany').replace('{n}', hits.length)),
      h('p', {}, t('resultMatchNext')),
      ...hits.map((x) => h('section', { class: 'scan-hit' },
        h('ul', { class: 'cards' }, card(x.recall)),
        x.loose ? h('p', { class: 'notice' }, t('resultLoose')) : null,
        h('h2', {}, t('resultProduct')),
        h('ul', { class: 'products' }, x.products.map((p) => productBlock(p))))),
    ];
  } else {
    // No match is never an all-clear: the unstated sticker (question mark), not a tick.
    body = h('div', { class: 'sticker sev-unstated', role: 'status' },
      h('div', { class: 'die' }, icon('unstated')),
      h('div', { class: 'sticker-text' },
        h('p', { class: 'verdict' }, t('resultNoneTitle')),
        h('p', {}, cov.recalls
          ? t('resultNoneBody').replace('{total}', cov.recalls).replace('{withEan}', cov.withEan)
          : t('resultNoneEmpty'))));
  }

  m.replaceChildren(
    h('div', { class: 'back-row' }, h('a', { href: '#/scan', class: 'back' }, icon('arrow-left'), t('back'))),
    h('p', { class: 'scan-code' }, `${t('resultCode')} `, h('strong', {}, formatCode(code))),
    body,
    h('div', { class: 'row scan-actions' },
      h('a', { href: '#/scan', class: 'btn btn-primary' }, icon('scan'), t('resultAgain')),
      h('a', { href: '#/', class: 'btn btn-quiet' }, t('resultAll'))),
  );
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------ router / shell

// Theme is a device-only choice: it is not sent to the server and not part of the share link.
function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') root.dataset.theme = settings.theme; else delete root.dataset.theme;
  const colors = { light: '#103a2e', dark: '#14382c' };
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((meta) => {
    const own = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = colors[settings.theme === 'light' || settings.theme === 'dark' ? settings.theme : own];
  });
}

// The privacy text lives in a native <dialog>: Esc closes it, focus is trapped, and focus returns to the opener.
function openPrivacy(opener) {
  document.getElementById('privacy-dialog')?.remove();
  const dlg = h('dialog', { class: 'modal', id: 'privacy-dialog', 'aria-labelledby': 'privacy-h' },
    h('div', { class: 'modal-head' },
      h('h2', { id: 'privacy-h' }, t('privacyTitle')),
      h('button', { type: 'button', class: 'btn icon-btn', 'aria-label': t('close'), onclick: () => dlg.close() }, icon('x'))),
    h('div', { class: 'modal-body small' },
      h('ul', { class: 'plain-list' }, ['privacyPhone', 'privacyServer', 'privacyCounts', 'privacyOthers'].map((k) => h('li', {}, t(k))))));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { dlg.remove(); opener?.focus?.(); });
  document.body.append(dlg);
  dlg.showModal();
}

function applyLang() {
  document.documentElement.lang = settings.lang;
  document.getElementById('nav-feed').textContent = t('navFeed');
  document.getElementById('nav-settings').textContent = t('navSettings');
  document.getElementById('app-name').textContent = t('appName');
  document.getElementById('disclaimer').textContent = t('about');
  document.getElementById('open-privacy').textContent = t('privacyTitle');
}

function route() {
  stopScanner();
  const hash = location.hash || '#/';
  for (const a of document.querySelectorAll('nav a')) {
    const active = (a.getAttribute('href') === '#/settings') === hash.startsWith('#/settings');
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const m = hash.match(/^#\/recall\/([^?]+)(?:\?via=(push))?$/);
  if (m) return viewRecall(decodeURIComponent(m[1]), m[2]);
  const imp = hash.match(/^#\/import\/([A-Za-z0-9_-]+)$/);
  if (imp) return viewImport(imp[1]);
  if (hash === '#/scan') return viewScan();
  const scanned = hash.match(/^#\/scan\/(\d{8,14})$/);
  if (scanned) return viewScanResult(scanned[1]);
  if (hash.startsWith('#/settings')) return viewSettings();
  return viewFeed();
}

window.addEventListener('hashchange', route);
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'open' && e.data.url) location.hash = new URL(e.data.url, location.origin).hash;
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
document.getElementById('open-privacy').addEventListener('click', (e) => openPrivacy(e.currentTarget));
applyTheme();
applyLang();
route();
