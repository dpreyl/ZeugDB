import { getAssetStore, type SerializedAsset } from '../stores/assets.store.svelte';
import { getTypesStore } from '../stores/types.store.svelte';
import { getComponentsStore } from '../stores/components.store.svelte';
import { getLocationsStore } from '../stores/locations.store.svelte';
import type { AssetRow } from '../db';
import type { TypeDefinition } from '../parser/types';
import type { Location } from '../parser/types';
import { serializeAsset } from '../parser/asset.writer';
import type { ParsedAsset } from '../parser/types';

const ASSETS_KEY = 'zeugdb:assets';
const TYPES_KEY = 'zeugdb:types';
const COMPONENTS_KEY = 'zeugdb:components';
const LOCATIONS_KEY = 'zeugdb:locations';
const initializedStores = new WeakSet<object>();
const LEGACY_DEMO_TYPES: TypeDefinition[] = [
  {
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
  },
  {
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
  }
];
const LEGACY_DEMO_ASSETS = [
  {
    type: 'projektor',
    location: 'raum-101',
    fields: {
      hersteller: 'Sony',
      modell: 'VPL-FHZ50',
      seriennummer: 'S123456789',
      inventarnummer: 'DEV-2024-0042',
      zustand: 'einwandfrei'
    }
  },
  {
    type: 'hdmi-kabel',
    location: 'raum-101',
    fields: { hersteller: 'Belkin', modell: 'AVC017htb', länge: '2m' }
  },
  {
    type: 'projektor',
    location: 'raum-102',
    fields: {
      hersteller: 'Epson',
      modell: 'EB-2265U',
      seriennummer: 'EP5678',
      inventarnummer: 'DEV-2024-0043',
      zustand: 'einwandfrei'
    }
  }
];

/**
 * Serialisiert den Asset-Store für localStorage.
 */
function serializeAssets(): string {
  const store = getAssetStore();
  const data = store.all.map(row => ({
    row,
    fields: store.getFields(row.id),
    blocks: store.getBlocks(row.id)
  }));
  return JSON.stringify(data);
}

/**
 * Deserialisiert gespeicherte Assets zurück in den Store.
 */
function deserializeAssets(json: string): void {
  const store = getAssetStore();
  const data: {
    row: AssetRow;
    fields: Record<string, string>;
    blocks?: ReturnType<typeof store.getBlocks>;
  }[] = JSON.parse(json);

  store.setAll(data.map(d => d.row));
  for (const { row, fields, blocks } of data) {
    if (Object.keys(fields).length > 0) {
      store.setFields(row.id, fields);
    }
    if (blocks) store.setBlocks(row.id, blocks);
  }
}

/**
 * Serialisiert den Types-Store für localStorage.
 */
function serializeTypes(): string {
  const store = getTypesStore();
  return JSON.stringify(store.all);
}

function serializeComponents(): string {
  return JSON.stringify(getComponentsStore().all);
}

/**
 * Deserialisiert gespeicherte Typen zurück in den Store.
 */
function deserializeTypes(json: string): void {
  const store = getTypesStore();
  const data: TypeDefinition[] = JSON.parse(json);
  store.setAll(data);
}

