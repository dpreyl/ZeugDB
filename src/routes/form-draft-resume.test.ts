import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEditMode, resetEditMode } from '$lib/stores/edit-mode.svelte';
import { writeFormDraft } from '$lib/services/form-drafts';
import type { TypeDefinition } from '$lib/parser/types';

const mocks = vi.hoisted(() => {
  const layer = { addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis() };
  const map = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    on: vi.fn().mockReturnThis(),
    getCenter: vi.fn(() => ({ lat: 0, lng: 0 })),
    getZoom: vi.fn(() => 2),
    remove: vi.fn()
  };
  map.setView.mockReturnValue(map);
  const leaflet = {
    map: vi.fn(() => map),
    tileLayer: vi.fn(() => layer),
    layerGroup: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn() })),
    polygon: vi.fn(() => layer),
    polyline: vi.fn(() => layer),
    circleMarker: vi.fn(() => layer)
  };
  return {
    locations: { all: [], add: vi.fn(), remove: vi.fn() },
    assets: { all: [], findFull: vi.fn() },
    types: {
      all: [{ id: 'projektor', name: 'Projektor', fields: [], blocks: [] }] as TypeDefinition[],
      add: vi.fn(),
      remove: vi.fn()
    },
    components: { all: [] },
    persistStore: vi.fn(),
    leaflet
  };
});

vi.mock('$lib/stores/locations.store.svelte', () => ({ getLocationsStore: () => mocks.locations }));
vi.mock('$lib/stores/assets.store.svelte', () => ({ getAssetStore: () => mocks.assets }));
vi.mock('$lib/stores/types.store.svelte', () => ({ getTypesStore: () => mocks.types }));
vi.mock('$lib/stores/components.store.svelte', () => ({ getComponentsStore: () => mocks.components }));
vi.mock('$lib/services/init', () => ({ persistStore: mocks.persistStore }));
vi.mock('leaflet', () => ({ default: mocks.leaflet }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import LocationsPage from './locations/+page.svelte';
import TypesPage from './types/+page.svelte';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  resetEditMode();
  sessionStorage.removeItem('zeugdb:edit-session');
  vi.clearAllMocks();
  mocks.locations.all = [];
  mocks.assets.all = [];
  mocks.types.all = [{ id: 'projektor', name: 'Projektor', fields: [], blocks: [] }];
});

afterEach(cleanup);

describe('Wiederherstellung aktiver Formulare', () => {
  it('öffnet nach einem Reload einen ungespeicherten Standortentwurf wieder', async () => {
    writeFormDraft('location:active', { locationId: null });
    writeFormDraft('location:new', {
      art: 'punkt',
      name: 'Werkstatt',
      parentId: '',
      coordinates: [{ lat: '52.1', lon: '13.4' }]
    });
    getEditMode().enterEditMode('test-user', 'test-user@example.test');

    render(LocationsPage);

    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Werkstatt'));
    expect((screen.getByLabelText('Standort-ID') as HTMLInputElement).value).toBe('werkstatt');
    expect((screen.getByLabelText('Breitengrad 1') as HTMLInputElement).value).toBe('52.1');
  });

  it('öffnet nach einem Reload einen ungespeicherten Typentwurf wieder', async () => {
    writeFormDraft('type:active', { typeId: null });
    writeFormDraft('type:new', {
      name: 'Projektor Entwurf',
      extendsId: '',
      kategorie: '',
      icon: '',
      fields: [],
      blocks: []
    });
    getEditMode().enterEditMode('test-user', 'test-user@example.test');

    render(TypesPage);

    await waitFor(() =>
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Projektor Entwurf')
    );
  });
});
