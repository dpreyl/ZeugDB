import type { Database, AssetInput, AssetRow } from '../db';
import {
  getAllAssetsWithFields,
  upsertAsset,
  upsertAssetFields,
  deleteAsset as dbDeleteAsset
} from '../db';
import { getAssetStore, type AssetStore } from '../stores/assets.store.svelte';

/**
 * Lädt alle Assets aus der DB in den Store.
 * Ersetzt den kompletten Store-Inhalt.
 */
export function loadAssetsFromDb(db: Database): void {
  const store = getAssetStore();
  const all = getAllAssetsWithFields(db);

  store.setAll(all.map(a => a.row));

  // Set fields for each asset
  all.forEach(({ row, fields }) => {
    if (Object.keys(fields).length > 0) {
      store.setFields(row.id, fields);
    }
  });
}

/**
 * Speichert alle Store-Änderungen zurück in die DB.
 */
export function saveAssetsToDb(db: Database): void {
  const store = getAssetStore();

  for (const row of store.all) {
    upsertAsset(db, row);
    const fields = store.getFields(row.id);
    if (Object.keys(fields).length > 0) {
      upsertAssetFields(db, row.id, fields);
    }
  }
}

/**
 * Erstellt ein neues Asset im Store und speichert es in der DB.
 */
export function createAsset(
  db: Database,
  input: { type: string; location?: string | null; fields?: Record<string, string> }
): string {
  const store = getAssetStore();
  const id = store.createAsset(input);

  // Persist to DB
  const row = store.findById(id)!
  upsertAsset(db, row);
  if (input.fields && Object.keys(input.fields).length > 0) {
    upsertAssetFields(db, id, input.fields);
  }

  return id;
}

/**
 * Aktualisiert ein Asset im Store und in der DB.
 */
export function updateAsset(
  db: Database,
  id: string,
  input: { location?: string | null; fields?: Record<string, string> }
): void {
  const store = getAssetStore();
  store.updateAsset(id, input);

  // Persist to DB
  const row = store.findById(id)!
  upsertAsset(db, row);
  if (input.fields && Object.keys(input.fields).length > 0) {
    upsertAssetFields(db, id, input.fields);
  }
}

/**
 * Löscht ein Asset aus Store und DB.
 */
export function deleteAsset(db: Database, id: string): boolean {
  const store = getAssetStore();
  if (!store.remove(id)) return false;
  dbDeleteAsset(db, id);
  return true;
}
