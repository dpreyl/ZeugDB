import { describe, it, expect, beforeEach } from 'vitest';
import { getLocationsStore, resetLocationsStore } from './locations.store.svelte';
import type { Location } from '../parser/types';

describe('LocationsStore', () => {
  beforeEach(() => {
    resetLocationsStore();
  });

  it('startet leer', () => {
    expect(getLocationsStore().all).toEqual([]);
  });

  it('fügt einen Standort hinzu', () => {
    const store = getLocationsStore();
    const loc: Location = { id: 'raum-101', name: 'Raum 101' };
    store.add(loc);
    expect(store.all).toHaveLength(1);
    expect(store.findById('raum-101')).toBeDefined();
  });

  it('ignoriert add ohne ID', () => {
    const store = getLocationsStore();
    store.add({ name: 'Ohne ID' });
    expect(store.all).toHaveLength(0);
  });

  it('überschreibt einen bestehenden Standort', () => {
    const store = getLocationsStore();
    store.add({ id: 'raum', name: 'Alt' });
    store.add({ id: 'raum', name: 'Neu' });
    expect(store.all).toHaveLength(1);
    expect(store.findById('raum')?.name).toBe('Neu');
  });

  it('gibt Wurzel-Standorte zurück', () => {
    const store = getLocationsStore();
    store.add({ id: 'root', name: 'Wurzel' });
    store.add({ id: 'child', name: 'Kind', eltern: 'root' });
    expect(store.getRoots()).toHaveLength(1);
  });

  it('gibt Kind-Standorte zurück', () => {
    const store = getLocationsStore();
    store.add({ id: 'root', name: 'Wurzel' });
    store.add({ id: 'a', name: 'A', eltern: 'root' });
    store.add({ id: 'b', name: 'B', eltern: 'root' });
    expect(store.getChildren('root')).toHaveLength(2);
  });

  it('entfernt einen Standort', () => {
    const store = getLocationsStore();
    store.add({ id: 'raum', name: 'Raum' });
    expect(store.remove('raum')).toBe(true);
    expect(store.all).toHaveLength(0);
  });

  it('gibt false bei Entfernen nicht-existenter Standort', () => {
    expect(getLocationsStore().remove('nicht-da')).toBe(false);
  });
});
