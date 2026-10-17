import { describe, it, expect, beforeEach } from 'vitest';
import { getTypesStore, resetTypesStore } from './types.store.svelte';
import type { TypeDefinition } from '../parser/types';

describe('TypesStore', () => {
  beforeEach(() => {
    resetTypesStore();
  });

  it('startet leer', () => {
    expect(getTypesStore().all).toEqual([]);
  });

  it('fügt einen Typ hinzu', () => {
    const store = getTypesStore();
    const type: TypeDefinition = {
      id: 'projektor',
      name: 'Projektor',
      fields: [{ nr: 0, name: 'hersteller', art: 'text', optionen: null, pflicht: false, sensitiv: false }],
      blocks: []
    };
    store.add(type);
    expect(store.all).toHaveLength(1);
    expect(store.findById('projektor')).toBeDefined();
  });

  it('überschreibt einen bestehenden Typ', () => {
    const store = getTypesStore();
    store.add({ id: 'kabel', name: 'Kabel', fields: [], blocks: [] });
    store.add({ id: 'kabel', name: 'Kabel (neu)', fields: [], blocks: [] });
    expect(store.all).toHaveLength(1);
    expect(store.findById('kabel')?.name).toBe('Kabel (neu)');
  });

  it('entfernt einen Typ', () => {
    const store = getTypesStore();
    store.add({ id: 'kabel', name: 'Kabel', fields: [], blocks: [] });
    expect(store.remove('kabel')).toBe(true);
    expect(store.all).toHaveLength(0);
  });

  it('gibt false bei Entfernen nicht-existenter Typ', () => {
    expect(getTypesStore().remove('nicht-da')).toBe(false);
  });

  it('setzt alle Typen auf einmal', () => {
    const store = getTypesStore();
    store.add({ id: 'a', name: 'A', fields: [], blocks: [] });
    store.setAll([{ id: 'b', name: 'B', fields: [], blocks: [] }]);
    expect(store.all).toHaveLength(1);
    expect(store.all[0].id).toBe('b');
  });

  it('leert den Store', () => {
    const store = getTypesStore();
    store.add({ id: 'a', name: 'A', fields: [], blocks: [] });
    store.clear();
    expect(store.all).toHaveLength(0);
  });
});
