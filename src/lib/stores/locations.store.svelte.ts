import type { Location } from '../parser/types';

/**
 * Store für Standort-Definitionen.
 * Nutzt Svelte 5 $state für Reaktivität.
 */
export class LocationsStore {
  declare all: Location[];

  constructor() {
    this.all = $state([]);
  }

  setAll(locations: Location[]): void {
    this.all = locations;
  }

  findById(id: string): Location | undefined {
    return this.all.find(l => l.id === id);
  }

  /**
   * Gibt alle Standorte ohne Eltern (Wurzelebene) zurück.
   */
  getRoots(): Location[] {
    return this.all.filter(l => !l.eltern);
  }

  /**
   * Gibt Kind-Standorte eines Eltern-Standorts zurück.
   */
  getChildren(parentId: string): Location[] {
    return this.all.filter(l => l.eltern === parentId);
  }

  add(location: Location): void {
    if (!location.id) return;
    const idx = this.all.findIndex(l => l.id === location.id);
    if (idx !== -1) {
      this.all[idx] = location;
    } else {
      this.all.push(location);
    }
  }

  remove(id: string): boolean {
    const idx = this.all.findIndex(l => l.id === id);
    if (idx === -1) return false;
    this.all.splice(idx, 1);
    return true;
  }

  clear(): void {
    this.all = [];
  }
}

let _store: LocationsStore | null = null;

export function getLocationsStore(): LocationsStore {
  if (!_store) _store = new LocationsStore();
  return _store;
}

export function resetLocationsStore(): void {
  _store = null;
}
