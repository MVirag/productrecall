// Anonymous counters: what is counted, what is never stored, and how it ages out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import nodeCrypto from 'node:crypto';
import { addCounts, count, lastDays, dailyRecords, settingsOverview, dayKey, ALL_EVENTS, RELIABILITY, USAGE, RETENTION_DAYS } from '../src/stats.js';
import { poll } from '../src/poll.js';
import { FEED_URL } from '../src/parse.js';
import worker from '../src/worker.js';

function fakeKV() {
  const m = new Map(); const ttl = new Map();
  return {
    m, ttl,
    async get(k, type) { const v = m.get(k); return v == null ? null : type === 'json' ? JSON.parse(v) : v; },
    async put(k, v, opts) { m.set(k, v); if (opts?.expirationTtl) ttl.set(k, opts.expirationTtl); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
}
const NOW = new Date('2026-11-28T12:00:00Z');

test('counters hold only event names and numbers for one day, and expire on their own', async () => {
  const env = { KV: fakeKV() };
  await count(env, 'push_sent');
  await addCounts(env, { push_sent: 2, push_gone: 1 }, NOW);
  const rec = JSON.parse(env.KV.m.get(dayKey(NOW)));
  assert.deepEqual(Object.keys(rec).sort(), ['_total', 'push_gone', 'push_sent'].sort(), 'no field other than counters');
  assert.ok(Object.values(rec).every((v) => typeof v === 'number'), 'numbers only');
  assert.equal(env.KV.ttl.get(dayKey(NOW)), RETENTION_DAYS * 86400, 'the record expires after 35 days');
  assert.match(dayKey(NOW), /^stats:\d{4}-\d{2}-\d{2}$/, 'the key carries the day and nothing else');
});

test('unknown names are ignored, so nothing free-form can be stored', async () => {
  const env = { KV: fakeKV() };
  assert.equal(await addCounts(env, { 'user:alice@example.com': 1, __proto__x: 1, push_sent: 'many', recall_views: -1, bogus: 3 }, NOW), false);
  assert.equal(env.KV.m.size, 0);
  assert.ok(ALL_EVENTS.every((n) => /^[a-z_]+$/.test(n)), 'allow-listed names are plain identifiers');
  assert.deepEqual(ALL_EVENTS, [...RELIABILITY, ...USAGE]);
});

test('daily cap protects the KV write limit; failures never throw', async () => {
  const env = { KV: fakeKV() };
  await addCounts(env, { feed_loads: 400 }, NOW);
  assert.equal(await addCounts(env, { feed_loads: 1 }, NOW), false, 'cap reached: no more writes that day');
  assert.equal(JSON.parse(env.KV.m.get(dayKey(NOW))).feed_loads, 400);
  const broken = { KV: { get: async () => { throw new Error('KV down'); }, put: async () => { throw new Error('KV down'); } } };
  assert.equal(await addCounts(broken, { push_sent: 1 }, NOW), false);
  assert.equal(await addCounts({}, { push_sent: 1 }, NOW), false);
});

test('sums over days; the status view only ever sees reliability counters', async () => {
  const env = { KV: fakeKV() };
  await addCounts(env, { push_sent: 3, feed_loads: 9 }, NOW);
  await addCounts(env, { push_sent: 2, notifications_on: 1 }, new Date(NOW.getTime() - 2 * 864e5));
  assert.equal((await lastDays(env, 7, RELIABILITY, NOW)).push_sent, 5);
  assert.equal((await lastDays(env, 1, RELIABILITY, NOW)).push_sent, 3);
  assert.equal('feed_loads' in (await lastDays(env, 7, RELIABILITY, NOW)), false);
  const rows = await dailyRecords(env, 30, NOW);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].day, '2026-11-28');
  assert.equal('_total' in rows[0], false);
});

