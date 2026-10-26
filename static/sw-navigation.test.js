import { describe, expect, it, vi } from 'vitest';
import { serveNavigation } from './sw-navigation.js';

describe('service worker navigation strategy', () => {
  it('uses and caches the current network response instead of stale HTML', async () => {
    const request = new Request('https://example.test/');
    const cache = { match: vi.fn(), put: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockResolvedValue(new Response('fresh page'));

    const response = await serveNavigation(request, cache, '/', fetcher);

    expect(await response.text()).toBe('fresh page');
    expect(fetcher).toHaveBeenCalledWith(request);
    expect(cache.put).toHaveBeenCalledWith(request, expect.any(Response));
  });

  it('falls back to the cached page when the network is unavailable', async () => {
    const request = new Request('https://example.test/locations');
    const cachedPage = new Response('offline page');
    const cache = {
      match: vi.fn(async key => key === '/' ? cachedPage : undefined),
      put: vi.fn()
    };

    const response = await serveNavigation(request, cache, '/', vi.fn().mockRejectedValue(new Error('offline')));

    expect(await response.text()).toBe('offline page');
    expect(cache.match).toHaveBeenCalledWith(request);
    expect(cache.match).toHaveBeenCalledWith('/');
  });
});
