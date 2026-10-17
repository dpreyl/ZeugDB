import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { initDb, upsertAsset, upsertAssetFields, getAllAssets, getAssetById, deleteAsset, getAssetFields, getAllAssetsWithFields } from './db';

describe('db', () => {
  let db: Database;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = initDb(SQL);
  });

  afterAll(() => {
    db.close();
  });

  it('hat alle Tabellen erstellt', () => {
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const names = tables[0]?.values?.flat() as string[];
    expect(names).toContain('assets');
    expect(names).toContain('asset_fields');
    expect(names).toContain('asset_types');
    expect(names).toContain('type_fields');
    expect(names).toContain('components');
    expect(names).toContain('locations');
  });

  it('kann ein Asset einfügen und lesen', () => {
    upsertAsset(db, {
      id: 'a1',
      type: 'projektor',
      location: 'loc1',
      erstellt: '2025-01-15T10:30:00Z',
      geaendert: '2025-06-20T14:22:00Z'
    });
    const asset = getAssetById(db, 'a1');
    expect(asset).not.toBeNull();
    expect(asset!.type).toBe('projektor');
  });

  it('kann Felder eines Assets setzen', () => {
    upsertAssetFields(db, 'a1', {
      'hersteller': 'Sony',
      'zustand': 'einwandfrei',
      'port[1].name': 'HDMI OUT 1'
    });
    const rows = db.exec(
      "SELECT path, value FROM asset_fields WHERE asset_id = 'a1' ORDER BY path"
    );
    const values = rows[0]?.values;
    expect(values).toHaveLength(3);
  });

  it('listet alle Assets', () => {
    upsertAsset(db, {
      id: 'a2',
      type: 'kabel',
      location: null,
      erstellt: '2025-06-01T00:00:00Z',
      geaendert: '2025-06-01T00:00:00Z'
    });
    const all = getAllAssets(db);
    expect(all).toHaveLength(2);
  });

  it('kann ein Asset löschen', () => {
    deleteAsset(db, 'a2');
    expect(getAssetById(db, 'a2')).toBeNull();
    expect(getAllAssets(db)).toHaveLength(1);
  });

  it('nutzt parameterisierte Abfragen (kein SQL-Injection)', () => {
    // Ein ID mit SQL-Injection-Attempt sollte kein Asset finden
    const result = getAssetById(db, "' OR '1'='1");
    expect(result).toBeNull();
  });

  it('liest Felder eines Assets mit getAssetFields', () => {
    upsertAssetFields(db, 'a1', { hersteller: 'Sony', modell: 'VPL-FHZ50' });
    const fields = getAssetFields(db, 'a1');
    expect(fields.hersteller).toBe('Sony');
    expect(fields.modell).toBe('VPL-FHZ50');
  });

  it('gibt leeres Objekt bei fehlenden Feldern zurück', () => {
    upsertAsset(db, { id: 'a3', type: 'test', location: null, erstellt: null, geaendert: null });
    const fields = getAssetFields(db, 'a3');
    expect(fields).toEqual({});
  });

  it('liest alle Assets mit Feldern', () => {
    const all = getAllAssetsWithFields(db);
    expect(all).toHaveLength(2);
    const a1 = all.find(a => a.row.id === 'a1');
    expect(a1).toBeDefined();
    expect(a1!.fields.hersteller).toBe('Sony');
  });
});

