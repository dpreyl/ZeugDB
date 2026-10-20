import { describe, expect, it } from 'vitest';
import type { Location } from '../parser/types';
import { getLocationGeometry, toLeafletPositions } from './location-geometry';

describe('location geometry for the map', () => {
  it.each([
    [{ art: 'punkt', lat: 0, lon: 13 } as Location, [{ lat: 0, lon: 13 }]],
    [{ art: 'raum', polygon: [
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 },
      { lat: 5, lon: 6 }
    ] } as Location, [
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 },
      { lat: 5, lon: 6 }
    ]],
    [{ art: 'leitung', route: [
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 }
    ] } as Location, [
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 }
    ]]
  ])('returns the coordinates for each geometry kind', (location, expected) => {
    expect(getLocationGeometry(location)).toEqual(expected);
  });

  it('omits missing, out-of-range, and too-short geometries', () => {
    expect(getLocationGeometry({ art: 'punkt', lat: 0 })).toEqual([]);
    expect(getLocationGeometry({ art: 'raum', polygon: [
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 }
    ] })).toEqual([]);
    expect(getLocationGeometry({ art: 'leitung', route: [
      { lat: 91, lon: 2 },
      { lat: 3, lon: 4 }
    ] })).toEqual([]);
    expect(getLocationGeometry({ art: 'punkt', lat: 1, lon: 181 })).toEqual([]);
  });

  it('converts longitude-based coordinates to Leaflet latitude-longitude pairs', () => {
    expect(toLeafletPositions([
      { lat: 52.5, lon: 13.4 },
      { lat: 53.5, lon: 14.4 }
    ])).toEqual([
      [52.5, 13.4],
      [53.5, 14.4]
    ]);
  });
});
