import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs from 'sql.js';
import { initDb, getAllAssets, getAssetById } from '../db';
import { createMockFs } from './repo-fs';
import { syncAssetsToDb } from './repo-sync';

describe('syncAssetsToDb', () => {
  let db: import('sql.js').Database;
  let fs: ReturnType<typeof createMockFs>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = initDb(SQL);
    fs = createMockFs();
  });

  afterAll(() => {
    db.close();
  });

  it('spiegelt alle .asset-Dateien in die DB', async () => {
    await fs.writeFile('assets/a1.asset', [
      'id: a1',
      'type: projektor',
      'location: loc1',
      'erstellt: 2025-01-15T10:30:00Z',
      'geaendert: 2025-06-20T14:22:00Z',
      'hersteller: Sony'
    ].join('\n'));

    await fs.writeFile('assets/b2.asset', [
      'id: b2',
      'type: kabel',
      'location: loc2',
      'erstellt: 2025-06-01T00:00:00Z',
      'geaendert: 2025-06-01T00:00:00Z',
      'laenge: 200'
    ].join('\n'));

    await syncAssetsToDb(db, fs);

    const all = getAllAssets(db);
    expect(all).toHaveLength(2);

    const a1 = getAssetById(db, 'a1');
    expect(a1).not.toBeNull();
    expect(a1!.type).toBe('projektor');
  });

  it('ignoriert leere assets/', async () => {
    db.run('DELETE FROM assets');
    db.run('DELETE FROM asset_fields');
    // FS hat nur a1.asset und b2.asset, keine neue Datei
    // → sync überschreibt die DB mit dem FS-Zustand
    await syncAssetsToDb(db, fs);
    expect(getAllAssets(db)).toHaveLength(2);
  });
});

