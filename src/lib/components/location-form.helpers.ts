import type { Coord, Location, LocationArt } from '../parser/types';
import { flattenLocationTree } from '../locations/location-tree';

export type CoordinateInput = { lat: string; lon: string };
export type LocationParentOption = { id: string; name: string; depth: number };
type GeolocationPort = Pick<Geolocation, 'getCurrentPosition'>;

const MINIMUM_COORDINATES: Record<LocationArt, number> = {
  punkt: 1,
  raum: 3,
  leitung: 2
};

export function createLocationId(name: string, locations: readonly Location[]): string {
  const base = name.trim().toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'standort';
  const usedIds = new Set(locations.flatMap(location => location.id ? [location.id] : []));
  if (!usedIds.has(base)) return base;

  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function getSelectableParents(
  locations: Location[],
  currentLocation?: Location
): LocationParentOption[] {
  const excludedIds = new Set<string>();
  if (currentLocation?.id) excludedIds.add(currentLocation.id);

  let changed = true;
  while (changed) {
    changed = false;
    for (const location of locations) {
      if (location.id && location.eltern && excludedIds.has(location.eltern) &&
          !excludedIds.has(location.id)) {
        excludedIds.add(location.id);
        changed = true;
      }
    }
  }

  return flattenLocationTree(locations)
    .filter(({ location }) => Boolean(location.id) && !excludedIds.has(location.id!))
    .map(({ location, depth }) => ({
      id: location.id!,
      name: location.name || location.id!,
      depth
    }));
}

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
  const hasAnyCoordinate = coordinates.some(({ lat, lon }) => lat.trim() || lon.trim());
  if (!hasAnyCoordinate) return null;

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
  const hasAnyCoordinate = coordinates.some(({ lat, lon }) => lat.trim() || lon.trim());
  if (!hasAnyCoordinate) {
    return { lat: undefined, lon: undefined, polygon: undefined, route: undefined };
  }

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
