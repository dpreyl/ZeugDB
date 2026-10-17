/* ZeugDB Service Worker — Offline-First */
const CACHE_NAME = 'zeugdb-v1';
const PRE_CACHE_URLS = [ '/', '/manifest.json' ];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRE_CACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // App-Assets: Cache-First
  if (['/', '/index.html'].includes(url.pathname) ||
      url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
      url.pathname.startsWith('/_app/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(resp =>
        resp || fetch(request).then(net => {
          const clone = net.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return net;
        }).catch(() => caches.match('/'))
      )
    );
    return;
  }

  // Default: Network-First mit Cache-Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
