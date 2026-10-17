import { type AssetRow } from '../db';

/**
 * Erweitertes Asset mit allen Feldern (für UI).
 */
export interface SerializedAsset extends AssetRow {
  hersteller: string;
  modell: string;
  seriennummer: string;
  inventarnummer: string;
  zustand: string;
  notizen: string;
  [key: string]: string | null;
}

function generateId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Store für Assets mit Feld-Support.
 * Nutzt Svelte 5 $state für Reaktivität — Mutationen triggern UI-Updates.
 */
export class AssetStore {
  declare all: AssetRow[];
  #fields: Map<string, Record<string, string>>;

  constructor() {
    // $state macht das Array reaktiv — Komponenten, die auf `store.all`
    // zugreifen, werden bei Mutationen neu gerendert.
    this.all = $state([]);
    this.#fields = new Map();
  }

  setAll(rows: AssetRow[]): void {
    this.#fields.clear();
    this.all = rows;
  }

  add(row: AssetRow): void {
    this.all.push(row);
  }

  findById(id: string): AssetRow | undefined {
    return this.all.find(a => a.id === id);
  }

  findByType(type: string): AssetRow[] {
    return this.all.filter(a => a.type === type);
  }

  setFields(assetId: string, fields: Record<string, string>): void {
    if (!this.findById(assetId)) {
      throw new Error(`Asset '${assetId}' nicht gefunden`);
    }
    this.#fields.set(assetId, { ...this.#fields.get(assetId), ...fields });
  }

  getField(assetId: string, path: string): string | undefined {
    return this.#fields.get(assetId)?.[path];
  }

  getFields(assetId: string): Record<string, string> {
    return { ...this.#fields.get(assetId) ?? {} };
  }

  /**
   * Gibt ein vollständiges Asset mit allen Feldern als flaches Objekt zurück.
   */
  findFull(id: string): SerializedAsset | undefined {
    const row = this.findById(id);
    if (!row) return undefined;
    const fields = this.#fields.get(id) ?? {};
    return {
      id: row.id,
      type: row.type,
      location: row.location,
      erstellt: row.erstellt,
      geaendert: row.geaendert,
      hersteller: fields['hersteller'] ?? '',
      modell: fields['modell'] ?? '',
      seriennummer: fields['seriennummer'] ?? '',
      inventarnummer: fields['inventarnummer'] ?? '',
      zustand: fields['zustand'] ?? 'einwandfrei',
      notizen: fields['notizen'] ?? '',
      ...fields
    };
  }

  /**
   * Erstellt ein neues Asset mit optionalen Feldern.
   * Gibt die neue Asset-ID zurück.
   */
  createAsset(input: { type: string; location?: string | null; fields?: Record<string, string> }): string {
    const now = new Date().toISOString();
    const id = generateId();
    const row: AssetRow = {
      id,
      type: input.type,
      location: input.location ?? null,
      erstellt: now,
      geaendert: now
    };
    this.add(row);
    if (input.fields && Object.keys(input.fields).length > 0) {
      this.setFields(id, input.fields);
    }
    return id;
  }

  /**
   * Aktualisiert ein existierendes Asset (location + Felder).
   */
  updateAsset(id: string, input: { location?: string | null; fields?: Record<string, string> }): void {
    const idx = this.all.findIndex(a => a.id === id);
    if (idx === -1) throw new Error(`Asset '${id}' nicht gefunden`);
    if (input.location !== undefined) {
      this.all[idx] = { ...this.all[idx], location: input.location, geaendert: new Date().toISOString() };
    }
    if (input.fields && Object.keys(input.fields).length > 0) {
      this.setFields(id, input.fields);
    }
  }

  remove(id: string): boolean {
    const idx = this.all.findIndex(a => a.id === id);
    if (idx === -1) return false;
    this.all.splice(idx, 1);
    this.#fields.delete(id);
    return true;
  }

  clear(): void {
    this.all = [];
    this.#fields.clear();
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

