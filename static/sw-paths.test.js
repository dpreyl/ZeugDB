import { describe, expect, it } from 'vitest';
import { appPath, getAppBase } from './sw-paths.js';

describe('service worker paths', () => {
  it('uses the origin root when deployed at the domain root', () => {
    const base = getAppBase('https://example.test/');

    expect(base).toBe('');
    expect(appPath(base, '/')).toBe('/');
    expect(appPath(base, '/sw.js')).toBe('/sw.js');
  });

  it('keeps resources inside a GitHub Pages project scope', () => {
    const base = getAppBase('https://example.test/zeugdb/');

    expect(base).toBe('/zeugdb');
    expect(appPath(base, '/')).toBe('/zeugdb/');
    expect(appPath(base, '/manifest.json')).toBe('/zeugdb/manifest.json');
  });
});
