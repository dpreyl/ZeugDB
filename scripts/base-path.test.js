import { describe, expect, it } from 'vitest';
import { normalizeBasePath } from './base-path.js';

describe('normalizeBasePath', () => {
  it('accepts the root deployment and a GitHub Pages project path', () => {
    expect(normalizeBasePath(undefined)).toBe('');
    expect(normalizeBasePath('/zeugdb')).toBe('/zeugdb');
  });

  it('rejects invalid paths instead of generating broken asset URLs', () => {
    expect(() => normalizeBasePath('zeugdb')).toThrow(/begin with "\/"/);
    expect(() => normalizeBasePath('/zeugdb/')).toThrow(/must not end with "\/"/);
    expect(() => normalizeBasePath('/../other')).toThrow(/valid path segment/);
  });
});
