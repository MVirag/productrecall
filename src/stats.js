// Anonymous daily counters. Built to hold no personal data:
//  - a counter is an event name and a number for one UTC day; there is no
//    user, device, IP address, user agent or timestamp finer than the day
//  - only names on the allow-lists below are counted
//  - nothing is counted by code that runs on the phone: usage counters come
//    from requests the app has to make anyway (see worker.js), so no extra
//    information is read from or sent by the device for statistics
//  - daily records expire on their own after RETENTION_DAYS

import { DEFAULT_CHAINS } from '../public/shared/chains.js';

export const RETENTION_DAYS = 35;
const DAILY_CAP = 400; // protects the free plan's KV write limit; further counts that day are dropped

// Is the service working? Counted on the server while it does its job.
export const RELIABILITY = [
  'poll_failed',        // the feed could not be read or had no recalls
  'detail_failed',      // a recall page could not be fetched
  'recalls_new',        // new recalls seen
  'parse_unsure',       // new recalls where the parser flagged a field as unsure
  'risk_unstated',      // new recalls with no recognised risk wording
  'push_sent',          // notifications accepted by the push service
  'push_rejected',      // refused by the push service (not a dead device)
  'push_gone',          // device unreachable; its subscription was deleted
  'translate_ok',
  'translate_failed',
];

// Is it used? Counted from requests the app makes to work, never from a separate beacon.
export const USAGE = [
  'feed_loads',          // the recall list was loaded
  'scan_checks',         // a scanned barcode was checked
  'recall_views',        // a recall page was opened
  'recall_views_push',   // ... opened from a notification
  'notifications_on',
  'notifications_off',
  'settings_synced',     // settings saved while notifications are on
];

export const ALL_EVENTS = [...RELIABILITY, ...USAGE];

export const dayKey = (d = new Date()) => `stats:${d.toISOString().slice(0, 10)}`;

/**
 * Add `counts` ({ name: n }) to today's record. Never throws: statistics
 * must not be able to break the app. Reads and writes are not atomic, so
 * simultaneous requests can lose a count; these are rough counters.
 */
export async function addCounts(env, counts, now = new Date()) {
  try {
    const clean = Object.entries(counts || {}).filter(([k, v]) => ALL_EVENTS.includes(k) && Number.isFinite(v) && v > 0);
    if (!clean.length || !env?.KV) return false;
    const key = dayKey(now);
    const rec = (await env.KV.get(key, 'json')) || {};
    let total = rec._total || 0;
    if (total >= DAILY_CAP) return false;
    for (const [k, v] of clean) {
      rec[k] = (rec[k] || 0) + v;
      total += v;
    }
    rec._total = total;
    await env.KV.put(key, JSON.stringify(rec), { expirationTtl: RETENTION_DAYS * 86400 });
    return true;
  } catch {
    return false;
  }
}

export const count = (env, name, n = 1, now) => addCounts(env, { [name]: n }, now);

/** Sum the last `days` daily records. Returns { name: total }. */
export async function lastDays(env, days = 7, only = ALL_EVENTS, now = new Date()) {
  const out = Object.fromEntries(only.map((k) => [k, 0]));
  for (let i = 0; i < days; i++) {
    const rec = await env.KV.get(dayKey(new Date(now.getTime() - i * 864e5)), 'json');
    if (!rec) continue;
    for (const k of only) out[k] += rec[k] || 0;
  }
  return out;
}

/** Per-day records for the admin view, newest first. */
export async function dailyRecords(env, days = 30, now = new Date()) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 864e5);
    const rec = await env.KV.get(dayKey(d), 'json');
    if (rec) {
      const { _total, ...counts } = rec;
      rows.push({ day: d.toISOString().slice(0, 10), ...counts });
    }
  }
  return rows;
}

const MIN_GROUP = 5; // health-related settings are shown only for 5 or more devices

/**
 * Totals over the settings already stored to deliver notifications. Nothing
 * new is collected for this. Allergens and the "vulnerable household" switch
 * are health-related, so they appear only when at least MIN_GROUP devices
 * exist; below that they are suppressed so a single household is not exposed.
 */
export function settingsOverview(subs) {
  const n = subs.length;
  const tally = (pick) => {
    const t = {};
    for (const s of subs) for (const v of [].concat(pick(s.settings || {}) ?? [])) t[v] = (t[v] || 0) + 1;
    return t;
  };
  const out = {
    devices: n,
    mode: tally((s) => s.mode || 'all'),
    language: tally((s) => s.lang || 'da'),
    // Only the standard chains are named; text a user typed themselves counts as 'other'.
    chains: tally((s) => (s.chains || []).map((c) => (DEFAULT_CHAINS.includes(c) ? c : 'other'))),
  };
  if (n >= MIN_GROUP) {
    out.allergens = tally((s) => s.allergens || []);
    out.vulnerable_household = subs.filter((s) => s.settings?.vulnerable).length;
  } else {
    out.allergens = out.vulnerable_household = `hidden until at least ${MIN_GROUP} devices`;
  }
  return out;
}
