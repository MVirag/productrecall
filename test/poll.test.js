// End-to-end test of the scheduled job with a fake KV and a fake network that
// serves the real fixtures. Push messages are decrypted like a browser would
// (RFC 8291) to check what the phone would actually receive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import nodeCrypto from 'node:crypto';
import { poll, loadState, loadRecalls } from '../src/poll.js';
import { FEED_URL } from '../src/parse.js';
import worker from '../src/worker.js';

const fx = (p) => fs.readFileSync(new URL(`./fixtures/${p}`, import.meta.url), 'utf8');
const RSS = fx('rss.xml');
const PAGE_DIR = new URL('./fixtures/pages/', import.meta.url);

function fakeKV() {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); return v == null ? null : type === 'json' ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
}

/** Fake network: RSS, recall pages (from fixtures, else a minimal page), push endpoint. */
function fakeNet({ rss, pushStatus = 201 }) {
  const pushes = [];
  const fetchImpl = async (url, init = {}) => {
    url = String(url);
    if (url === FEED_URL) return new Response(rss());
    if (url.startsWith('https://fcm.googleapis.com/')) {
      pushes.push({ url, init });
      return new Response('', { status: pushStatus });
    }
    const id = url.split('/tilbagekaldte-produkter/')[1]?.replace(/\//g, '-');
    const f = id && new URL(`${id}.html`, PAGE_DIR);
    if (f && fs.existsSync(f)) return new Response(fs.readFileSync(f, 'utf8'));
    return new Response('<h1 class="heading">x</h1><div class="text"><div class="rich-text"><h2>Hvilken fødevare tilbagekaldes</h2><p>Testvare 100 g</p><h2>Hvorfor tilbagekaldes produktet</h2><p>Listeria er påvist i produktet.</p><h2>Hvad skal du gøre som forbruger</h2><p>Kassér produktet.</p></div></div><footer>');
  };
  return { fetchImpl, pushes };
}

// --- a fake browser push subscription we can decrypt -----------------------
function fakeBrowser() {
  const ecdh = nodeCrypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = nodeCrypto.randomBytes(16);
  const subscription = {
    endpoint: `https://fcm.googleapis.com/fcm/send/test-${nodeCrypto.randomBytes(4).toString('hex')}`,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
  };
  function decrypt(body) {
    const buf = Buffer.from(body);
    const salt = buf.subarray(0, 16);
    const idlen = buf[20];
    const serverPub = buf.subarray(21, 21 + idlen);
    const ct = buf.subarray(21 + idlen);
    const secret = ecdh.computeSecret(serverPub);
    const info = Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), serverPub]);
    const ikm = Buffer.from(nodeCrypto.hkdfSync('sha256', secret, auth, info, 32));
    const cek = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
    const nonce = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
    const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce);
    d.setAuthTag(ct.subarray(ct.length - 16));
    let pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
    let end = pt.length;
    while (end > 0 && pt[end - 1] === 0) end--;
    assert.equal(pt[end - 1], 2, 'last-record padding delimiter');
    return JSON.parse(pt.subarray(0, end - 1).toString('utf8'));
  }
  return { subscription, decrypt };
}

function vapidKeys() {
  const ecdh = nodeCrypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { VAPID_PUBLIC_KEY: ecdh.getPublicKey().toString('base64url'), VAPID_PRIVATE_KEY: ecdh.getPrivateKey().toString('base64url') };
}

function verifyVapid(header, publicKey, endpoint) {
  const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, publicKey);
  const [h, p, s] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(p, 'base64url'));
  assert.equal(claims.aud, new URL(endpoint).origin);
  const raw = Buffer.from(publicKey, 'base64url');
  const key = nodeCrypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.ok(nodeCrypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')), 'VAPID signature');
}

// Feed as it was "yesterday": the newest recall (Coronet) not yet published.
const firstItem = RSS.indexOf('<item>');
const RSS_YESTERDAY = RSS.slice(0, firstItem) + RSS.slice(RSS.indexOf('</item>', firstItem) + 7);

