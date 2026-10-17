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
 * Liest ein Asset nach ID (parameterisiert gegen SQL-Injection).
 */
export function getAssetById(db: Database, id: string): AssetRow | null {
  const stmt = db.prepare(
    'SELECT id, type, location, erstellt, geaendert FROM assets WHERE id = ?'
  );
  stmt.bind([id]);
  const row: AssetRow | null = stmt.step() ? stmt.getAsObject() as AssetRow : null;
  stmt.free();
  return row;
}

/**
 * Liest alle Assets.
 */
export function getAllAssets(db: Database): AssetRow[] {
  const stmt = db.prepare(
    'SELECT id, type, location, erstellt, geaendert FROM assets ORDER BY id'
  );
  const rows: AssetRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as AssetRow);
  }
  stmt.free();
  return rows;
}

/**
 * Liest alle Felder eines Assets.
 */
export function getAssetFields(db: Database, assetId: string): Record<string, string> {
  const stmt = db.prepare(
    'SELECT path, value FROM asset_fields WHERE asset_id = ?'
  );
  stmt.bind([assetId]);
  const result: Record<string, string> = {};
  while (stmt.step()) {
    const obj = stmt.getAsObject() as { path: string; value: string };
    result[obj.path] = obj.value;
  }
  stmt.free();
  return result;
}

/**
 * Liest alle Assets mit ihren Feldern.
 */
export function getAllAssetsWithFields(
  db: Database
): { row: AssetRow; fields: Record<string, string> }[] {
  const rows = getAllAssets(db);
  return rows.map(row => ({
    row,
    fields: getAssetFields(db, row.id)
  }));
}

/**
 * Löscht ein Asset und seine Felder.
 */
export function deleteAsset(db: Database, id: string): void {
  db.run('DELETE FROM asset_fields WHERE asset_id = ?', [id]);
  db.run('DELETE FROM assets WHERE id = ?', [id]);
}

