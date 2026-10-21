import { describe, it, expect, beforeEach } from 'vitest';
import { getAssetStore, resetAssetStore, type AssetStore } from './assets.store.svelte';
import type { AssetRow } from '../db';

describe('AssetStore', () => {
  let store: AssetStore;

  beforeEach(() => {
    resetAssetStore();
    store = getAssetStore();
  });

  it('startet leer', () => {
    expect(store.all).toHaveLength(0);
  });

  it('kann Assets hinzufügen', () => {
    const asset: AssetRow = {
      id: 'a1',
      type: 'projektor',
      location: 'loc1',
      erstellt: '2025-01-15T10:30:00Z',
      geaendert: '2025-06-20T14:22:00Z'
    };
    store.add(asset);
    expect(store.all).toHaveLength(1);
    expect(store.findById('a1')).toStrictEqual(asset);
  });

  it('findet nicht-existierende Assets nicht', () => {
    expect(store.findById('xxx')).toBeUndefined();
  });

  it('kann Assets entfernen', () => {
    store.add({ id: 'a1', type: 'kabel', location: null, erstellt: null, geaendert: null });
    expect(store.remove('a1')).toBe(true);
    expect(store.all).toHaveLength(0);
    expect(store.remove('a1')).toBe(false);
  });

  it('ersetzt die Liste mit setAll', () => {
    store.setAll([
      { id: 'x', type: 't', location: null, erstellt: null, geaendert: null },
      { id: 'y', type: 't', location: null, erstellt: null, geaendert: null }
    ]);
    expect(store.all).toHaveLength(2);
  });
});

describe('AssetStore fields', () => {
  let store: AssetStore;

  beforeEach(() => {
    resetAssetStore();
    store = getAssetStore();
  });

  it('speichert und liest Felder eines Assets', () => {
    store.add({ id: 'a1', type: 'projektor', location: null, erstellt: null, geaendert: null });
    store.setFields('a1', { hersteller: 'Sony', modell: 'VPL-FHZ50' });
    expect(store.getField('a1', 'hersteller')).toBe('Sony');
    expect(store.getField('a1', 'modell')).toBe('VPL-FHZ50');
    expect(store.getField('a1', 'nicht_da')).toBeUndefined();
  });

  it('gibt alle Felder eines Assets zurück', () => {
    store.add({ id: 'a1', type: 'projektor', location: null, erstellt: null, geaendert: null });
    store.setFields('a1', { hersteller: 'Sony', zustand: 'einwandfrei', notizen: 'Test' });
    const fields = store.getFields('a1');
    expect(fields.hersteller).toBe('Sony');
    expect(fields.zustand).toBe('einwandfrei');
    expect(fields.notizen).toBe('Test');
  });

  it('speichert Blockinstanzen eines Assets und klont die Rückgabe', () => {
    const id = store.createAsset({
      type: 'projektor',
      location: null,
      blocks: { port: { '0': { name: 'HDMI OUT' } } }
    });

    const blocks = store.getBlocks(id);
    blocks.port['0'].name = 'verändert';
    expect(store.getBlocks(id)).toEqual({ port: { '0': { name: 'HDMI OUT' } } });
  });

  it('wirft Fehler bei setFields ohne Asset', () => {
    expect(() => store.setFields('xxx', { foo: 'bar' })).toThrow();
  });

  it('löscht Felder zusammen mit Asset', () => {
    store.add({ id: 'a1', type: 'projektor', location: null, erstellt: null, geaendert: null });
    store.setFields('a1', { hersteller: 'Sony' });
    store.remove('a1');
    expect(store.getField('a1', 'hersteller')).toBeUndefined();
  });

  it('erstellt Asset mit createAsset', () => {
    const id = store.createAsset({
      type: 'projektor',
      location: 'raum1',
      fields: { hersteller: 'BenQ', modell: 'MH560' }
    });
    expect(id).toBeDefined();
    expect(store.findById(id)).toBeDefined();
    expect(store.getField(id, 'hersteller')).toBe('BenQ');
  });

  it('updateAsset aktualisiert Asset und Felder', () => {
    const id = store.createAsset({
      type: 'kabel',
      location: null,
      fields: { laenge: '2m' }
    });
    store.updateAsset(id, {
      location: 'schrank-a',
      fields: { laenge: '3m', zustand: 'defekt' }
    });
    const asset = store.findById(id)!;
    expect(asset.location).toBe('schrank-a');
    expect(store.getField(id, 'zustand')).toBe('defekt');
  });

  it('aktualisiert Blockinstanzen zusammen mit Asset-Feldern', () => {
    const id = store.createAsset({ type: 'projektor', location: null });
    store.updateAsset(id, { blocks: { port: { '1': { name: 'HDMI IN' } } } });

    expect(store.getBlocks(id)).toEqual({ port: { '1': { name: 'HDMI IN' } } });
  });

  it('gibt vollständiges Asset mit Feldern als SerializedAsset zurück', () => {
    const id = store.createAsset({
      type: 'projektor',
      location: 'loc1',
      fields: { hersteller: 'Sony', modell: 'XYZ', zustand: 'einwandfrei' }
    });
    const full = store.findFull(id);
    expect(full).toBeDefined();
    expect(full!.id).toBe(id);
    expect(full!.type).toBe('projektor');
    expect(full!.hersteller).toBe('Sony');
    expect(full!.zustand).toBe('einwandfrei');
  });

  it('findFull gibt undefined für unbekannte ID', () => {
    expect(store.findFull('unknown')).toBeUndefined();
  });

  it('clear entfernt alle Assets und Felder', () => {
    store.createAsset({ type: 'a', location: null, fields: {} });
    store.createAsset({ type: 'b', location: null, fields: {} });
    store.clear();
    expect(store.all).toHaveLength(0);
  });
});

describe('AssetStore filter', () => {
  let store: AssetStore;

  beforeEach(() => {
    resetAssetStore();
    store = getAssetStore();
  });

  it('filtert nach Typ', () => {
    store.createAsset({ type: 'projektor', location: null, fields: {} });
    store.createAsset({ type: 'kabel', location: null, fields: {} });
    store.createAsset({ type: 'projektor', location: null, fields: {} });
    expect(store.findByType('projektor')).toHaveLength(2);
    expect(store.findByType('kabel')).toHaveLength(1);
    expect(store.findByType('nix')).toHaveLength(0);
  });
});

