import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { initDb } from '../db/db';
import {
  loadAssetsFromDb,
  saveAssetsToDb,
  createAsset,
  updateAsset,
  deleteAsset
} from './asset.service';
import { getAssetStore, resetAssetStore } from '../stores/assets.store.svelte';

describe('asset.service', () => {
  let db: Database;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = initDb(SQL);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    resetAssetStore();
  });

  it('lädt Assets aus der DB in den Store', () => {
    // Seed DB directly
    db.run(
      "INSERT INTO assets (id, type, location, erstellt, geaendert) VALUES ('a1', 'projektor', 'loc1', '2025-01-01', '2025-01-01')"
    );
    db.run(
      "INSERT INTO asset_fields (asset_id, path, value) VALUES ('a1', 'hersteller', 'Sony')"
    );

    loadAssetsFromDb(db);

    const store = getAssetStore();
    expect(store.all).toHaveLength(1);
    expect(store.findById('a1')!.type).toBe('projektor');
    expect(store.getField('a1', 'hersteller')).toBe('Sony');
  });

  it('speichert Store-Änderungen zurück in die DB', () => {
    const store = getAssetStore();
    store.createAsset({ type: 'kabel', fields: { laenge: '2m' } });
    const id = store.all[0].id;

    saveAssetsToDb(db);

    const result = db.exec(`SELECT id FROM assets WHERE id = '${id}'`);
    expect(result[0]?.values?.length).toBe(1);
  });

  it('erstellt Asset in Store und DB', () => {
    const id = createAsset(db, {
      type: 'netzteil',
      location: 'schrank',
      fields: { spannung: '12V' }
    });

    const store = getAssetStore();
    expect(store.findById(id)).toBeDefined();
    expect(store.getField(id, 'spannung')).toBe('12V');

    // Verify DB
    const stmt = db.prepare('SELECT type, location FROM assets WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const obj = stmt.getAsObject() as { type: string; location: string };
    expect(obj.type).toBe('netzteil');
    expect(obj.location).toBe('schrank');
    stmt.free();
  });

  it('aktualisiert Asset in Store und DB', () => {
    const id = createAsset(db, { type: 'kabel', fields: {} });

    updateAsset(db, id, {
      location: 'schrank-b',
      fields: { laenge: '3m', zustand: 'defekt' }
    });

    const store = getAssetStore();
    expect(store.findById(id)!.location).toBe('schrank-b');
    expect(store.getField(id, 'zustand')).toBe('defekt');
  });

  it('löscht Asset aus Store und DB', () => {
    const id = createAsset(db, { type: 'test', fields: {} });

    expect(deleteAsset(db, id)).toBe(true);

    const store = getAssetStore();
    expect(store.findById(id)).toBeUndefined();

    const stmt = db.prepare('SELECT COUNT(*) as count FROM assets WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const obj = stmt.getAsObject() as { count: number };
    expect(obj.count).toBe(0);
    stmt.free();
  });

  it('gibt false bei delete nicht-existierendes Asset', () => {
    expect(deleteAsset(db, 'nicht_da')).toBe(false);
  });
});
