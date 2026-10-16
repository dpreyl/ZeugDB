import { SCHEMA_SQL } from './schema';
import type { Database } from 'sql.js';

export interface AssetRow {
  id: string;
  type: string;
  location: string | null;
  erstellt: string | null;
  geaendert: string | null;
}

export interface AssetInput {
  id: string;
  type: string;
  location: string | null;
  erstellt: string | null;
  geaendert: string | null;
}

/**
 * Initialisiert eine leere SQLite-Datenbank mit dem ZeugDB-Schema.
 */
export function initDb(SQL: typeof import('sql.js')): Database {
  const db = new SQL.Database();
  db.run(SCHEMA_SQL);
  return db;
}

/**
 * Fügt ein Asset ein oder aktualisiert es.
 */
export function upsertAsset(db: Database, a: AssetInput): void {
  db.run(
    `INSERT INTO assets (id, type, location, erstellt, geaendert)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type=excluded.type, location=excluded.location,
       erstellt=excluded.erstellt, geaendert=excluded.geaendert`,
    [a.id, a.type, a.location || null, a.erstellt, a.geaendert]
  );
}

/**
 * Setzt mehrere Felder eines Assets (ersetzt existierende).
 */
export function upsertAssetFields(db: Database, assetId: string, fields: Record<string, string>): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO asset_fields (asset_id, path, value)
     VALUES (?, ?, ?)`
  );
  for (const [path, value] of Object.entries(fields)) {
    stmt.run([assetId, path, value]);
  }
  stmt.free();
}

/**
 * Liest ein Asset nach ID.
 */
export function getAssetById(db: Database, id: string): AssetRow | null {
  const result = db.exec(`SELECT id, type, location, erstellt, geaendert FROM assets WHERE id = '${id}'`);
  if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) return null;
  const cols = result[0].columns as (keyof AssetRow)[];
  const vals = result[0].values[0] as (string | null)[];
  return cols.reduce((obj, col, i) => ({ ...obj, [col]: vals[i] }), {} as AssetRow);
}

/**
 * Liest alle Assets.
 */
export function getAllAssets(db: Database): AssetRow[] {
  const result = db.exec('SELECT id, type, location, erstellt, geaendert FROM assets ORDER BY id');
  if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) return [];
  const cols = result[0].columns as (keyof AssetRow)[];
  return result[0].values.map((vals: (string | null)[]) =>
    cols.reduce((obj, col, i) => ({ ...obj, [col]: vals[i] }), {} as AssetRow)
  );
}

/**
 * Löscht ein Asset und seine Felder.
 */
export function deleteAsset(db: Database, id: string): void {
  db.run('DELETE FROM asset_fields WHERE asset_id = ?', [id]);
  db.run('DELETE FROM assets WHERE id = ?', [id]);
}

