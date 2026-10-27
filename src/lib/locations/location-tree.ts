import type { Location } from '../parser/types';

export type LocationTreeRow = {
  location: Location;
  depth: number;
  hasMissingParent: boolean;
};

export type LocationSelectOption = {
  id: string;
  label: string;
  depth: number;
};

/**
 * Flattens a location hierarchy for display while keeping missing-parent and
 * cyclic entries reachable instead of silently dropping them.
 */
export function flattenLocationTree(locations: Location[]): LocationTreeRow[] {
  const knownIds = new Set(locations.flatMap(location => location.id ? [location.id] : []));
  const childrenByParent = new Map<string, Location[]>();

  for (const location of locations) {
    if (!location.eltern) continue;
    const children = childrenByParent.get(location.eltern) ?? [];
    children.push(location);
    childrenByParent.set(location.eltern, children.sort(compareLocations));
  }

  const visited = new Set<Location>();
  const rows: LocationTreeRow[] = [];
  const visit = (location: Location, depth: number) => {
    if (visited.has(location)) return;
    visited.add(location);
    rows.push({
      location,
      depth,
      hasMissingParent: Boolean(location.eltern && !knownIds.has(location.eltern))
    });

    if (location.id) {
      for (const child of childrenByParent.get(location.id) ?? []) {
        visit(child, depth + 1);
      }
    }
  };

  for (const location of [...locations].sort(compareLocations)) {
    if (!location.eltern) visit(location, 0);
  }
  for (const location of [...locations].sort(compareLocations)) visit(location, 0);

  return rows;
}

export function getLocationSelectOptions(locations: Location[]): LocationSelectOption[] {
  return flattenLocationTree(locations).flatMap(({ location, depth }) => {
    if (!location.id) return [];
    const name = location.name?.trim() || location.id;
    return [{
      id: location.id,
      label: `${'— '.repeat(depth)}${name}`,
      depth
    }];
  });
}

function compareLocations(left: Location, right: Location): number {
  const leftName = left.name?.trim() || left.id || '';
  const rightName = right.name?.trim() || right.id || '';
  return leftName.localeCompare(rightName, 'de-DE', { numeric: true, sensitivity: 'base' }) ||
    (left.id ?? '').localeCompare(right.id ?? '', 'de-DE', { numeric: true, sensitivity: 'base' });
}
