import {
  getTileCacheLifetime,
  isFreshTile,
  isOpenStreetMapTileRequest,
  TILE_CACHE_LIMIT,
  TILE_CACHE_NAME
} from './tile-cache.js';
import { appPath, getAppBase } from './sw-paths.js';

/* ZeugDB Service Worker — Offline-First
 *
 * Install: holt die App-Startseite, parst das HTML nach <script src> und <link href>
 *          Referenzen und cached die komplette App. Dann sofort aktivieren.
 * Activate: löscht alte Caches, übernimmt Kontrolle aller Clients.
 * Fetch:
 *   - Navigation → Cache, Fallback auf die App-Startseite
 *   - OpenStreetMap-Kacheln → TILE_CACHE-First, dann Netzwerk
 *   - .js/.css / _app/ → Cache-First, dann Network, Fallback auf Cache
 *   - Sonst → Network-First, Fallback auf Cache, dann App-Startseite
 */
const CACHE = 'zeugdb-v5';
const APP_BASE = getAppBase(self.registration.scope);
const APP_ROOT = appPath(APP_BASE, '/');

/**
 * Holt die Index-Seite, extrahiert alle JS/CSS/Asset-URLs und
 * cached die komplette App in einem Schritt.
 */
async function precacheApp(cache) {
  // 1. App-Startseite holen
  const indexResp = await fetch(APP_ROOT);
  const html = await indexResp.text();

  // 2. Aus dem HTML alle referenzierten Assets extrahieren
  const urls = new Set([APP_ROOT]);

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
  urls.add(appPath(APP_BASE, '/manifest.json'));
  urls.add(appPath(APP_BASE, '/icon-192.png'));
  urls.add(appPath(APP_BASE, '/icon-512.png'));
  urls.add(appPath(APP_BASE, '/sw.js'));

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
          all.filter(name => name !== CACHE && name !== TILE_CACHE_NAME)
            .map(name => caches.delete(name))
        )
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur tatsächlich angeforderte OSM-Kacheln cachen; es findet kein Vorladen statt.
  if (isOpenStreetMapTileRequest(request)) {
    event.respondWith(serveMapTile(request));
    return;
  }

  // --- Navigation (Seitenwechsel) ---
  if (request.mode === 'navigate' ||
      (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      caches.match(request)
        .then(cached => cached || caches.match(APP_ROOT))
        .then(resp =>
          resp || fetch(request)
            .then(net => {
              const clone = net.clone();
              caches.open(CACHE).then(c => c.put(request, clone));
              return net;
            })
            .catch(() => caches.match(APP_ROOT))
        )
    );
    return;
  }

  // --- Statische App-Assets (.js, .css, _app/, assets/) ---
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
      url.pathname.startsWith(appPath(APP_BASE, '/_app/')) ||
      url.pathname.startsWith(appPath(APP_BASE, '/assets/'))) {
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
        .catch(() => caches.match(APP_ROOT)) // Safety-Net
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
      .catch(() => caches.match(APP_ROOT)) // Safety-Net: zeige App statt Fehler
  );
});

async function serveMapTile(request) {
  const cache = await caches.open(TILE_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached && isFreshTile(cached)) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const lifetime = getTileCacheLifetime(response);
      if (lifetime !== null && response.type !== 'opaque') {
        const headers = new Headers(response.headers);
        const cachedAt = Date.now();
        headers.set('X-ZeugDB-Cached-At', String(cachedAt));
        headers.set('X-ZeugDB-Cache-Expires-At', String(cachedAt + lifetime));
        await cache.put(request, new Response(response.clone().body, {
          status: response.status,
          statusText: response.statusText,
          headers
        }));
        await limitTileCache(cache);
      }
    }

    return !response.ok && cached ? cached : response;
  } catch {
    if (cached) return cached;
    return new Response('', {
      status: 503,
      statusText: 'Offline: Kartenausschnitt nicht gespeichert'
    });
  }
}

async function limitTileCache(cache) {
  const requests = await cache.keys();
  if (requests.length <= TILE_CACHE_LIMIT) return;

  const entries = await Promise.all(requests.map(async request => {
    const response = await cache.match(request);
    return {
      request,
      cachedAt: Number(response?.headers.get('X-ZeugDB-Cached-At')) || 0
    };
  }));
  entries.sort((a, b) => a.cachedAt - b.cachedAt);

  await Promise.all(entries
    .slice(0, entries.length - TILE_CACHE_LIMIT)
    .map(({ request }) => cache.delete(request)));
}
