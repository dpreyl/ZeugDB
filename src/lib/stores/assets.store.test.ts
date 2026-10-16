import { describe, it, expect, beforeEach } from 'vitest';
import { getAssetStore, resetAssetStore, type AssetStore } from './assets.store';
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
    expect(store.findById('a1')).toBe(asset);
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

