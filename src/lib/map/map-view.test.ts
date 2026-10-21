import { describe, expect, it } from 'vitest';
import { getLastMapView, saveLastMapView, type MapViewStorage } from './map-view';

function createStorage(initial: Record<string, string> = {}): MapViewStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

describe('map view persistence', () => {
  it('saves and restores the last center and zoom', () => {
    const storage = createStorage();
    const view = { center: { lat: 52.52, lon: 13.405 }, zoom: 14 };

    saveLastMapView(view, storage);

    expect(getLastMapView(storage)).toEqual(view);
  });

  it('returns null for malformed or out-of-range saved views', () => {
    const malformed = createStorage({ 'zeugdb.map-view.v1': '{bad json' });
    const outOfRange = createStorage({
      'zeugdb.map-view.v1': JSON.stringify({
        center: { lat: 91, lon: 13.4 },
        zoom: 14
      })
    });

    expect(getLastMapView(malformed)).toBeNull();
    expect(getLastMapView(outOfRange)).toBeNull();
  });

  it('keeps storage failures from breaking map use', () => {
    const unavailable: MapViewStorage = {
      getItem: () => { throw new Error('storage unavailable'); },
      setItem: () => { throw new Error('storage unavailable'); }
    };

    expect(getLastMapView(unavailable)).toBeNull();
    expect(() => saveLastMapView(
      { center: { lat: 52.52, lon: 13.405 }, zoom: 14 },
      unavailable
    )).not.toThrow();
  });
});
