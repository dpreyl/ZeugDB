import type { Coord, Location } from '$lib/parser/types';
import { getLocationGeometry } from './location-geometry';

export type LocationShape = {
  kind: 'polygon' | 'route' | 'point';
  points: Coord[];
};

export function getLocationShape(location: Location): LocationShape | null {
  const kind = location.art
    ?? (location.polygon?.length ? 'raum' : location.route?.length ? 'leitung' : 'punkt');
  const points = getLocationGeometry({ ...location, art: kind });
  if (points.length === 0) return null;

  return {
    kind: kind === 'raum' ? 'polygon' : kind === 'leitung' ? 'route' : 'point',
    points
  };
}

export function getLocationCenter(location: Location): Coord | null {
  const points = getLocationShape(location)?.points ?? [];
  if (points.length === 0) return null;
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length
  };
}
