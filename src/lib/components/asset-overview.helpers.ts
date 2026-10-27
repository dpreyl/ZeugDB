import type { Location } from '../parser/types';
import { flattenLocationTree } from '../locations/location-tree';

export type AssetOverviewField = 'bezeichnung' | 'typ' | 'standort' | 'geaendert';

export type AssetOverviewRow = {
  id: string;
  bezeichnung: string;
  typ: string;
  standort: string;
  standortName?: string;
  geaendert: string;
};

export type LocationFilterOption = {
  id: string;
  label: string;
  depth: number;
  values: string[];
};

export type AssetOverviewFilters = Partial<Record<AssetOverviewField, string[] | null>>;

export function getAssetFilterOptions(
  rows: AssetOverviewRow[],
  field: AssetOverviewField
): string[] {
  return [...new Set(rows.map(row => row[field]))].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  );
}

export function getLocationFilterOptions(
  locations: Location[],
  rows: AssetOverviewRow[]
): LocationFilterOption[] {
  const locationById = new Map<string, Location>();
  for (const location of locations) {
    if (location.id && !locationById.has(location.id)) locationById.set(location.id, location);
  }

  const usedIds = [...new Set(rows.map(row => row.standort))];
  const valuesByAncestor = new Map<string, string[]>();
  const relevantIds = new Set<string>();

  for (const usedId of usedIds) {
    let currentId: string | undefined = usedId;
    const visited = new Set<string>();
    while (currentId && locationById.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      relevantIds.add(currentId);
      const values = valuesByAncestor.get(currentId) ?? [];
      values.push(usedId);
      valuesByAncestor.set(currentId, values);
      currentId = locationById.get(currentId)?.eltern;
    }
  }

  const knownOptions = flattenLocationTree(locations).flatMap(({ location, depth }) => {
    const id = location.id;
    if (!id || !relevantIds.has(id)) return [];
    return [{
      id,
      label: location.name?.trim() || id,
      depth,
      values: valuesByAncestor.get(id) ?? []
    }];
  });
  const knownIds = new Set(locationById.keys());
  const unknownOptions = usedIds
    .filter(id => id === '—' || !knownIds.has(id))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
    .map(id => ({ id, label: id, depth: 0, values: [id] }));

  return [...knownOptions, ...unknownOptions];
}

export function getLocationDisplayName(locationId: string, locations: Location[]): string {
  if (!locationId || locationId === '—') return '—';

  const locationById = new Map(
    locations.flatMap(location => location.id ? [[location.id, location] as const] : [])
  );
  const chain: string[] = [];
  const visited = new Set<string>();
  let current = locationById.get(locationId);

  if (!current) return locationId;

  while (current?.id && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current.name?.trim() || current.id);
    current = current.eltern ? locationById.get(current.eltern) : undefined;
  }

  return chain.reverse().join(' › ');
}

export function filterAssetRows(
  rows: AssetOverviewRow[],
  filters: AssetOverviewFilters
): AssetOverviewRow[] {
  return rows.filter(row =>
    (Object.entries(filters) as [AssetOverviewField, string[] | null][]).every(([field, selected]) =>
      selected === undefined || selected === null || selected.includes(row[field])
    )
  );
}
