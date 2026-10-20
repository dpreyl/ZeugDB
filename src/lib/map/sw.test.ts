import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error Worker helpers are static browser modules without TypeScript declarations.
import { getTileCacheLifetime, isFreshTile, isOpenStreetMapTileRequest, TILE_CACHE_LIMIT, TILE_CACHE_NAME } from '../../../static/tile-cache.js';
// @ts-expect-error Worker helpers are static browser modules without TypeScript declarations.
import { appPath, getAppBase } from '../../../static/sw-paths.js';

const tileUrl = 'https://tile.openstreetmap.org/12/2048/1365.png';

function createWorker(response: unknown) {
  const listeners = new Map<string, (event: any) => void>();
  const stored = new Map<string, unknown>();
  const tileCache = {
    match: vi.fn(async (request: Request) => stored.get(request.url)),
    put: vi.fn(async (request: Request, value: unknown) => {
      stored.set(request.url, value);
    }),
    keys: vi.fn(async () => [...stored.keys()].map(url => ({ url }))),
    delete: vi.fn(async (request: Request) => stored.delete(request.url)),
  };
  const appCache = {
    match: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
    keys: vi.fn(async () => []),
  };
  const caches = {
    open: vi.fn(async (name: string) =>
      name === TILE_CACHE_NAME ? tileCache : appCache),
    match: vi.fn(async () => undefined),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  };
  const fetch = vi.fn(async () => response);
  const self = {
    addEventListener: (name: string, listener: (event: any) => void) =>
      listeners.set(name, listener),
    registration: { scope: 'https://example.test/' },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  const source = readFileSync(resolve(process.cwd(), 'static/sw.js'), 'utf8')
    .replace(/^import \{[\s\S]*?\} from '\.\/tile-cache\.js';/m, '')
    .replace(/^import \{[\s\S]*?\} from '\.\/sw-paths\.js';/m, '');

  runInNewContext(source, {
    self,
    appPath,
    getAppBase,
    caches,
    fetch,
    URL,
    Response,
    Headers,
    Date,
    getTileCacheLifetime,
    isFreshTile,
    isOpenStreetMapTileRequest,
    TILE_CACHE_LIMIT,
    TILE_CACHE_NAME,
    console
  });

  return {
    caches,
    appCache,
    fetch,
    tileCache,
    dispatchFetch(request: Request) {
      let responsePromise: Promise<unknown> | undefined;
      const pending: Promise<unknown>[] = [];
      listeners.get('fetch')?.({
        request,
        respondWith: (response: Promise<unknown>) => {
          responsePromise = Promise.resolve(response);
        },
        waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      });
      return { responsePromise, pending };
    },
  };
}

function tileRequest(url = tileUrl): Request {
  return {
    url,
    method: 'GET',
    mode: 'no-cors',
    headers: { get: () => null },
  } as unknown as Request;
}

describe('Service Worker tile cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caches successful tile responses and serves them without a network request', async () => {
    const response = new Response('tile', {
      headers: { 'Cache-Control': 'max-age=3600' }
    });
    const worker = createWorker(response);
    const request = tileRequest();

    const first = await worker.dispatchFetch(request).responsePromise;
    const second = await worker.dispatchFetch(request).responsePromise;

    expect(await (first as Response).text()).toBe('tile');
    expect(await (second as Response).text()).toBe('tile');
    expect(worker.fetch).toHaveBeenCalledOnce();
    expect(worker.tileCache.put).toHaveBeenCalledOnce();
  });

  it('does not store unsuccessful tile responses', async () => {
    const response = new Response('', { status: 404 });
    const worker = createWorker(response);

    expect(
      (await worker.dispatchFetch(tileRequest()).responsePromise as Response).status
    ).toBe(404);
    expect(worker.tileCache.put).not.toHaveBeenCalled();
  });

  it('does not cache opaque tile responses without readable cache headers', async () => {
    const response = { ok: false, type: 'opaque' };
    const worker = createWorker(response);

    expect(await worker.dispatchFetch(tileRequest()).responsePromise).toBe(response);
    expect(worker.tileCache.put).not.toHaveBeenCalled();
  });

  it('returns an offline fallback when the tile has not been cached', async () => {
    const worker = createWorker(Promise.reject(new Error('offline')));

    const response = await worker.dispatchFetch(tileRequest()).responsePromise as Response;

    expect(response.status).toBe(503);
    expect(response.statusText).toContain('Offline');
  });

  it('does not intercept non-tile or non-GET requests as map tiles', async () => {
    const response = new Response('app');
    const worker = createWorker(response);

    await worker.dispatchFetch(tileRequest('https://example.com/12/2048/1365.png')).responsePromise;
    await worker.dispatchFetch({
      ...tileRequest(),
      method: 'POST',
    } as Request).responsePromise;

    expect(worker.tileCache.put).not.toHaveBeenCalled();
  });
});
