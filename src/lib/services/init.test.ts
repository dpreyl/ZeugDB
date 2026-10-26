import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initializeStore,
  persistStore,
  serializeAssetFile
} from './init';
import { getAssetStore, resetAssetStore } from '../stores/assets.store.svelte';
import { getTypesStore, resetTypesStore } from '../stores/types.store.svelte';
import { getComponentsStore, resetComponentsStore } from '../stores/components.store.svelte';
import { getLocationsStore, resetLocationsStore } from '../stores/locations.store.svelte';

const ASSETS_KEY = 'zeugdb:assets';
const TYPES_KEY = 'zeugdb:types';
const LOCATIONS_KEY = 'zeugdb:locations';

describe('init', () => {
  beforeEach(() => {
    resetAssetStore();
    resetTypesStore();
    resetComponentsStore();
    resetLocationsStore();
    localStorage.clear();
  });

  afterEach(() => {
    resetAssetStore();
    resetTypesStore();
    resetComponentsStore();
    resetLocationsStore();
    localStorage.clear();
  });

  it('füllt leere Stores beim ersten Aufruf nicht mit Demo-Daten', () => {
    initializeStore();

    expect(getAssetStore().all).toEqual([]);
    expect(getTypesStore().all).toEqual([]);
    expect(getLocationsStore().all).toEqual([]);
    expect(localStorage.getItem(ASSETS_KEY)).toBeNull();
  });

  it('entfernt alte eingebaute Test-Assets, lässt echte lokale Assets aber bestehen', () => {
    const store = getAssetStore();
    const demoId = store.createAsset({
      type: 'projektor',
      location: 'raum-101',
      fields: {
        hersteller: 'Sony',
        modell: 'VPL-FHZ50',
        seriennummer: 'S123456789',
        inventarnummer: 'DEV-2024-0042',
        zustand: 'einwandfrei'
      }
    });
    const realId = store.createAsset({
      type: 'projektor',
      location: 'raum-101',
      fields: { hersteller: 'Sony', modell: 'VPL-XW5000' }
    });
    getLocationsStore().add({ id: 'serverraum', name: 'Serverraum' });
    getLocationsStore().add({ id: 'raum-101', name: 'Raum 101', eltern: 'serverraum' });
    getLocationsStore().add({ id: 'raum-102', name: 'Raum 102', eltern: 'serverraum' });
    persistStore();

    resetAssetStore();
    initializeStore();

    expect(getAssetStore().findById(demoId)).toBeUndefined();
    expect(getAssetStore().findById(realId)).toBeDefined();
    expect(getLocationsStore().findById('raum-101')).toBeDefined();
    expect(getLocationsStore().findById('raum-102')).toBeUndefined();
  });

  it('entfernt alte Demo-Typen, aber keine später angepassten Typen', () => {
    getTypesStore().add({
      id: 'projektor',
      name: 'Projektor',
      extends: '_base',
      kategorie: 'gerät',
      fields: [
        { nr: 0, name: 'hersteller', art: 'text', optionen: null, pflicht: false, sensitiv: false },
        { nr: 1, name: 'modell', art: 'text', optionen: null, pflicht: false, sensitiv: false },
        { nr: 2, name: 'seriennummer', art: 'text', optionen: null, pflicht: false, sensitiv: false },
        { nr: 3, name: 'inventarnummer', art: 'text', optionen: null, pflicht: false, sensitiv: false },
        { nr: 4, name: 'zustand', art: 'auswahl', optionen: 'neu,einwandfrei,defekt,in_reparatur,verschrottet', pflicht: true, sensitiv: false }
      ],
      blocks: []
    });
    getTypesStore().add({
      id: 'hdmi-kabel',
      name: 'Eigenes HDMI-Kabel',
      extends: '_base',
      kategorie: 'kabel',
      fields: [],
      blocks: []
    });
    persistStore();

    resetAssetStore();
    resetTypesStore();
    initializeStore();

    expect(getTypesStore().findById('projektor')).toBeUndefined();
    expect(getTypesStore().findById('hdmi-kabel')?.name).toBe('Eigenes HDMI-Kabel');
  });

  it('entfernt alte Demo-Standorte, wenn keine echten Assets mehr darauf verweisen', () => {
    getLocationsStore().add({ id: 'serverraum', name: 'Serverraum' });
    getLocationsStore().add({ id: 'raum-101', name: 'Raum 101', eltern: 'serverraum' });
    getLocationsStore().add({ id: 'raum-102', name: 'Raum 102', eltern: 'serverraum' });
    persistStore();

    resetLocationsStore();
    initializeStore();

    expect(getLocationsStore().all).toEqual([]);
  });

  it('behält alte Raumdatensätze, die noch echte Unterstandorte enthalten', () => {
    getLocationsStore().add({ id: 'serverraum', name: 'Serverraum' });
    getLocationsStore().add({ id: 'raum-101', name: 'Raum 101', eltern: 'serverraum' });
    getLocationsStore().add({ id: 'unterraum', name: 'Unterraum', eltern: 'raum-101' });
    persistStore();

    resetLocationsStore();
    initializeStore();

    expect(getLocationsStore().findById('raum-101')).toBeDefined();
    expect(getLocationsStore().findById('unterraum')).toBeDefined();
  });

  it('speichert alle Stores in localStorage', () => {
    getAssetStore().createAsset({ type: 'test-typ' });
    getTypesStore().add({ id: 'test-typ', name: 'Test', fields: [], blocks: [] });
    getLocationsStore().add({ id: 'test-loc', name: 'Test-Ort' });
    initializeStore();
    persistStore();

    const assets = localStorage.getItem(ASSETS_KEY);
    const types = localStorage.getItem(TYPES_KEY);
    const locations = localStorage.getItem(LOCATIONS_KEY);

    expect(assets).not.toBeNull();
    expect(types).not.toBeNull();
    expect(locations).not.toBeNull();

    // JSON muss gültig sein
    expect(() => JSON.parse(assets!)).not.toThrow();
    expect(() => JSON.parse(types!)).not.toThrow();
    expect(() => JSON.parse(locations!)).not.toThrow();
  });

  it('lädt Assets aus localStorage beim Neustart', () => {
    const originalId = getAssetStore().createAsset({ type: 'test-typ' });
    persistStore();
    initializeStore();
    const originalCount = getAssetStore().all.length;

    // Stores zurücksetzen (simuliert Neustart)
    resetAssetStore();
    resetTypesStore();
    resetLocationsStore();

    // Neue Store-Instanz — Daten müssten aus localStorage kommen
    initializeStore();
    expect(getAssetStore().all.length).toBe(originalCount);
    expect(getAssetStore().findById(originalId)).toBeDefined();
  });

  it('lädt gespeicherte Blockwerte eines Assets nach einem Neustart', () => {
    const assetStore = getAssetStore();
    const assetId = assetStore.createAsset({
      type: 'projektor',
      blocks: { port: { '0': { name: 'HDMI OUT' } } }
    });
    persistStore();

    resetAssetStore();
    initializeStore();

    expect(getAssetStore().getBlocks(assetId)).toEqual({
      port: { '0': { name: 'HDMI OUT' } }
    });
  });

  it('persistStore speichert neue Assets', () => {
    const store = getAssetStore();
    store.createAsset({
      type: 'test',
      location: 'test-loc',
      fields: { hersteller: 'TestCo' }
    });
    persistStore();

    const saved = JSON.parse(localStorage.getItem(ASSETS_KEY)!);
    expect(saved.length).toBe(1);
    expect(saved[0].row.type).toBe('test');
    expect(saved[0].fields.hersteller).toBe('TestCo');
  });

  it('serializes every type-defined asset field to its .asset file', () => {
    const output = serializeAssetFile({
      id: 'asset-1',
      type: 'projektor',
      location: null,
      erstellt: '2026-10-21T10:00:00.000Z',
      geaendert: '2026-10-21T10:00:00.000Z',
      hersteller: 'Sony',
      modell: '',
      seriennummer: '',
      inventarnummer: '',
      zustand: '',
      notizen: '',
      lichtstaerke: '5000',
      aufloesung: '4K'
    });

    expect(output).toContain('lichtstaerke: 5000');
    expect(output).toContain('aufloesung: 4K');
    expect(output).not.toContain('location:');
  });

  it('serializes block instances and their referenced asset ids', () => {
    const output = serializeAssetFile({
      id: 'projector-1',
      type: 'projektor',
      location: null,
      erstellt: null,
      geaendert: null,
      hersteller: '',
      modell: '',
      seriennummer: '',
      inventarnummer: '',
      zustand: '',
      notizen: '',
      blocks: { port: { '0': { name: 'HDMI OUT', kabel: 'cable-1' } } }
    });

    expect(output).toContain('port[0].name: HDMI OUT');
    expect(output).toContain('port[0].kabel: cable-1');
  });

  it('persistiert Komponentendefinitionen für den nächsten Start', () => {
    getComponentsStore().add({ id: 'port', name: 'Port', fields: [] });
    persistStore();
    const saved = JSON.parse(localStorage.getItem('zeugdb:components')!);
    expect(saved).toEqual([{ id: 'port', name: 'Port', fields: [] }]);
  });

  it('persistStore speichert neue Typen', () => {
    const store = getTypesStore();
    store.add({
      id: 'test-typ',
      name: 'Test-Typ',
      fields: [],
      blocks: []
    });
    persistStore();

    const saved = JSON.parse(localStorage.getItem(TYPES_KEY)!);
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe('test-typ');
  });

  it('persistStore speichert neue Standorte', () => {
    const store = getLocationsStore();
    store.add({
      id: 'test-loc',
      name: 'Test-Standort'
    });
    persistStore();

    const saved = JSON.parse(localStorage.getItem(LOCATIONS_KEY)!);
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe('test-loc');
  });

  it('initialisiert nicht, wenn bereits Daten vorhanden', () => {
    // Manuell ein Asset setzen
    const store = getAssetStore();
    store.createAsset({ type: 'vorhanden' });

    // initializeStore sollte nichts tun
    initializeStore();

    // Immer noch nur das eine Asset
    expect(store.all.length).toBe(1);
    expect(store.all[0].type).toBe('vorhanden');
  });

  it('ignoriert korrupte localStorage-Daten', () => {
    localStorage.setItem(ASSETS_KEY, '{ ungültiges JSON');

    // Darf nicht werfen
    expect(() => initializeStore()).not.toThrow();
  });
});