test('settings overview: health-related settings hidden below 5 devices; typed text never listed', () => {
  const sub = (s) => ({ settings: { mode: 'all', lang: 'da', chains: [], allergens: [], vulnerable: false, words: ['secret word'], ...s } });
  const few = settingsOverview([sub({ chains: ['Netto', 'my local shop'], allergens: ['æg'], vulnerable: true })]);
  assert.equal(few.devices, 1);
  assert.deepEqual(few.chains, { Netto: 1, other: 1 }, 'a custom store name counts as "other"');
  assert.match(few.allergens, /hidden until at least 5/);
  assert.match(few.vulnerable_household, /hidden/);
  assert.equal(JSON.stringify(few).includes('secret word'), false, 'watch words are never reported');
  assert.equal(JSON.stringify(few).includes('my local shop'), false);
  const five = settingsOverview(Array.from({ length: 5 }, (_, i) => sub({ allergens: i < 2 ? ['æg'] : [], vulnerable: i === 0 })));
  assert.deepEqual(five.allergens, { æg: 2 });
  assert.equal(five.vulnerable_household, 1);
});

// ---------------------------------------------------------------- through the real handlers

const RSS = fs.readFileSync(new URL('./fixtures/rss.xml', import.meta.url), 'utf8');
const PAGES = new URL('./fixtures/pages/', import.meta.url);
function net({ rss = () => RSS, push = 201, failPages = false } = {}) {
  return async (url) => {
    url = String(url);
    if (url === FEED_URL) { const body = rss(); return body === null ? new Response('down', { status: 503 }) : new Response(body); }
    if (url.startsWith('https://fcm.googleapis.com/')) return new Response('', { status: push });
    if (failPages) return new Response('no', { status: 500 });
    const id = url.split('/tilbagekaldte-produkter/')[1]?.replace(/\//g, '-');
    const f = id && new URL(`${id}.html`, PAGES);
    return f && fs.existsSync(f) ? new Response(fs.readFileSync(f, 'utf8')) : new Response('x', { status: 404 });
  };
}
function phone() {
  const e = nodeCrypto.createECDH('prime256v1'); e.generateKeys();
  return { endpoint: `https://fcm.googleapis.com/fcm/send/${nodeCrypto.randomBytes(4).toString('hex')}`, keys: { p256dh: e.getPublicKey().toString('base64url'), auth: nodeCrypto.randomBytes(16).toString('base64url') } };
}
const vapid = () => { const e = nodeCrypto.createECDH('prime256v1'); e.generateKeys(); return { VAPID_PUBLIC_KEY: e.getPublicKey().toString('base64url'), VAPID_PRIVATE_KEY: e.getPrivateKey().toString('base64url') }; };
const today = (env) => JSON.parse(env.KV.m.get(dayKey()) || '{}');
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== '_total'));

test('poll job counts reliability: new recalls, unsure fields, pushes sent / gone / refused, feed failures', async () => {
  const env = { KV: fakeKV(), ...vapid() };
  const first = RSS.indexOf('<item>');
  const yesterday = RSS.slice(0, first) + RSS.slice(RSS.indexOf('</item>', first) + 7);
  let feed = yesterday;
  const fetchImpl = net({ rss: () => feed });
  await env.KV.put('sub:a', JSON.stringify({ subscription: phone(), settings: { mode: 'all' } }));
  await poll(env, { fetchImpl });
  assert.deepEqual(strip(today(env)), {}, 'first run (seeding) counts nothing');
  feed = RSS;
  await poll(env, { fetchImpl });
  const c = strip(today(env));
  assert.equal(c.recalls_new, 1);
  assert.equal(c.push_sent, 1);
  assert.ok(c.parse_unsure === undefined || c.parse_unsure === 1);

  // a device that no longer exists
  const env2 = { KV: fakeKV(), ...vapid() };
  await env2.KV.put('sub:a', JSON.stringify({ subscription: phone(), settings: { mode: 'all' } }));
  feed = yesterday; await poll(env2, { fetchImpl: net({ rss: () => feed, push: 410 }) });
  feed = RSS; await poll(env2, { fetchImpl: net({ rss: () => feed, push: 410 }) });
  assert.equal(strip(today(env2)).push_gone, 1);
  assert.equal(strip(today(env2)).push_sent, undefined);
  const env3 = { KV: fakeKV(), ...vapid() };
  await env3.KV.put('sub:a', JSON.stringify({ subscription: phone(), settings: { mode: 'all' } }));
  feed = yesterday; await poll(env3, { fetchImpl: net({ rss: () => feed, push: 500 }) });
  feed = RSS; await poll(env3, { fetchImpl: net({ rss: () => feed, push: 500 }) });
  assert.equal(strip(today(env3)).push_rejected, 1);

  // feed down
  const env4 = { KV: fakeKV() };
  await poll(env4, { fetchImpl: net({ rss: () => null }) });
  assert.equal(strip(today(env4)).poll_failed, 1);
});

