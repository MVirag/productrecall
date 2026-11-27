// Generate a VAPID key pair (P-256) for Web Push.
// Prints the values for .dev.vars / `wrangler secret put`.
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
const b64url = (u8) => Buffer.from(u8).toString('base64url');
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`ADMIN_TOKEN=${b64url(crypto.getRandomValues(new Uint8Array(24)))}`);
