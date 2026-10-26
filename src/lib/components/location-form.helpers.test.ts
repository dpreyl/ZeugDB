import { describe, expect, it, vi } from 'vitest';
import type { Location } from '../parser/types';
import {
  coordinatesForLocation,
  createLocationId,
  getCurrentPosition,
  getSelectableParents,
  locationCoordinateFields,
  validateCoordinates,
  withCurrentPosition
} from './location-form.helpers';

describe('location form coordinate helpers', () => {
  it('creates a readable, normalized ID and appends a suffix for duplicate names', () => {
    expect(createLocationId('München Büro', [])).toBe('muenchen-buero');
    expect(createLocationId('München Büro', [{ id: 'muenchen-buero' }])).toBe('muenchen-buero-2');
    expect(createLocationId('ÄÖÜ ß', [])).toBe('aeoeue-ss');
    expect(createLocationId('   ', [])).toBe('standort');
  });

  it('offers existing locations as parent choices but excludes self and descendants', () => {
    const locations: Location[] = [
      { id: 'campus', name: 'Campus' },
      { id: 'building', name: 'Gebäude', eltern: 'campus' },
      { id: 'room', name: 'Raum', eltern: 'building' },
      { id: 'other', name: 'Anderes Gebäude' }
    ];

    expect(getSelectableParents(locations, locations[1])).toEqual([
      { id: 'campus', name: 'Campus', depth: 0 },
      { id: 'other', name: 'Anderes Gebäude', depth: 0 }
    ]);
  });

  it('initializes one blank point for a new point location', () => {
    expect(coordinatesForLocation()).toEqual([{ lat: '', lon: '' }]);
  });

  it('preserves zero coordinates and uses the geometry matching the location type', () => {
    const location: Location = {
      art: 'punkt',
      lat: 0,
      lon: 0,
      route: [{ lat: 10, lon: 20 }]
    };

    expect(coordinatesForLocation(location)).toEqual([{ lat: '0', lon: '0' }]);
  });

  it.each([
    ['punkt', [{ lat: '0', lon: '0' }]],
    ['leitung', [{ lat: '1', lon: '2' }, { lat: '3', lon: '4' }]],
    ['raum', [
      { lat: '1', lon: '2' },
      { lat: '3', lon: '4' },
      { lat: '5', lon: '6' }
    ]]
  ] as const)('accepts valid %s coordinates, including zero', (art, coordinates) => {
    expect(validateCoordinates(art, coordinates)).toBeNull();
  });

  it.each(['punkt', 'raum', 'leitung'] as const)(
    'allows a %s location to be saved without coordinates',
    (art) => {
      expect(validateCoordinates(art, [])).toBeNull();
      expect(validateCoordinates(art, coordinatesForLocation(undefined, art))).toBeNull();
      expect(locationCoordinateFields(art, coordinatesForLocation(undefined, art))).toEqual({
        lat: undefined,
        lon: undefined,
        polygon: undefined,
        route: undefined
      });
    }
  );

  it.each([
    ['punkt', [{ lat: '52', lon: '' }], 'Gib gültige Koordinaten ein.'],
    ['leitung', [{ lat: '1', lon: '2' }], 'Eine Leitung benötigt mindestens 2 Koordinaten.'],
    ['raum', [{ lat: '1', lon: '2' }, { lat: '3', lon: '4' }], 'Ein Raum benötigt mindestens 3 Koordinaten.'],
    ['raum', [{ lat: '', lon: '' }, { lat: '3', lon: '4' }, { lat: '', lon: '' }], 'Gib gültige Koordinaten ein.'],
    ['punkt', [{ lat: '91', lon: '0' }], 'Der Breitengrad muss zwischen -90 und 90 liegen.'],
    ['punkt', [{ lat: '0', lon: '181' }], 'Der Längengrad muss zwischen -180 und 180 liegen.']
  ] as const)('rejects invalid %s coordinates', (art, coordinates, message) => {
    expect(validateCoordinates(art, coordinates)).toBe(message);
  });

  it('maps only the active geometry fields on save', () => {
    expect(locationCoordinateFields('punkt', [{ lat: '0', lon: '1.5' }])).toEqual({
      lat: 0,
      lon: 1.5,
      polygon: undefined,
      route: undefined
    });
    expect(locationCoordinateFields('raum', [
      { lat: '1', lon: '2' },
      { lat: '3', lon: '4' },
      { lat: '5', lon: '6' }
    ])).toEqual({
      lat: undefined,
      lon: undefined,
      polygon: [
        { lat: 1, lon: 2 },
        { lat: 3, lon: 4 },
        { lat: 5, lon: 6 }
      ],
      route: undefined
    });
    expect(locationCoordinateFields('punkt', [])).toEqual({
      lat: undefined,
      lon: undefined,
      polygon: undefined,
      route: undefined
    });
  });

  it('uses GPS to replace a point or fill the next empty shape coordinate', () => {
    const position = { lat: 52.5, lon: 13.4 };
    expect(withCurrentPosition('punkt', [{ lat: '1', lon: '2' }], position)).toEqual([
      { lat: '52.5', lon: '13.4' }
    ]);
    expect(withCurrentPosition('leitung', [
      { lat: '1', lon: '2' },
      { lat: '', lon: '' }
    ], position)).toEqual([
      { lat: '1', lon: '2' },
      { lat: '52.5', lon: '13.4' }
    ]);
    expect(withCurrentPosition('leitung', [
      { lat: '1', lon: '2' },
      { lat: '3', lon: '4' }
    ], position)).toHaveLength(3);
  });

  it('returns the current GPS location and requests high accuracy', async () => {
    const getCurrentPositionMock = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 52.5, longitude: 13.4 } as GeolocationCoordinates
      } as GeolocationPosition);
    });

    await expect(getCurrentPosition({ getCurrentPosition: getCurrentPositionMock }))
      .resolves.toEqual({ lat: 52.5, lon: 13.4 });
    expect(getCurrentPositionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true }
    );
  });

  it('rejects when geolocation is unavailable or denied', async () => {
    await expect(getCurrentPosition(undefined)).rejects.toThrow(
      'Die Standortbestimmung wird von diesem Browser nicht unterstützt.'
    );

    const denied: GeolocationPort = {
      getCurrentPosition: (_success, error) => {
        error?.({ code: 1 } as GeolocationPositionError);
      }
    };
    await expect(getCurrentPosition(denied)).rejects.toThrow(
      'Der Zugriff auf den Standort wurde verweigert.'
    );
  });
});

type GeolocationPort = Pick<Geolocation, 'getCurrentPosition'>;
