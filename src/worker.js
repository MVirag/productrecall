// Cloudflare Worker entry: JSON API under /api/*, static PWA from ./public,
// and the 15-minute Cron Trigger that polls Fødevarestyrelsen.

import { poll, loadState, loadRecalls, listSubscriptions, KEYS } from './poll.js';
import { count, lastDays, dailyRecords, settingsOverview, RELIABILITY, RETENTION_DAYS } from './stats.js';
import { sendPush, isValidSubscription, getVapid } from './push.js';
import { isCurrentTranslation } from './translate.js';
import { notificationFor } from '../public/shared/summary.js';
import { DEFAULT_CHAINS } from '../public/shared/chains.js';
import { ALLERGENS, LEVELS } from '../public/shared/severity.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

async function subKey(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return KEYS.subPrefix + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Keep only the settings the server needs, with sane limits. */
function cleanSettings(s = {}) {
  const list = (v, max, len) =>
    (Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, len)).filter(Boolean).slice(0, max);
  return {
    chains: list(s.chains, 40, 40),
    mode: s.mode === 'mine' ? 'mine' : 'all',
    words: list(s.words, 30, 40),
    lang: s.lang === 'en' ? 'en' : 'da',
    allergens: list(s.allergens, 14, 20).filter((a) => ALLERGENS.includes(a)),
    vulnerable: s.vulnerable === true,
    quiet: list(s.quiet, 6, 20).filter((l) => LEVELS.includes(l)),
  };
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function getSub(env, endpoint) {
  if (typeof endpoint !== 'string') return null;
  const key = await subKey(endpoint);
  const v = await env.KV.get(key, 'json');
  return v ? { key, ...v } : null;
}

/** Only translations made and checked by the current translator are ever sent. */
function publicRecall(r) {
  const { en, enError, ...rest } = r;
  return isCurrentTranslation(en) ? { ...rest, en } : rest;
}

/** Strip the bulky raw text from list responses. */
function light(r) {
  const { raw, ...rest } = publicRecall(r);
  return rest;
}

/** Count one anonymous event without delaying the response (awaited when there is no ctx, e.g. in tests). */
function track(ctx, env, name) {
  const p = count(env, name);
  if (ctx?.waitUntil) { ctx.waitUntil(p); return undefined; }
  return p;
}

const isAdmin = (request, env) => !!env.ADMIN_TOKEN && request.headers.get('authorization') === `Bearer ${env.ADMIN_TOKEN}`;

async function handleApi(request, env, ctx, url) {
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  // The app tells the server where a request came from ("scan", "push") on requests it has to make anyway.
  const via = url.searchParams.get('via');

  if (path === '/api/config' && method === 'GET') {
    const vapid = await getVapid(env).catch(() => null);
    return json({ vapidPublicKey: vapid?.publicKey || null, defaultChains: DEFAULT_CHAINS });
  }

  if (path === '/api/status' && method === 'GET') {
    const s = await loadState(env.KV);
    // Reliability counters only (no usage numbers); anonymous sums for the last 7 days.
    return json({ seeded: s.seeded, lastPoll: s.lastPoll, lastNew: s.lastNew || null, lastError: s.lastError, pending: s.pending.length, last7days: await lastDays(env, 7, RELIABILITY) });
  }

  if (path === '/api/recalls' && method === 'GET') {
    const recalls = await loadRecalls(env.KV);
    const s = await loadState(env.KV);
    await track(ctx, env, via === 'scan' ? 'scan_checks' : 'feed_loads');
    return json({ recalls: recalls.map(light), lastPoll: s.lastPoll, lastError: s.lastError });
  }

  const one = path.match(/^\/api\/recalls\/([a-z0-9æøå-]+)$/);
  if (one && method === 'GET') {
    const r = (await loadRecalls(env.KV)).find((x) => x.id === decodeURIComponent(one[1]));
    if (r) await track(ctx, env, via === 'push' ? 'recall_views_push' : 'recall_views');
    return r ? json(publicRecall(r)) : json({ error: 'not_found' }, 404);
  }

  if (path === '/api/subscribe' && method === 'POST') {
    const body = await readBody(request);
    if (!isValidSubscription(body.subscription)) return json({ error: 'invalid_subscription' }, 400);
    const key = await subKey(body.subscription.endpoint);
    const prev = await env.KV.get(key, 'json');
    const record = {
      subscription: { endpoint: body.subscription.endpoint, keys: body.subscription.keys },
      settings: cleanSettings(body.settings),
      created: prev?.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    await env.KV.put(key, JSON.stringify(record));
    await track(ctx, env, prev ? 'settings_synced' : 'notifications_on');
    return json({ ok: true, settings: record.settings });
  }

  if (path === '/api/unsubscribe' && method === 'POST') {
    const body = await readBody(request);
    if (typeof body.endpoint === 'string') {
      const key = await subKey(body.endpoint);
      const existed = await env.KV.get(key);
      await env.KV.delete(key);
      if (existed) await track(ctx, env, 'notifications_off');
    }
    return json({ ok: true });
  }

  if ((path === '/api/test' || path === '/api/replay') && method === 'POST') {
    const body = await readBody(request);
    const sub = await getSub(env, body.endpoint);
    if (!sub) return json({ error: 'not_subscribed' }, 404);
    if (sub.lastTest && Date.now() - Date.parse(sub.lastTest) < 5000) return json({ error: 'too_fast' }, 429);
    let data;
    if (path === '/api/test') {
      const en = sub.settings.lang === 'en';
      data = {
        title: en ? 'Test notification · Tilbagekald Alert' : 'Testnotifikation · Tilbagekald Alert',
        body: en ? 'Push works. Tap to open the app.' : 'Push virker. Tryk for at åbne appen.',
        tag: 'test', url: '/#/settings',
      };
    } else {
      const recall = (await loadRecalls(env.KV)).find((r) => r.id === body.id);
      if (!recall) return json({ error: 'not_found' }, 404);
      data = notificationFor(recall, sub.settings);
      data.tag = `replay-${recall.id}`;
    }
    sub.lastTest = new Date().toISOString();
    const { key, ...record } = sub;
    await env.KV.put(key, JSON.stringify(record));
    const res = await sendPush(env, sub.subscription, data);
    if (res.gone) await env.KV.delete(key);
    return json({ ok: res.ok, status: res.status, gone: res.gone, detail: res.detail }, res.ok ? 200 : 502);
  }

  // Manual poll, for debugging: curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" .../api/admin/poll
  if (path === '/api/admin/poll' && method === 'POST') {
    if (!isAdmin(request, env)) return json({ error: 'forbidden' }, 403);
    return json(await poll(env));
  }

  // Anonymous daily counters and totals over stored settings. Needs ADMIN_TOKEN.
  if (path === '/api/admin/stats' && method === 'GET') {
    if (!isAdmin(request, env)) return json({ error: 'forbidden' }, 403);
    const subs = await listSubscriptions(env.KV);
    return json({ retentionDays: RETENTION_DAYS, days: await dailyRecords(env, 30), settings: settingsOverview(subs) });
  }

  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, ctx, url);
      } catch (e) {
        console.error(e);
        return json({ error: 'server_error', message: String(e.message || e) }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    await getVapid(env); // create push keys on the first run after deploy
    const summary = await poll(env);
    console.log(JSON.stringify({ cron: event.cron, ...summary }));
  },
};
