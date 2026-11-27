// Web Push sending (RFC 8291 aes128gcm + RFC 8292 VAPID) via WebCrypto.
import { buildPushPayload } from '@block65/webcrypto-web-push';

// Only send to real push services, so the API can't be used to make the
// Worker POST to arbitrary URLs.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/,
  /^jmt17\.google\.com$/,
];

export function isValidSubscription(sub) {
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  try {
    const u = new URL(sub.endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

const b64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * VAPID keys: from secrets if set, otherwise generated once and kept in KV,
 * so a fresh deploy works without any manual key setup.
 */
export async function getVapid(env) {
  const subject = env.VAPID_SUBJECT || 'https://tilbagekald-alert.workers.dev';
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    return { subject, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  }
  if (!env.KV) throw new Error('VAPID keys are not configured');
  let keys = await env.KV.get('vapid', 'json');
  if (!keys) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    keys = { publicKey: b64url(raw), privateKey: jwk.d, created: new Date().toISOString() };
    await env.KV.put('vapid', JSON.stringify(keys));
  }
  return { subject, publicKey: keys.publicKey, privateKey: keys.privateKey };
}

/**
 * Send one notification. `data` is the JSON the service worker receives.
 * Returns { ok, status, gone } – gone means the subscription is dead (404/410).
 */
export async function sendPush(env, subscription, data, { ttl = 24 * 3600, urgency = 'high', fetchImpl = fetch } = {}) {
  const payload = await buildPushPayload(
    { data: { ...data, sentAt: new Date().toISOString() }, options: { ttl, urgency } },
    { endpoint: subscription.endpoint, expirationTime: null, keys: subscription.keys },
    await getVapid(env),
  );
  const res = await fetchImpl(subscription.endpoint, payload);
  let detail = '';
  if (!res.ok) detail = (await res.text().catch(() => '')).slice(0, 300);
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, detail };
}
