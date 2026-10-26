import { build, files, version } from '$service-worker';
import {
  getTileCacheLifetime,
  isFreshTile,
  isOpenStreetMapTileRequest,
  TILE_CACHE_LIMIT,
  TILE_CACHE_NAME
} from '../static/tile-cache.js';
import { appPath, getAppBase } from '../static/sw-paths.js';
import { getBuildAssetUrls, getPrecacheUrls } from '../static/sw-precache.js';
import { isSameOriginRequest } from '../static/sw-request.js';
import { serveNavigation } from '../static/sw-navigation.js';

/* ZeugDB service worker: precache all SvelteKit route bundles for offline navigation. */
const CACHE = `zeugdb-${version}`;
const APP_BASE = getAppBase(self.registration.scope);
const APP_ROOT = appPath(APP_BASE, '/');
const WORKER_PATH = appPath(APP_BASE, '/service-worker.js');
const PRECACHE_URLS = getPrecacheUrls(build, files, APP_BASE, APP_ROOT, WORKER_PATH);
const APP_BUILD_PATHS = new Set(
  getBuildAssetUrls(build, APP_BASE)
    .map(path => new URL(path, self.registration.scope).pathname)
);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(all =>
      Promise.all(
        all.filter(name => name !== CACHE && name !== TILE_CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (isOpenStreetMapTileRequest(request)) {
    event.respondWith(serveMapTile(request));
    return;
  }

  // Never apply this app's offline-shell fallback to cross-origin Git/LFS/API
  // requests. A failed localhost request from a hosted Pages app must remain a
  // network error, not become the cached GitHub Pages HTML document.
  if (!isSameOriginRequest(request.url, self.location.origin)) return;

  if (request.mode === 'navigate' ||
      (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      caches.open(CACHE).then(cache => serveNavigation(request, cache, APP_ROOT))
    );
    return;
  }

  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
      APP_BUILD_PATHS.has(url.pathname) ||
      url.pathname.startsWith(appPath(APP_BASE, '/_app/')) ||
      url.pathname.startsWith(appPath(APP_BASE, '/assets/'))) {
    event.respondWith(serveAppAsset(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then(net => {
        if (net.ok) {
          const clone = net.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return net;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached ?? caches.match(APP_ROOT);
      })
  );
});

async function serveAppAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, clone));
    }
    return response;
  } catch {
    return caches.match(APP_ROOT);
  }
}

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
