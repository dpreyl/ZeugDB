import { describe, expect, it } from 'vitest';
import { getLocationCenter, getLocationShape } from './location-shapes';

describe('location map shapes', () => {
  it('returns a polygon when at least three room corners are present', () => {
    const shape = getLocationShape({
      art: 'raum',
      polygon: [{ lat: 48, lon: 11 }, { lat: 49, lon: 11 }, { lat: 49, lon: 12 }]
    });
    expect(shape?.kind).toBe('polygon');
    expect(shape?.points).toHaveLength(3);
  });

  it('returns a route for two or more cable points', () => {
    expect(getLocationShape({
      art: 'leitung',
      route: [{ lat: 48, lon: 11 }, { lat: 49, lon: 12 }]
    })?.kind).toBe('route');
  });

  it('falls back to a point and omits locations without drawable coordinates', () => {
    expect(getLocationShape({ id: 'gps', lat: 48, lon: 11 })?.kind).toBe('point');
    expect(getLocationShape({ id: 'empty' })).toBeNull();
  });

  it('uses the declared geometry and rejects invalid coordinates', () => {
    expect(getLocationShape({
      art: 'punkt',
      lat: 48,
      lon: 11,
      polygon: [{ lat: 48, lon: 11 }, { lat: 49, lon: 11 }, { lat: 49, lon: 12 }]
    })?.kind).toBe('point');
    expect(getLocationShape({
      art: 'raum',
      polygon: [{ lat: 91, lon: 11 }, { lat: 49, lon: 11 }, { lat: 49, lon: 12 }]
    })).toBeNull();
    expect(getLocationShape({
      art: 'leitung',
      route: [{ lat: 48, lon: 11 }]
    })).toBeNull();
  });

  it('calculates a center for a location and returns null when geometry is absent', () => {
    expect(getLocationCenter({
      route: [{ lat: 48, lon: 10 }, { lat: 50, lon: 14 }]
    })).toEqual({ lat: 49, lon: 12 });
    expect(getLocationCenter({ id: 'empty' })).toBeNull();
  });
});
