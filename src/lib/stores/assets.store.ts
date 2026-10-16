import { type AssetRow } from '../db';

/**
 * Einfacher reaktiver Store für die Asset-Liste.
 * Wird später durch DB-Abfragen befüllt.
 */
export class AssetStore {
  private items: AssetRow[] = [];

  get all(): AssetRow[] {
    return this.items;
  }

  setAll(rows: AssetRow[]): void {
    this.items = rows;
  }

  add(row: AssetRow): void {
    this.items.push(row);
  }

  findById(id: string): AssetRow | undefined {
    return this.items.find(a => a.id === id);
  }

  remove(id: string): boolean {
    const idx = this.items.findIndex(a => a.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }

  clear(): void {
    this.items = [];
  }
}

let _store: AssetStore | null = null;

export function getAssetStore(): AssetStore {
  if (!_store) _store = new AssetStore();
  return _store;
}

export function resetAssetStore(): void {
  _store = null;
}

