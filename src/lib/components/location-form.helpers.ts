import type { Coord, Location, LocationArt } from '../parser/types';

export type CoordinateInput = { lat: string; lon: string };
type GeolocationPort = Pick<Geolocation, 'getCurrentPosition'>;

const MINIMUM_COORDINATES: Record<LocationArt, number> = {
  punkt: 1,
  raum: 3,
  leitung: 2
};

export function coordinatesForLocation(
  location?: Location,
  art: LocationArt = location?.art ?? (location?.polygon ? 'raum' : location?.route ? 'leitung' : 'punkt')
): CoordinateInput[] {
  const coordinates = art === 'punkt'
    ? location?.lat !== undefined && location.lon !== undefined
      ? [{ lat: location.lat, lon: location.lon }]
      : []
    : art === 'raum'
      ? location?.polygon ?? []
      : location?.route ?? [];

  if (coordinates.length > 0) {
    return coordinates.map(({ lat, lon }) => ({ lat: String(lat), lon: String(lon) }));
  }

  return Array.from({ length: MINIMUM_COORDINATES[art] }, () => ({ lat: '', lon: '' }));
}

export function validateCoordinates(
  art: LocationArt,
  coordinates: readonly CoordinateInput[]
): string | null {
  const minimum = MINIMUM_COORDINATES[art];
  if (coordinates.length < minimum) {
    const name = art === 'raum' ? 'Ein Raum' : art === 'leitung' ? 'Eine Leitung' : 'Ein Punkt';
    return `${name} benötigt mindestens ${minimum} ${minimum === 1 ? 'Koordinate' : 'Koordinaten'}.`;
  }

  for (const coordinate of coordinates) {
    if (!coordinate.lat.trim() || !coordinate.lon.trim()) {
      return 'Gib gültige Koordinaten ein.';
    }

    const lat = Number(coordinate.lat);
    const lon = Number(coordinate.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return 'Gib gültige Koordinaten ein.';
    }
    if (lat < -90 || lat > 90) {
      return 'Der Breitengrad muss zwischen -90 und 90 liegen.';
    }
    if (lon < -180 || lon > 180) {
      return 'Der Längengrad muss zwischen -180 und 180 liegen.';
    }
  }

  return null;
}

export function locationCoordinateFields(
  art: LocationArt,
  coordinates: readonly CoordinateInput[]
): Pick<Location, 'lat' | 'lon' | 'polygon' | 'route'> {
  const parsed: Coord[] = coordinates.map(({ lat, lon }) => ({
    lat: Number(lat),
    lon: Number(lon)
  }));

  return {
    lat: art === 'punkt' ? parsed[0]?.lat : undefined,
    lon: art === 'punkt' ? parsed[0]?.lon : undefined,
    polygon: art === 'raum' ? parsed : undefined,
    route: art === 'leitung' ? parsed : undefined
  };
}

export function withCurrentPosition(
  art: LocationArt,
  coordinates: readonly CoordinateInput[],
  currentPosition: Coord
): CoordinateInput[] {
  const current = { lat: String(currentPosition.lat), lon: String(currentPosition.lon) };
  if (art === 'punkt') return [current];

  const emptyIndex = coordinates.findIndex(({ lat, lon }) => !lat.trim() || !lon.trim());
  if (emptyIndex < 0) return [...coordinates, current];

  return coordinates.map((coordinate, index) => index === emptyIndex ? current : coordinate);
}

export function getCurrentPosition(
  geolocation: GeolocationPort | undefined =
    typeof navigator === 'undefined' ? undefined : navigator.geolocation
): Promise<Coord> {
  if (!geolocation) {
    return Promise.reject(
      new Error('Die Standortbestimmung wird von diesem Browser nicht unterstützt.')
    );
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude
      }),
      error => {
        const message = error.code === 1
          ? 'Der Zugriff auf den Standort wurde verweigert.'
          : error.code === 2
            ? 'Der aktuelle Standort ist nicht verfügbar.'
            : error.code === 3
              ? 'Die Standortbestimmung hat zu lange gedauert.'
              : 'Der Standort konnte nicht ermittelt werden.';
        reject(new Error(message));
      },
      { enableHighAccuracy: true }
    );
  });
}
