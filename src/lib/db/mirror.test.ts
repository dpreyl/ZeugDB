import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs from 'sql.js';
import { initDb, getAllAssets, getAssetById } from './db';
import { mirrorAssetFile } from './mirror';

describe('mirrorAssetFile', () => {
  let db: import('sql.js').Database;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = initDb(SQL);
  });

  afterAll(() => {
    db.close();
  });

  it('spiegelt ein Asset aus Text in die DB', () => {
    const assetText = [
      'id: a1',
      'type: projektor',
      'location: loc1',
      'erstellt: 2025-01-15T10:30:00Z',
      'geaendert: 2025-06-20T14:22:00Z',
      'hersteller: Sony',
      'zustand: einwandfrei',
      'stromanschluss[1].spannung: 230'
    ].join('\n');

    mirrorAssetFile(db, 'a1.asset', assetText);

    const asset = getAssetById(db, 'a1');
    expect(asset).not.toBeNull();
    expect(asset!.type).toBe('projektor');
    expect(asset!.location).toBe('loc1');

    const fields = db.exec(
      "SELECT path, value FROM asset_fields WHERE asset_id = 'a1' ORDER BY path"
    );
    const values = fields[0]?.values;
    expect(values).toContainEqual(['hersteller', 'Sony']);
    expect(values).toContainEqual(['zustand', 'einwandfrei']);
    expect(values).toContainEqual(['stromanschluss[1].spannung', '230']);
  });

  it('überschreibt ein bestehendes Asset', () => {
    const updatedText = [
      'id: a1',
      'type: projektor',
      'location: loc2',
      'erstellt: 2025-01-15T10:30:00Z',
      'geaendert: 2025-06-21T09:00:00Z',
      'hersteller: Epson',
      'zustand: defekt'
    ].join('\n');

    mirrorAssetFile(db, 'a1.asset', updatedText);

    const asset = getAssetById(db, 'a1');
    expect(asset!.location).toBe('loc2');
    const fields = db.exec(
      "SELECT path, value FROM asset_fields WHERE asset_id = 'a1' ORDER BY path"
    );
    const values = fields[0]?.values;
    expect(values).toContainEqual(['hersteller', 'Epson']);
    expect(values).toContainEqual(['zustand', 'defekt']);
    // altes Block-Feld ist weg
    expect(values).not.toContainEqual(['stromanschluss[1].spannung', '230']);
  });

  it('spiegelt mehrere Assets', () => {
    const text2 = [
      'id: b2',
      'type: kabel',
      'location: null',
      'erstellt: 2025-06-01T00:00:00Z',
      'geaendert: 2025-06-01T00:00:00Z',
      'laenge: 200'
    ].join('\n');

    mirrorAssetFile(db, 'b2.asset', text2);
    expect(getAllAssets(db)).toHaveLength(2);
  });
});

