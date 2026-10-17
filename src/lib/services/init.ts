import { getAssetStore } from '../stores/assets.store.svelte';
import { getTypesStore } from '../stores/types.store.svelte';
import { getLocationsStore } from '../stores/locations.store.svelte';
import type { AssetRow } from '../db';
import type { TypeDefinition } from '../parser/types';
import type { Location } from '../parser/types';

const ASSETS_KEY = 'zeugdb:assets';
const TYPES_KEY = 'zeugdb:types';
const LOCATIONS_KEY = 'zeugdb:locations';

/**
 * Serialisiert den Asset-Store für localStorage.
 */
function serializeAssets(): string {
  const store = getAssetStore();
  const data = store.all.map(row => ({
    row,
    fields: store.getFields(row.id)
  }));
  return JSON.stringify(data);
}

/**
 * Deserialisiert gespeicherte Assets zurück in den Store.
 */
function deserializeAssets(json: string): void {
  const store = getAssetStore();
  const data: { row: AssetRow; fields: Record<string, string> }[] = JSON.parse(json);

  store.setAll(data.map(d => d.row));
  for (const { row, fields } of data) {
    if (Object.keys(fields).length > 0) {
      store.setFields(row.id, fields);
    }
  }
}

/**
 * Serialisiert den Types-Store für localStorage.
 */
function serializeTypes(): string {
  const store = getTypesStore();
  return JSON.stringify(store.all);
}

/**
 * Deserialisiert gespeicherte Typen zurück in den Store.
 */
function deserializeTypes(json: string): void {
  const store = getTypesStore();
  const data: TypeDefinition[] = JSON.parse(json);
  store.setAll(data);
}

/**
 * Serialisiert den Locations-Store für localStorage.
 */
function serializeLocations(): string {
  const store = getLocationsStore();
  return JSON.stringify(store.all);
}

/**
 * Deserialisiert gespeicherte Standorte zurück in den Store.
 */
function deserializeLocations(json: string): void {
  const store = getLocationsStore();
  const data: Location[] = JSON.parse(json);
  store.setAll(data);
}

/**
 * Läd gespeicherte Daten aus localStorage oder seedet Demo-Daten.
 * Wird beim Layout-Mount aufgerufen.
 */
export function initializeStore(): void {
  const assetStore = getAssetStore();
  const typesStore = getTypesStore();
  const locationsStore = getLocationsStore();

  // Bereits initialisiert?
  if (assetStore.all.length > 0) return;

  // Aus localStorage laden
  const hasAssets = loadFromStorage(ASSETS_KEY, deserializeAssets);
  const hasTypes = loadFromStorage(TYPES_KEY, deserializeTypes);
  const hasLocations = loadFromStorage(LOCATIONS_KEY, deserializeLocations);

  // Wenn nichts geladen wurde, Demo-Daten seeden
  if (!hasAssets) seedDemoData();
}

/**
 * Hilfsfunktion: Lädt und deserialisiert aus localStorage.
 * Gibt true zurück, wenn Daten gefunden wurden.
 */
function loadFromStorage(key: string, deserialize: (json: string) => void): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      deserialize(saved);
      return true;
    }
  } catch {
    // Korrupte Daten ignorieren
  }
  return false;
}

/**
 * Speichert ALLE Stores in localStorage (Assets, Typen, Standorte).
 * Rufen nach jeder Mutation auf.
 */
export function persistStore(): void {
  try {
    localStorage.setItem(ASSETS_KEY, serializeAssets());
    localStorage.setItem(TYPES_KEY, serializeTypes());
    localStorage.setItem(LOCATIONS_KEY, serializeLocations());
  } catch {
    // Speicher voll — ignorieren
  }
}

function seedDemoData(): void {
  // Demo-Typen
  const typesStore = getTypesStore();
  typesStore.add({
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
  typesStore.add({
    id: 'hdmi-kabel',
    name: 'HDMI-Kabel',
    extends: '_base',
    kategorie: 'kabel',
    fields: [
      { nr: 0, name: 'hersteller', art: 'text', optionen: null, pflicht: false, sensitiv: false },
      { nr: 1, name: 'modell', art: 'text', optionen: null, pflicht: false, sensitiv: false },
      { nr: 2, name: 'länge', art: 'text', optionen: null, pflicht: false, sensitiv: false }
    ],
    blocks: []
  });

  // Demo-Standorte
  const locationsStore = getLocationsStore();
  locationsStore.add({ id: 'serverraum', name: 'Serverraum' });
  locationsStore.add({ id: 'raum-101', name: 'Raum 101', eltern: 'serverraum' });
  locationsStore.add({ id: 'raum-102', name: 'Raum 102', eltern: 'serverraum' });

  // Demo-Assets
  const assetStore = getAssetStore();
  assetStore.createAsset({
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

  assetStore.createAsset({
    type: 'hdmi-kabel',
    location: 'raum-101',
    fields: {
      hersteller: 'Belkin',
      modell: 'AVC017htb',
      länge: '2m'
    }
  });

  assetStore.createAsset({
    type: 'projektor',
    location: 'raum-102',
    fields: {
      hersteller: 'Epson',
      modell: 'EB-2265U',
      seriennummer: 'EP5678',
      inventarnummer: 'DEV-2024-0043',
      zustand: 'einwandfrei'
    }
  });

  persistStore();
}