test('first run seeds silently, a new recall is pushed once and decrypts correctly', async () => {
  const KV = fakeKV();
  const env = { KV, ...vapidKeys(), VAPID_SUBJECT: 'https://example.workers.dev' };
  const phone = fakeBrowser();
  // Subscribed user who shops at Lidl, only wants their own stores.
  await KV.put('sub:abc', JSON.stringify({ subscription: phone.subscription, settings: { chains: ['Lidl'], mode: 'mine', words: [], lang: 'da' } }));

  let feed = RSS_YESTERDAY;
  const net = fakeNet({ rss: () => feed });

  // 1) first run: no notifications, existing recalls marked seen, feed filled.
  const s1 = await poll(env, { fetchImpl: net.fetchImpl });
  assert.equal(s1.seeded, true);
  assert.equal(net.pushes.length, 0);
  assert.equal((await loadRecalls(KV)).length, 6);
  assert.equal((await loadState(KV)).seen.length, 40);

  // 2) nothing new: still silent, keeps filling the feed in the background.
  await poll(env, { fetchImpl: net.fetchImpl });
  assert.equal(net.pushes.length, 0);
  assert.equal((await loadRecalls(KV)).length, 12);

  // 3) Coronet recall (sold at Lidl among others) appears -> exactly one push.
  feed = RSS;
  const s3 = await poll(env, { fetchImpl: net.fetchImpl });
  assert.deepEqual(s3.newIds, ['2026-nov-tilbagekald-smaakager-coronet']);
  assert.equal(net.pushes.length, 1);
  const { init, url } = net.pushes[0];
  assert.equal(init.headers['content-encoding'], 'aes128gcm');
  verifyVapid(init.headers.authorization, env.VAPID_PUBLIC_KEY, url);
  const msg = phone.decrypt(init.body);
  assert.equal(msg.title, '⚠ Din butik: Lidl · FAVORINA Pebernødder, 400 g +12 flere');
  assert.match(msg.body, /Bedst før 30\.09\.2026 \+2 · Mykotoksiner · Kassér/);
  assert.equal(msg.url, '/#/recall/2026-nov-tilbagekald-smaakager-coronet');

  // 4) same feed again: no duplicate push.
  await poll(env, { fetchImpl: net.fetchImpl });
  assert.equal(net.pushes.length, 1);
  assert.equal((await loadRecalls(KV))[0].id, '2026-nov-tilbagekald-smaakager-coronet');
});

test('"only my stores" skips other chains; dead subscriptions are removed', async () => {
  const KV = fakeKV();
  const env = { KV, ...vapidKeys() };
  const phone = fakeBrowser();
  await KV.put('sub:x', JSON.stringify({ subscription: phone.subscription, settings: { chains: ['Aldi'], mode: 'mine', words: [] } }));
  let feed = RSS_YESTERDAY;
  const net = fakeNet({ rss: () => feed, pushStatus: 410 });
  await poll(env, { fetchImpl: net.fetchImpl });
  feed = RSS;
  await poll(env, { fetchImpl: net.fetchImpl });
  assert.equal(net.pushes.length, 0, 'Coronet not sold at Aldi');
  assert.ok(await KV.get('sub:x'), 'kept');

  await KV.put('sub:x', JSON.stringify({ subscription: phone.subscription, settings: { chains: [], mode: 'all', words: [] } }));
  feed = RSS_YESTERDAY.replace('tilbagekald-af-oksekebab', 'tilbagekald-af-oksekebab-ny'); // a "new" recall
  await poll(env, { fetchImpl: net.fetchImpl });
  assert.equal(net.pushes.length, 1);
  assert.equal(await KV.get('sub:x'), null, '410 Gone removes the subscription');
});

