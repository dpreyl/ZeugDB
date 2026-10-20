export const TILE_CACHE_NAME = 'zeugdb-map-tiles-v1';
export const TILE_CACHE_LIMIT = 1200;

const TILE_HOST = 'tile.openstreetmap.org';
const DEFAULT_TILE_LIFETIME = 7 * 24 * 60 * 60 * 1000;

function getAgeMilliseconds(response) {
  const seconds = Number(response.headers.get('Age') ?? 0);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 0;
}

export function isOpenStreetMapTileRequest(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  return url.protocol === 'https:' &&
    url.hostname === TILE_HOST &&
    /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname);
}

export function getTileCacheLifetime(response, now = Date.now()) {
  const cacheControl = response.headers.get('Cache-Control') ?? '';
  const directives = cacheControl.split(',').map(value => value.trim().toLowerCase());

  if (directives.includes('no-store')) return null;
  if (directives.includes('no-cache')) return 0;

  const maxAge = directives
    .map(directive => directive.match(/^max-age="?(\d+)"?$/)?.[1])
    .find(value => value !== undefined);
  if (maxAge !== undefined) {
    return Math.max(0, Number(maxAge) * 1000 - getAgeMilliseconds(response));
  }

  const expires = Date.parse(response.headers.get('Expires') ?? '');
  if (Number.isFinite(expires)) {
    const serverDate = Date.parse(response.headers.get('Date') ?? '');
    return Math.max(
      0,
      expires - (Number.isFinite(serverDate) ? serverDate : now) -
        getAgeMilliseconds(response)
    );
  }

  return DEFAULT_TILE_LIFETIME;
}

export function isFreshTile(response, now = Date.now()) {
  const expiresAtHeader = response.headers.get('X-ZeugDB-Cache-Expires-At');
  if (expiresAtHeader === null) return false;

  const expiresAt = Number(expiresAtHeader);
  return Number.isFinite(expiresAt) && now < expiresAt;
}
