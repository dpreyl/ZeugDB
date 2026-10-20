import type { Coord, Location } from '../parser/types';

function isValidCoordinate(coordinate: Coord): boolean {
  return Number.isFinite(coordinate.lat)
    && Number.isFinite(coordinate.lon)
    && coordinate.lat >= -90
    && coordinate.lat <= 90
    && coordinate.lon >= -180
    && coordinate.lon <= 180;
}

export function getLocationGeometry(location: Location): Coord[] {
  if (location.art === 'punkt' || (!location.art && location.lat !== undefined && location.lon !== undefined)) {
    if (location.lat === undefined || location.lon === undefined) return [];
    const point = { lat: location.lat, lon: location.lon };
    return isValidCoordinate(point) ? [point] : [];
  }

  if (location.art === 'raum') {
    const polygon = location.polygon ?? [];
    return polygon.length >= 3 && polygon.every(isValidCoordinate) ? polygon : [];
  }

  if (location.art === 'leitung') {
    const route = location.route ?? [];
    return route.length >= 2 && route.every(isValidCoordinate) ? route : [];
  }

  return [];
}

export function toLeafletPositions(coordinates: Coord[]): [number, number][] {
  return coordinates.map(({ lat, lon }) => [lat, lon]);
}