test('push keys are generated once and kept in KV when no secrets are set', async () => {
  const KV = fakeKV();
  const env = { KV, ASSETS: { fetch: () => new Response('') } };
  const cfg1 = await (await worker.fetch(new Request('https://x.dev/api/config'), env)).json();
  const cfg2 = await (await worker.fetch(new Request('https://x.dev/api/config'), env)).json();
  assert.match(cfg1.vapidPublicKey, /^[A-Za-z0-9_-]{87}$/);
  assert.equal(cfg1.vapidPublicKey, cfg2.vapidPublicKey);
  // and they work: a push to a fake phone decrypts and verifies
  const phone = fakeBrowser();
  await KV.put('sub:a', JSON.stringify({ subscription: phone.subscription, settings: { mode: 'all', chains: [], words: [] } }));
  const net = fakeNet({ rss: () => RSS_YESTERDAY });
  await poll(env, { fetchImpl: net.fetchImpl });
  const net2 = fakeNet({ rss: () => RSS });
  await poll(env, { fetchImpl: net2.fetchImpl });
  assert.equal(net2.pushes.length, 1);
  verifyVapid(net2.pushes[0].init.headers.authorization, cfg1.vapidPublicKey, net2.pushes[0].url);
  assert.ok(phone.decrypt(net2.pushes[0].init.body).title);
});

test('feed outage is recorded, not fatal', async () => {
  const KV = fakeKV();
  const s = await poll({ KV }, { fetchImpl: async () => new Response('down', { status: 503 }) });
  assert.match(s.error, /503/);
  assert.match((await loadState(KV)).lastError.message, /503/);
});

test('API: subscribe, settings, test push and replay', async () => {
  const KV = fakeKV();
  const env = { KV, ...vapidKeys(), ASSETS: { fetch: () => new Response('asset') } };
  const phone = fakeBrowser();
  const net = fakeNet({ rss: () => RSS });
  await poll(env, { fetchImpl: net.fetchImpl });

  const realFetch = globalThis.fetch;
  globalThis.fetch = net.fetchImpl; // the API uses global fetch for push
  try {
    const call = (path, body) => worker.fetch(new Request(`https://x.dev${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : {}), env);

    assert.equal((await call('/api/subscribe', { subscription: { endpoint: 'https://evil.example/x', keys: phone.subscription.keys } })).status, 400);
    const sub = await (await call('/api/subscribe', { subscription: phone.subscription, settings: { chains: ['Rema 1000'], mode: 'mine', words: ['kebab'], lang: 'en', extra: 'x' } })).json();
    assert.deepEqual(sub.settings, { chains: ['Rema 1000'], mode: 'mine', words: ['kebab'], lang: 'en' });

    const t = await call('/api/test', { endpoint: phone.subscription.endpoint });
    assert.equal(t.status, 200);
    assert.match(phone.decrypt(net.pushes.at(-1).init.body).title, /^Test notification/);

    assert.equal((await call('/api/replay', { endpoint: phone.subscription.endpoint, id: 'nope' })).status, 429, 'rate limited');
    const prev = JSON.parse(KV.m.get([...KV.m.keys()].find((k) => k.startsWith('sub:'))));
    prev.lastTest = new Date(Date.now() - 10_000).toISOString();
    KV.m.set([...KV.m.keys()].find((k) => k.startsWith('sub:')), JSON.stringify(prev));

    const r = await call('/api/replay', { endpoint: phone.subscription.endpoint, id: '2026-nov-tilbagekald-af-oksekebab' });
    assert.equal(r.status, 200);
    const msg = phone.decrypt(net.pushes.at(-1).init.body);
    assert.equal(msg.title, "⚠ Your store: Rema 1000 · Heat'n Eat Okse kebab");
    assert.match(msg.body, /^400 g · Best before 07\.04\.2028 \+1 · Prohibited cattle material · Return to store or discard$/);

    const list = await (await call('/api/recalls')).json();
    assert.ok(list.recalls.length >= 6);
    assert.equal(list.recalls[0].raw, undefined, 'list omits raw text');
    const one = await (await call('/api/recalls/2026-nov-tilbagekald-af-oksekebab')).json();
    assert.match(one.raw.product, /EAN/);
    assert.equal((await call('/api/admin/poll', {})).status, 403);
    assert.equal(await (await call('/index.html')).text(), 'asset');
  } finally {
    globalThis.fetch = realFetch;
  }
});