test('request-based usage: the app marks where a request came from; the server counts, nothing else', async () => {
  const env = { KV: fakeKV(), ...vapid(), ASSETS: { fetch: () => new Response('') }, ADMIN_TOKEN: 'secret-token' };
  await poll(env, { fetchImpl: net() }); // seeds recalls
  const call = (path, init) => worker.fetch(new Request(`https://x.dev${path}`, init), env);
  await call('/api/recalls');
  await call('/api/recalls');
  await call('/api/recalls?via=scan');
  await call('/api/recalls?via=something-else'); // unknown marker: counted as a plain load
  const id = '2026-nov-tilbagekald-af-oksekebab';
  const list = await (await call('/api/recalls')).json();
  const known = list.recalls.map((r) => r.id).includes(id) ? id : list.recalls[0].id;
  await call(`/api/recalls/${known}`);
  await call(`/api/recalls/${known}?via=push`);
  await call('/api/recalls/does-not-exist');
  const p = phone();
  const body = (o) => ({ method: 'POST', body: JSON.stringify(o) });
  await call('/api/subscribe', body({ subscription: p, settings: { mode: 'mine' } }));
  await call('/api/subscribe', body({ subscription: p, settings: { mode: 'all' } }));
  await call('/api/unsubscribe', body({ endpoint: p.endpoint }));
  await call('/api/unsubscribe', body({ endpoint: p.endpoint })); // nothing left to turn off
  const c = strip(today(env));
  assert.deepEqual(c, { feed_loads: 4, scan_checks: 1, recall_views: 1, recall_views_push: 1, notifications_on: 1, settings_synced: 1, notifications_off: 1 });
  // nothing identifying is in any counter record
  const all = [...env.KV.m.entries()].filter(([k]) => k.startsWith('stats:')).map(([, v]) => v).join(' ');
  assert.equal(/endpoint|fcm|https?:|\d+\.\d+\.\d+\.\d+|user-agent/i.test(all), false);
});

test('status shows reliability only; admin stats need the token', async () => {
  const env = { KV: fakeKV(), ...vapid(), ASSETS: { fetch: () => new Response('') }, ADMIN_TOKEN: 'secret-token' };
  await addCounts(env, { push_sent: 4, feed_loads: 7, scan_checks: 2 });
  const call = (path, headers) => worker.fetch(new Request(`https://x.dev${path}`, { headers }), env);
  const status = await (await call('/api/status')).json();
  assert.equal(status.last7days.push_sent, 4);
  assert.equal('feed_loads' in status.last7days, false);
  assert.equal('scan_checks' in status.last7days, false);
  assert.equal((await call('/api/admin/stats')).status, 403);
  assert.equal((await call('/api/admin/stats', { authorization: 'Bearer wrong' })).status, 403);
  const admin = await (await call('/api/admin/stats', { authorization: 'Bearer secret-token' })).json();
  assert.equal(admin.retentionDays, 35);
  assert.equal(admin.days[0].feed_loads, 7);
  assert.equal(admin.settings.devices, 0);
  const noToken = { ...env, ADMIN_TOKEN: undefined };
  assert.equal((await worker.fetch(new Request('https://x.dev/api/admin/stats', { headers: { authorization: 'Bearer undefined' } }), noToken)).status, 403, 'closed when no token is configured');
});
