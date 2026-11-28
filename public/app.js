import { STRINGS } from './i18n.js';
import { DEFAULT_CHAINS } from './shared/chains.js';
import { summarize, decide } from './shared/summary.js';
import { ALLERGENS, ALLERGEN_LABELS, LEVEL_LABELS, LEVELS, vulnerableText, coversAllergen } from './shared/severity.js';
import { icon } from './icons.js';
import { isCareful, splitProducts, uniqueStores } from './shared/detail.js';

// ------------------------------------------------------------ settings (on device)

const SETTINGS_KEY = 'tilbagekald.settings.v1';
const defaults = { lang: 'da', mode: 'all', chains: [], extraChains: [], words: [], allergens: [], vulnerable: false, quiet: [] };

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

async function loadRecalls() {
  try {
    const d = await api('/api/recalls');
    cache = { recalls: d.recalls, lastPoll: d.lastPoll, lastError: d.lastError, offline: d._fromCache || false };
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

// The icon says what to do: a trash can to discard, exchange arrows to return (or discard), an info mark to read the notice.
function actionIcon(action) {
  const name = { discard: 'trash', return_or_discard: 'exchange' }[action?.kind] || 'info';
  return icon(name);
}

// A level's verdict as a full-width band: shape icon plus the Danish words, filled by level.
function band(s, seal = null) {
  const text = s.severityText;
  // The seal shows its words only when the verdict is short enough to share the line; otherwise it is icon-only
  // (the words stay in the page for screen readers).
  return h('div', { class: `band${text.length <= 18 ? ' band-roomy' : ''}` },
    icon(s.severity.level, { md: true }), h('span', { class: 'band-text' }, text), seal);
}

// Detail screen: the recall as a door sticker. A note under the band says who is especially at risk,
// when the notice names them.
function sevSticker(s, note = null) {
  return h('div', { class: `sticker sev-${s.severity.level}` },
    band(s),
    note ? h('p', { class: 'sticker-note' }, icon('users'), h('span', {}, note)) : null);
}

// The product photo, or a placeholder when the recall has none (or it will not load).
function photo(r, width = 240) {
  const box = h('div', { class: 'photo' });
  const empty = () => { box.classList.add('photo-empty'); box.replaceChildren(icon('package')); };
  if (!r.image) { empty(); return box; }
  box.append(h('img', {
    src: thumbSrc(r.image, width), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: empty,
  }));
  return box;
}

function badgeFor(s, d) {
  const mine = (text) => h('span', { class: 'badge badge-mine' }, icon('target'), text);
  if (s.mine) return mine(`${t('yourStore')}${s.viaGroup ? ` (${t('viaGroup')})` : ''}`);
  if (d.words.length) return mine(`${t('watchHit')}: ${d.words.join(', ')}`);
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
  // A recall from the reader's store gets the black seal in the band; a watch-word hit stays a badge in the body.
  const seal = s.mine ? h('span', { class: 'seal' }, icon('target'), h('span', { class: 'seal-text' }, t('yourStore'))) : null;
  const badge = s.mine ? null : badgeFor(s, d);
  const meta = [s.size, s.dates].filter(Boolean).join(' · ');
  return h('li', {},
    h('a', { class: `card sev-${lvl}`, href: `#/recall/${encodeURIComponent(r.id)}` },
      band(s, seal),
      h('div', { class: 'card-body' },
        // What product is it? The name and the picture come first.
        h('div', { class: 'card-top' },
          h('div', { class: 'card-main' },
            h('h2', { class: 'product' }, s.product),
            meta ? h('p', { class: 'facts-line' }, meta) : null,
            reasonTags(r, s),
            badge ? h('div', { class: 'card-tags' }, badge) : null),
          photo(r)),
        h('p', { class: 'card-action' }, actionIcon(r.action), s.action),
        h('div', { class: 'card-meta' },
          h('span', { class: 'store' }, icon('pin'), s.store),
          h('time', { datetime: r.published }, fmtDate(r.published))))));
}

async function viewFeed() {
  setTitle('');
  const m = main();
  m.replaceChildren(h('p', { class: 'muted', role: 'status' }, t('loading')));
  try {
    const { recalls, lastPoll } = await loadRecalls();
    const list = recalls.length ? h('ul', { class: 'cards' }, recalls.map(card)) : h('p', { class: 'muted' }, t('emptyFeed'));
    m.replaceChildren(
      h('h1', { class: 'visually-hidden' }, t('navFeed')),
      !navigator.onLine ? h('p', { class: 'notice' }, t('offline')) : null,
      list,
      h('p', { class: 'muted small' }, `${t('lastCheck')}: ${fmtTime(lastPoll)}`),
    );
  } catch {
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

async function viewRecall(id) {
  const m = main();
  m.replaceChildren(h('p', { class: 'muted', role: 'status' }, t('loading')));
  let r;
  try {
    r = await api(`/api/recalls/${encodeURIComponent(id)}`);
  } catch {
    r = cache.recalls?.find((x) => x.id === id);
  }
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

  const thumb = r.image
    ? h('a', { class: 'thumb-link', href: r.image, target: '_blank', rel: 'noopener', 'aria-label': `${t('productImage')}: ${s.product}` }, photo(r))
    : photo(r);

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
      h('div', { class: 'detail-head' },
        h('div', { class: 'detail-title' },
          badgeFor(s, d),
          h('h1', {}, tx.title),
          h('p', { class: 'muted small' }, `${t('published')} ${fmtDate(r.published)}`, r.updated ? ` · ${r.updated}` : '')),
        thumb),
      quoteBox,
      settings.lang === 'en' && r.en ? h('p', { class: 'muted small' },
        showOriginal.has(r.id) ? 'Showing the original Danish text. ' : 'Machine-translated from Danish. ',
        h('button', { type: 'button', class: 'linkbtn', onclick: () => {
          if (showOriginal.has(r.id)) showOriginal.delete(r.id); else showOriginal.add(r.id);
          viewRecall(r.id);
        } }, showOriginal.has(r.id) ? 'Show English' : 'Show original')) : null,
      settings.lang === 'en' && !r.en ? h('p', { class: 'muted small' }, 'English translation not ready yet – showing the Danish notice.') : null,
      h('ul', { class: 'facts' },
        factRow(r.action?.kind === 'discard' ? 'trash' : r.action?.kind === 'return_or_discard' ? 'exchange' : 'info', s.action, t('whatToDo')),
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
  let status = null;
  try { status = await api('/api/status'); } catch {}

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

    h('section', { class: 'panel muted small' },
      h('h2', {}, t('status')),
      h('p', {}, `${t('lastCheck')}: ${fmtTime(status?.lastPoll)}`),
      status?.lastError ? h('p', {}, `${t('feedError')}: ${status.lastError.message} (${fmtTime(status.lastError.at)})`) : null,
      h('p', {}, t('about'))),
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

// ------------------------------------------------------------ router / shell

function applyLang() {
  document.documentElement.lang = settings.lang;
  document.getElementById('nav-feed').textContent = t('navFeed');
  document.getElementById('nav-settings').textContent = t('navSettings');
  document.getElementById('app-name').textContent = t('appName');
}

function route() {
  const hash = location.hash || '#/';
  for (const a of document.querySelectorAll('nav a')) {
    const active = (a.getAttribute('href') === '#/settings') === hash.startsWith('#/settings');
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const m = hash.match(/^#\/recall\/(.+)$/);
  if (m) return viewRecall(decodeURIComponent(m[1]));
  const imp = hash.match(/^#\/import\/([A-Za-z0-9_-]+)$/);
  if (imp) return viewImport(imp[1]);
  if (hash.startsWith('#/settings')) return viewSettings();
  return viewFeed();
}

window.addEventListener('hashchange', route);
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'open' && e.data.url) location.hash = new URL(e.data.url, location.origin).hash;
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
applyLang();
route();
