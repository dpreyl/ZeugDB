export const MAP_VIEW_STORAGE_KEY = 'zeugdb.map-view.v1';

export type MapView = {
  center: { lat: number; lon: number };
  zoom: number;
};

export type MapViewStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): MapViewStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isMapView(value: unknown): value is MapView {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<MapView>;
  const center = candidate.center;
  return typeof center === 'object'
    && center !== null
    && typeof center.lat === 'number'
    && Number.isFinite(center.lat)
    && center.lat >= -90
    && center.lat <= 90
    && typeof center.lon === 'number'
    && Number.isFinite(center.lon)
    && center.lon >= -180
    && center.lon <= 180
    && typeof candidate.zoom === 'number'
    && Number.isFinite(candidate.zoom)
    && candidate.zoom >= 0
    && candidate.zoom <= 19;
}

export function getLastMapView(storage: MapViewStorage | null = browserStorage()): MapView | null {
  if (!storage) return null;
  try {
    const saved = storage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    return isMapView(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastMapView(
  view: MapView,
  storage: MapViewStorage | null = browserStorage()
): void {
  if (!storage || !isMapView(view)) return;
  try {
    storage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Kartenansicht bleibt auch dann nutzbar, wenn Browser-Speicher blockiert ist.
  }
}
