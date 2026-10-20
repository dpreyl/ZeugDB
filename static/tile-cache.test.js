import { describe, expect, it } from 'vitest';
import {
  getTileCacheLifetime,
  isFreshTile,
  isOpenStreetMapTileRequest
} from './tile-cache.js';

describe('OpenStreetMap tile cache policy', () => {
  it('only accepts GET requests for standard PNG tiles from the official tile host', () => {
    expect(isOpenStreetMapTileRequest(new Request(
      'https://tile.openstreetmap.org/12/2048/1365.png'
    ))).toBe(true);
    expect(isOpenStreetMapTileRequest(new Request(
      'https://a.tile.openstreetmap.org/12/2048/1365.png'
    ))).toBe(false);
    expect(isOpenStreetMapTileRequest(new Request(
      'https://tile.openstreetmap.org/12/2048/1365.png', { method: 'POST' }
    ))).toBe(false);
    expect(isOpenStreetMapTileRequest(new Request(
      'https://tile.openstreetmap.org/12/2048/1365.jpg'
    ))).toBe(false);
  });

  it('honors cache directives and uses the seven-day fallback only when absent', () => {
    expect(getTileCacheLifetime(new Response('', {
      headers: { 'Cache-Control': 'public, max-age=86400' }
    }))).toBe(86_400_000);
    expect(getTileCacheLifetime(new Response('', {
      headers: { 'Cache-Control': 'max-age=60', Age: '15' }
    }))).toBe(45_000);
    expect(getTileCacheLifetime(new Response('', {
      headers: { 'Cache-Control': 'no-cache' }
    }))).toBe(0);
    expect(getTileCacheLifetime(new Response('', {
      headers: { 'Cache-Control': 'no-store' }
    }))).toBeNull();
    expect(getTileCacheLifetime(new Response(''))).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('returns cached tiles only while their server-defined lifetime is fresh', () => {
    const response = new Response('', {
      headers: {
        'Cache-Control': 'max-age=60',
        'X-ZeugDB-Cache-Expires-At': '61000'
      }
    });
    expect(isFreshTile(response, 60_999)).toBe(true);
    expect(isFreshTile(response, 61_000)).toBe(false);
    expect(isFreshTile(new Response(''), 1000)).toBe(false);
  });
});
