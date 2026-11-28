// Owner-only dashboard. Not linked from the app and not cached by the service worker.
// The token is sent only as an Authorization header; the server decides what it may see.
import { icon } from './icons.js';

const TOKEN_KEY = 'tilbagekald.admin.token';
const main = document.getElementById('main');

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

const read = () => { try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const forget = () => { try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch {} };
function keep(token, remember) {
  try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token); } catch {}
}

const LABELS = {
  poll_failed: 'Feed checks that failed', detail_failed: 'Recall pages that failed', recalls_new: 'New recalls seen',
  parse_unsure: 'Recalls the parser was unsure about', risk_unstated: 'Recalls with no risk wording',
  push_sent: 'Notifications sent', push_rejected: 'Notifications refused', push_gone: 'Devices dropped (unreachable)',
  translate_ok: 'Translations kept', translate_failed: 'Translations rejected',
  feed_loads: 'List loads', scan_checks: 'Barcode checks', recall_views: 'Recall pages opened',
  recall_views_push: '… from a notification', notifications_on: 'Notifications turned on',
  notifications_off: 'Notifications turned off', settings_synced: 'Settings saved',
};
const RELIABILITY = ['poll_failed', 'detail_failed', 'recalls_new', 'parse_unsure', 'risk_unstated', 'push_sent', 'push_rejected', 'push_gone', 'translate_ok', 'translate_failed'];
const USAGE = ['feed_loads', 'scan_checks', 'recall_views', 'recall_views_push', 'notifications_on', 'notifications_off', 'settings_synced'];

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'never');

function sum(days, keys, n) {
  const cutoff = new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const out = {};
  for (const d of days) if (n === 1 ? d.day === new Date().toISOString().slice(0, 10) : d.day > cutoff) for (const k of keys) out[k] = (out[k] || 0) + (d[k] || 0);
  return out;
}

// Health is shown with an icon and words, not colour alone (red is reserved for recall health levels).
function health(status) {
  const age = status.lastPoll ? (Date.now() - new Date(status.lastPoll).getTime()) / 6e4 : Infinity;
  if (status.lastError && (!status.lastPoll || new Date(status.lastError.at) > new Date(status.lastPoll))) return ['alert', 'Failing', `${status.lastError.message} (${fmt(status.lastError.at)})`];
  if (!status.lastPoll) return ['clock', 'Waiting', 'No check has completed yet. The job runs every 15 minutes.'];
  if (age > 45) return ['clock', 'Late', `Last successful check ${fmt(status.lastPoll)}. The job runs every 15 minutes.`];
  return ['check', 'Running', `Last check ${fmt(status.lastPoll)}.`];
}

function table(title, keys, days) {
  const cols = [['Today', sum(days, keys, 1)], ['7 days', sum(days, keys, 7)], ['30 days', sum(days, keys, 30)]];
  return h('section', { class: 'panel' },
    h('h2', {}, title),
    h('div', { class: 'tablewrap' }, h('table', { class: 'stat' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Event'), cols.map(([c]) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, keys.map((k) => h('tr', {}, h('th', { scope: 'row' }, LABELS[k]), cols.map(([, v]) => h('td', {}, String(v[k] || 0)))))))));
}

function tally(obj) {
  if (typeof obj === 'string') return obj;
  const e = Object.entries(obj || {});
  return e.length ? e.map(([k, v]) => `${k}: ${v}`).join(', ') : 'none';
}

function dashboard(data, reload) {
  const [ic, word, detail] = health(data.status);
  const s = data.settings;
  main.replaceChildren(
    h('section', { class: 'panel' },
      h('h2', {}, 'Feed'),
      h('p', { class: 'fact-line' }, icon(ic), h('strong', {}, ` ${word}`)),
      h('p', {}, detail),
      h('p', { class: 'muted small' }, `New recall last seen ${fmt(data.status.lastNew)} · pending jobs ${data.status.pending} · ${data.status.seeded ? 'seeded' : 'not seeded yet'}`)),
    table('Reliability', RELIABILITY, data.days),
    table('Usage', USAGE, data.days),
    h('section', { class: 'panel' },
      h('h2', {}, 'Devices with notifications'),
      h('p', {}, `${s.devices} device${s.devices === 1 ? '' : 's'}`),
      h('p', { class: 'small' }, `Mode: ${tally(s.mode)}`),
      h('p', { class: 'small' }, `Language: ${tally(s.language)}`),
      h('p', { class: 'small' }, `Chains: ${tally(s.chains)}`),
      h('p', { class: 'small' }, `Allergens: ${tally(s.allergens)}`),
      h('p', { class: 'small' }, `Vulnerable households: ${typeof s.vulnerable_household === 'number' ? s.vulnerable_household : s.vulnerable_household}`),
      h('p', { class: 'muted small' }, `Anonymous daily counters, kept ${data.retentionDays} days. No device or user IDs.`)),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onclick: reload }, 'Refresh'),
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => { forget(); login(); } }, 'Sign out')));
}

async function load() {
  const token = read();
  if (!token) return login();
  main.replaceChildren(h('p', { class: 'muted', role: 'status' }, 'Loading…'));
  let res;
  try { res = await fetch('/api/admin/stats', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' }); }
  catch { return login('Could not reach the server.'); }
  if (res.status === 403) { forget(); return login('Wrong token, or ADMIN_TOKEN is not set on the Worker.'); }
  if (!res.ok) return login(`Server answered ${res.status}.`);
  dashboard(await res.json(), load);
}

function login(error) {
  const input = h('input', { type: 'password', id: 'tok', autocomplete: 'current-password', required: true });
  const remember = h('input', { type: 'checkbox' });
  main.replaceChildren(h('form', { class: 'panel', onsubmit: (e) => {
    e.preventDefault();
    keep(input.value.trim(), remember.checked);
    load();
  } },
    h('h2', {}, 'Owner sign-in'),
    error ? h('p', { class: 'notice', role: 'alert' }, error) : null,
    h('label', { for: 'tok' }, 'Admin token'),
    input,
    h('label', { class: 'radio' }, remember, h('span', { class: 'row-label' }, 'Remember on this device')),
    h('button', { type: 'submit', class: 'btn btn-primary' }, 'Open dashboard')));
}

load();