function deserializeComponents(json: string): void {
  getComponentsStore().setAll(JSON.parse(json));
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
 * Lädt gespeicherte Daten aus localStorage.
 * Wird beim Layout-Mount aufgerufen.
 */
export function initializeStore(): void {
  if (typeof window === 'undefined') return;

  const assetStore = getAssetStore();
  const typesStore = getTypesStore();
  const componentsStore = getComponentsStore();
  const locationsStore = getLocationsStore();

  if (initializedStores.has(assetStore)) return;
  initializedStores.add(assetStore);
  if (assetStore.all.length > 0) return;

  // Aus localStorage laden
  loadFromStorage(ASSETS_KEY, deserializeAssets);
  loadFromStorage(TYPES_KEY, deserializeTypes);
  const hasComponents = loadFromStorage(COMPONENTS_KEY, deserializeComponents);
  loadFromStorage(LOCATIONS_KEY, deserializeLocations);
  const removedDemoAssets = removeLegacyDemoAssets(assetStore);
  const removedDemoTypes = removeLegacyDemoTypes(assetStore, typesStore);
  const removedDemoLocations = removeLegacyDemoLocations(assetStore, locationsStore);
  if (removedDemoTypes || removedDemoAssets || removedDemoLocations) persistStore();
  if (!hasComponents) componentsStore.clear();
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

function removeLegacyDemoTypes(
  assets: ReturnType<typeof getAssetStore>,
  types: ReturnType<typeof getTypesStore>
): boolean {
  let removed = false;
  for (const demo of LEGACY_DEMO_TYPES) {
    const type = types.findById(demo.id);
    if (
      !type ||
      assets.all.some(asset => asset.type === demo.id) ||
      Object.keys(type).sort().join(',') !== Object.keys(demo).sort().join(',') ||
      type.name !== demo.name ||
      type.extends !== demo.extends ||
      type.kategorie !== demo.kategorie ||
      JSON.stringify(type.fields) !== JSON.stringify(demo.fields) ||
      JSON.stringify(type.blocks) !== JSON.stringify(demo.blocks)
    ) {
      continue;
    }
    removed = types.remove(demo.id) || removed;
  }
  return removed;
}

function removeLegacyDemoAssets(store: ReturnType<typeof getAssetStore>): boolean {
  let removed = false;
  for (const row of [...store.all]) {
    const fields = store.getFields(row.id);
    const isLegacyDemo = LEGACY_DEMO_ASSETS.some(demo =>
      row.type === demo.type &&
      row.location === demo.location &&
      Object.keys(fields).length === Object.keys(demo.fields).length &&
      Object.entries(demo.fields).every(([name, value]) => fields[name] === value)
    );
    if (isLegacyDemo) {
      store.remove(row.id);
      removed = true;
    }
  }
  return removed;
}

function removeLegacyDemoLocations(
  assets: ReturnType<typeof getAssetStore>,
  locations: ReturnType<typeof getLocationsStore>
): boolean {
  const legacyRooms = [
    { id: 'raum-101', name: 'Raum 101', eltern: 'serverraum' },
    { id: 'raum-102', name: 'Raum 102', eltern: 'serverraum' }
  ];
  let removed = false;

  for (const room of legacyRooms) {
    const location = locations.findById(room.id);
    if (
      !location ||
      location.name !== room.name ||
      location.eltern !== room.eltern ||
      Object.keys(location).sort().join(',') !== 'eltern,id,name' ||
      locations.getChildren(room.id).length > 0 ||
      assets.all.some(asset => asset.location === room.id)
    ) {
      continue;
    }
    removed = locations.remove(room.id) || removed;
  }

  const serverRoom = locations.findById('serverraum');
  if (
    serverRoom?.name === 'Serverraum' &&
    Object.keys(serverRoom).sort().join(',') === 'id,name' &&
    locations.getChildren('serverraum').length === 0 &&
    !assets.all.some(asset => asset.location === 'serverraum')
  ) {
    removed = locations.remove('serverraum') || removed;
  }
  return removed;
}

/**
 * Speichert ALLE Stores in localStorage (Assets, Typen, Standorte).
 * Rufen nach jeder Mutation auf.
 */
export function persistStore(): void {
  try {
    localStorage.setItem(ASSETS_KEY, serializeAssets());
    localStorage.setItem(TYPES_KEY, serializeTypes());
    localStorage.setItem(COMPONENTS_KEY, serializeComponents());
    localStorage.setItem(LOCATIONS_KEY, serializeLocations());
  } catch {
    // Speicher voll — ignorieren
  }
}

/**
 * Serialisiert ein Asset aus dem Store-Format in das `.asset`-Dateiformat.
 * Wird für Git-Commits verwendet.
 */
export function serializeAssetFile(asset: SerializedAsset): string {
  const direct: Record<string, string> = {
    id: asset.id,
    type: asset.type,
    ...(asset.location && { location: asset.location }),
    ...(asset.erstellt && { erstellt: asset.erstellt }),
    ...(asset.geaendert && { geaendert: asset.geaendert })
  };
  const metadata = new Set(['id', 'type', 'location', 'erstellt', 'geaendert']);
  for (const [key, value] of Object.entries(asset)) {
    if (!metadata.has(key) && key !== 'blocks' && typeof value === 'string' && value) direct[key] = value;
  }

  const parsed: ParsedAsset = { direct, blocks: asset.blocks ?? {} };
  return serializeAsset(parsed);
}

