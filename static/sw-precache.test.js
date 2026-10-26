import { describe, expect, it } from 'vitest';
import { getPrecacheUrls } from './sw-precache.js';

describe('service worker app precache', () => {
  it('includes every SvelteKit build file and static asset within the app base', () => {
    const urls = getPrecacheUrls(
      [
        '/_app/immutable/entry/start.js',
        '/_app/immutable/nodes/locations.js',
        '/_app/immutable/nodes/settings.js'
      ],
      [
        'manifest.json',
        'icon-192.png'
      ],
      '/zeugdb',
      '/zeugdb/',
      '/zeugdb/service-worker.js'
    );

    expect(urls).toEqual([
      '/zeugdb/',
      '/zeugdb/_app/immutable/entry/start.js',
      '/zeugdb/_app/immutable/nodes/locations.js',
      '/zeugdb/_app/immutable/nodes/settings.js',
      '/zeugdb/manifest.json',
      '/zeugdb/icon-192.png',
      '/zeugdb/service-worker.js'
    ]);
  });

  it('deduplicates build files and handles deployment at the origin root', () => {
    expect(getPrecacheUrls(
      ['/_app/immutable/nodes/locations.js'],
      ['/_app/immutable/nodes/locations.js'],
      '',
      '/',
      '/service-worker.js'
    )).toEqual([
      '/',
      '/_app/immutable/nodes/locations.js',
      '/service-worker.js'
    ]);
  });
});
