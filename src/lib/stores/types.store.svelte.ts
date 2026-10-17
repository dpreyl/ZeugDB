import type { TypeDefinition } from '../parser/types';

/**
 * Store für Asset-Typ-Definitionen.
 * Nutzt Svelte 5 $state für Reaktivität.
 */
export class TypesStore {
  declare all: TypeDefinition[];

  constructor() {
    this.all = $state([]);
  }

  setAll(types: TypeDefinition[]): void {
    this.all = types;
  }

  findById(id: string): TypeDefinition | undefined {
    return this.all.find(t => t.id === id);
  }

  add(type: TypeDefinition): void {
    const idx = this.all.findIndex(t => t.id === type.id);
    if (idx !== -1) {
      this.all[idx] = type;
    } else {
      this.all.push(type);
    }
  }

  remove(id: string): boolean {
    const idx = this.all.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.all.splice(idx, 1);
    return true;
  }

  clear(): void {
    this.all = [];
  }
}

let _store: TypesStore | null = null;

export function getTypesStore(): TypesStore {
  if (!_store) _store = new TypesStore();
  return _store;
}

export function resetTypesStore(): void {
  _store = null;
}
