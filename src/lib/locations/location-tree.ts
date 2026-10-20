import type { Location } from '../parser/types';

export type LocationTreeRow = {
  location: Location;
  depth: number;
  hasMissingParent: boolean;
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
    childrenByParent.set(location.eltern, children);
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

  for (const location of locations) {
    if (!location.eltern) visit(location, 0);
  }
  for (const location of locations) visit(location, 0);

  return rows;
}
