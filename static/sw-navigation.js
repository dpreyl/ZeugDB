export async function serveNavigation(request, cache, appRoot, fetcher = fetch) {
  try {
    const response = await fetcher(request);
    if (response.ok) {
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cachedPage = await cache.match(request) ?? await cache.match(appRoot);
    return cachedPage ?? new Response('Offline: Seite nicht gespeichert', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}
