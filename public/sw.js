// Service worker: app-shell cache, offline recall list, push notifications.
const VERSION = 'v7';
const SHELL = `shell-${VERSION}`;
const DATA = 'data';
const SHELL_FILES = [
  '/', '/index.html', '/app.js', '/i18n.js', '/styles.css', '/manifest.webmanifest',
  '/icons.js', '/shared/chains.js', '/shared/detail.js', '/shared/words.js', '/shared/summary.js', '/shared/severity.js',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== DATA) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/recalls')) {
    // Network first, fall back to the last copy so the feed works offline.
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res.ok) (await caches.open(DATA)).put(e.request, res.clone());
        return res;
      } catch {
        return (await caches.match(e.request)) || new Response('{"error":"offline"}', { status: 503, headers: { 'content-type': 'application/json' } });
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/api/')) return;
  // App shell: cache first, refresh in the background.
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(async (res) => {
      if (res.ok) (await caches.open(SHELL)).put(e.request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await fresh) || caches.match('/index.html');
  })());
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Tilbagekald Alert', {
    body: d.body || '',
    tag: d.tag || undefined,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    image: d.image || undefined,
    data: { url: d.url || '/' },
    silent: !!d.silent,      // low-severity recalls arrive without sound/vibration
    renotify: !d.silent && !!d.tag,
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).origin === location.origin);
    if (win) {
      win.postMessage({ type: 'open', url });
      return win.focus();
    }
    return self.clients.openWindow(url);
  })());
});
