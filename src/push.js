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

export function vapidFromEnv(env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error('VAPID keys are not configured');
  return {
    subject: env.VAPID_SUBJECT || 'https://tilbagekald-alert.workers.dev',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}

/**
 * Send one notification. `data` is the JSON the service worker receives.
 * Returns { ok, status, gone } – gone means the subscription is dead (404/410).
 */
export async function sendPush(env, subscription, data, { ttl = 24 * 3600, urgency = 'high', fetchImpl = fetch } = {}) {
  const payload = await buildPushPayload(
    { data: { ...data, sentAt: new Date().toISOString() }, options: { ttl, urgency } },
    { endpoint: subscription.endpoint, expirationTime: null, keys: subscription.keys },
    vapidFromEnv(env),
  );
  const res = await fetchImpl(subscription.endpoint, payload);
  let detail = '';
  if (!res.ok) detail = (await res.text().catch(() => '')).slice(0, 300);
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, detail };
}
