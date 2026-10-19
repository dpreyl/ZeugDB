/* ZeugDB Service Worker — Offline-First
 *
 * Install: holt '/', parst das HTML nach allen <script src> und <link href>
 *          Referenzen und cached die komplette App. Dann sofort aktivieren.
 * Activate: löscht alte Caches, übernimmt Kontrolle aller Clients.
 * Fetch:
 *   - Navigation → Cache, Fallback auf '/'
 *   - .js/.css / _app/ → Cache-First, dann Network, Fallback auf Cache
 *   - Sonst → Network-First, Fallback auf Cache, dann '/' (Safety-Net)
 */
const CACHE = 'zeugdb-v3';

/**
 * Holt die Index-Seite, extrahiert alle JS/CSS/Asset-URLs und
 * cached die komplette App in einem Schritt.
 */
async function precacheApp(cache) {
  // 1. '/' holen
  const indexResp = await fetch('/');
  const html = await indexResp.text();

  // 2. Aus dem HTML alle referenzierten Assets extrahieren
  const urls = new Set(['/']);

  // <script src="...">
  const scriptMatches = html.match(/<script src="([^"]+)"/g) || [];
  for (const m of scriptMatches) {
    const src = m.match(/src="([^"]+)"/)[1];
    urls.add(src);
  }

  // <link href="..." rel="stylesheet">
  const linkMatches = html.match(/<link href="([^"]+)" rel="stylesheet"/g) || [];
  for (const m of linkMatches) {
    const href = m.match(/href="([^"]+)"/)[1];
    urls.add(href);
  }

  // Statische Assets
  urls.add('/manifest.json');
  urls.add('/icon-192.png');
  urls.add('/icon-512.png');
  urls.add('/sw.js');

  // 3. Alles parallel cachen
  await cache.addAll(Array.from(urls));
  console.log('[SW] install – precached', urls.size, 'resources');
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(precacheApp)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      // 2. Scanne den Cache nach JS/CSS Chunks die im ersten Besuch
      //    dynamisch gecached wurden, und behalte sie.
      const keys = await cache.keys();
      console.log('[SW] activate – cached entries:', keys.length);

      // 3. Alte Caches aufräumen
      return caches.keys().then(all =>
        Promise.all(
          all.filter(name => name !== CACHE).map(name => caches.delete(name))
        )
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // --- Navigation (Seitenwechsel) ---
  if (request.mode === 'navigate' ||
      (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      caches.match(request)
        .then(cached => cached || caches.match('/'))
        .then(resp =>
          resp || fetch(request)
            .then(net => {
              const clone = net.clone();
              caches.open(CACHE).then(c => c.put(request, clone));
              return net;
            })
            .catch(() => caches.match('/'))
        )
    );
    return;
  }

  // --- Statische App-Assets (.js, .css, _app/, assets/) ---
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
      url.pathname.startsWith('/_app/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request)
        .then(cached => cached || fetch(request))
        .then(resp => {
          // Cache nur bei Erfolg (nicht bei 404 etc.)
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match('/')) // Safety-Net
    );
    return;
  }

  // --- Sonstiges (API, Git, ...) → Network-First ---
  event.respondWith(
    fetch(request)
      .then(net => {
        if (net.ok) {
          const clone = net.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return net;
      })
      .catch(() => caches.match(request))
      .catch(() => caches.match('/')) // Safety-Net: zeige App statt Fehler
  );
});
