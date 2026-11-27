// The scheduled job: read the RSS feed, fetch detail pages for new recalls,
// store them, and push notifications. Written so it can run in tests with a
// fake KV and a fake fetch.

import { FEED_URL, parseRss, parseDetail, fromRssOnly } from './parse.js';
import { decide, notificationFor } from '../public/shared/summary.js';
import { sendPush } from './push.js';
import { translateRecall, textHash, TRANSLATE_VERSION } from './translate.js';

export const KEYS = { state: 'state', recalls: 'recalls', subPrefix: 'sub:' };

const RSS_ITEMS = 40;          // only the head of the 300 KB feed matters
const SEEN_MAX = 400;
const RECALLS_MAX = 60;
const DETAILS_PER_RUN = 6;     // free plan: 50 subrequests per invocation
const TRANSLATE_PER_RUN = 2;   // Workers AI calls per run (English text)
const SEED_DETAILS = 15;       // first run: fill the feed, notify nobody
const MAX_ATTEMPTS = 3;
const REFRESH_DAYS = 7;        // pages get "Opdateret ..." edits in the first days
const REFRESH_HOURS = 6;

const UA = 'TilbagekaldAlert/0.1 (personal recall notifier; Cloudflare Worker)';

export async function loadState(kv) {
  return (await kv.get(KEYS.state, 'json')) || { seeded: false, seen: [], pending: [], lastPoll: null, lastError: null };
}

export async function loadRecalls(kv) {
  return (await kv.get(KEYS.recalls, 'json')) || [];
}

export async function listSubscriptions(kv) {
  const subs = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: KEYS.subPrefix, cursor });
    for (const k of page.keys) {
      const v = await kv.get(k.name, 'json');
      if (v) subs.push({ key: k.name, ...v });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return subs;
}

function upsert(recalls, recall) {
  const i = recalls.findIndex((r) => r.id === recall.id);
  if (i >= 0) recalls[i] = recall;
  else recalls.push(recall);
  recalls.sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  recalls.length = Math.min(recalls.length, RECALLS_MAX);
}

async function fetchText(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/**
 * Run one poll. Returns a summary for logging / the admin endpoint.
 * opts: { fetchImpl, now, notify: async (recalls) => {...} }
 */
export async function poll(env, { fetchImpl = fetch, now = new Date() } = {}) {
  const kv = env.KV;
  const state = await loadState(kv);
  const recalls = await loadRecalls(kv);
  const summary = { newIds: [], fetched: [], failed: [], notified: 0, seeded: false };

  let items;
  try {
    items = parseRss(await fetchText(FEED_URL, fetchImpl), RSS_ITEMS);
    if (!items.length) throw new Error('RSS feed had no recall items');
  } catch (e) {
    state.lastError = { at: now.toISOString(), message: String(e.message || e) };
    state.lastPoll = now.toISOString();
    await kv.put(KEYS.state, JSON.stringify(state));
    summary.error = state.lastError.message;
    return summary;
  }
  const byId = new Map(items.map((i) => [i.id, i]));

  if (!state.seeded) {
    // First run: everything currently in the feed counts as already seen.
    state.seen = items.map((i) => i.id);
    state.pending = items.slice(0, SEED_DETAILS).map((i) => ({ id: i.id, notify: false, attempts: 0 }));
    state.seeded = true;
    summary.seeded = true;
  } else {
    for (const item of items) {
      if (state.seen.includes(item.id)) continue;
      state.seen.unshift(item.id);
      state.pending.push({ id: item.id, notify: true, attempts: 0 });
      summary.newIds.push(item.id);
    }
    state.seen.length = Math.min(state.seen.length, SEEN_MAX);
  }

  // Re-fetch recent recalls now and then: pages get updated with more stores.
  const refreshCutoff = now.getTime() - REFRESH_DAYS * 864e5;
  const stale = recalls.find((r) =>
    Date.parse(r.published) > refreshCutoff &&
    now.getTime() - Date.parse(r.fetchedAt || 0) > REFRESH_HOURS * 36e5 &&
    !state.pending.some((p) => p.id === r.id));
  if (stale) state.pending.push({ id: stale.id, notify: false, attempts: 0, refresh: true });

  // Fetch detail pages (newest first, notify-worthy ones before refreshes).
  state.pending.sort((a, b) => Number(b.notify) - Number(a.notify));
  const toNotify = [];
  const work = state.pending.splice(0, DETAILS_PER_RUN);
  for (const job of work) {
    const item = byId.get(job.id) || recalls.find((r) => r.id === job.id);
    if (!item) continue; // dropped off the feed
    let recall;
    try {
      recall = parseDetail(await fetchText(item.url, fetchImpl), item);
      summary.fetched.push(job.id);
    } catch (e) {
      job.attempts++;
      summary.failed.push({ id: job.id, error: String(e.message || e) });
      if (job.attempts < MAX_ATTEMPTS) {
        state.pending.push(job);
        continue;
      }
      if (job.refresh) continue;
      recall = fromRssOnly(item); // give up on the page, still notify with RSS text
    }
    recall.fetchedAt = now.toISOString();
    const prev = recalls.find((r) => r.id === recall.id);
    recall.firstSeen = prev?.firstSeen || now.toISOString();
    if (prev?.en && prev.en.hash === textHash(recall)) recall.en = prev.en; // text unchanged
    upsert(recalls, recall);
    if (job.notify) toNotify.push(recall);
  }

  if (toNotify.length) summary.notified = await notifyAll(env, toNotify, { fetchImpl });

  // English translations, after notifying so pushes are never delayed by AI.
  let translated = 0;
  if (env.AI) {
    summary.translated = [];
    const retryAfter = now.getTime() - 6 * 36e5; // back off 6 h after a failed translation
    const blocked = (x) => x.enError && x.enError.version === TRANSLATE_VERSION && Date.parse(x.enError.at) > retryAfter;
    const todo = recalls.filter((x) => (!x.en || x.en.hash !== textHash(x)) && !blocked(x));
    for (const r of todo.slice(0, TRANSLATE_PER_RUN)) {
      try {
        r.en = await translateRecall(env.AI, r);
        delete r.enError;
        summary.translated.push(r.id);
      } catch (e) {
        delete r.en; // never keep an older, unchecked translation around
        r.enError = { at: now.toISOString(), version: TRANSLATE_VERSION, message: String(e.message || e).slice(0, 300) };
        summary.translateError = r.enError.message;
      }
      translated++;
    }
  }

  state.lastPoll = now.toISOString();
  if (!summary.failed.length) state.lastError = null;
  else state.lastError = { at: now.toISOString(), message: summary.failed.map((f) => f.error).join('; ') };
  if (summary.newIds.length) state.lastNew = now.toISOString();

  await kv.put(KEYS.state, JSON.stringify(state));
  if (work.length || translated) await kv.put(KEYS.recalls, JSON.stringify(recalls));
  return summary;
}

/** Push each recall to every subscription whose settings want it. */
export async function notifyAll(env, recalls, { fetchImpl = fetch } = {}) {
  const subs = await listSubscriptions(env.KV);
  let sent = 0;
  for (const sub of subs) {
    for (const recall of recalls) {
      const d = decide(recall, sub.settings);
      if (!d.notify) continue;
      const note = notificationFor(recall, sub.settings);
      const res = await sendPush(env, sub.subscription, note, { fetchImpl, urgency: note.silent ? 'normal' : 'high' });
      if (res.ok) sent++;
      if (res.gone) {
        await env.KV.delete(sub.key);
        break;
      }
    }
  }
  return sent;
}
