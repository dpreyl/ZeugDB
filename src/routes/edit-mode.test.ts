import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEditMode, resetEditMode } from '$lib/stores/edit-mode.svelte';

const mocks = vi.hoisted(() => {
  const overlay = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis()
  };
  const leaflet = {
    map: vi.fn(() => ({
      setView: vi.fn().mockReturnThis(),
      fitBounds: vi.fn(),
      remove: vi.fn()
    })),
    tileLayer: vi.fn(() => overlay),
    layerGroup: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn() })),
    polygon: vi.fn(() => overlay),
    polyline: vi.fn(() => overlay),
    circleMarker: vi.fn(() => overlay)
  };
  return {
    locations: {
      all: [{ id: 'raum-1', name: 'Raum 1', art: 'punkt', lat: 52, lon: 13 }],
      add: vi.fn(),
      remove: vi.fn()
    },
    assets: {
      all: [],
      findFull: vi.fn(),
      updateAsset: vi.fn(),
      remove: vi.fn(),
      createAsset: vi.fn(() => 'asset-new')
    },
    types: {
      all: [{
        id: 'projektor',
        name: 'Projektor',
        kategorie: 'Video',
        fields: [{ nr: 1, name: 'seriennummer', art: 'text', optionen: null, pflicht: true, sensitiv: false }],
        blocks: [{ compId: 'lampen', min: 0, max: 2 }]
      }],
      add: vi.fn(),
      remove: vi.fn()
    },
    persistStore: vi.fn(),
    leaflet
  };
});

vi.mock('$lib/stores/locations.store.svelte', () => ({
  getLocationsStore: () => mocks.locations
}));
vi.mock('$lib/stores/assets.store.svelte', () => ({
  getAssetStore: () => mocks.assets
}));
vi.mock('$lib/stores/types.store.svelte', () => ({
  getTypesStore: () => mocks.types
}));
vi.mock('$lib/services/init', () => ({ persistStore: mocks.persistStore }));
vi.mock('leaflet', () => ({ default: mocks.leaflet }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import AssetPage from './assets/[id]/+page.svelte';
import NewAssetPage from './assets/new/+page.svelte';
import LocationsPage from './locations/+page.svelte';
import TypesPage from './types/+page.svelte';

function enterEditMode() {
  getEditMode().enterEditMode('test-user', 'test-user@example.test');
}

beforeEach(() => {
  resetEditMode();
  vi.clearAllMocks();
  mocks.locations.all = [{ id: 'raum-1', name: 'Raum 1', art: 'punkt', lat: 52, lon: 13 }];
  mocks.assets.all = [];
  mocks.types.all = [{
    id: 'projektor',
    name: 'Projektor',
    kategorie: 'Video',
    fields: [{ nr: 1, name: 'seriennummer', art: 'text', optionen: null, pflicht: true, sensitiv: false }],
    blocks: [{ compId: 'lampen', min: 0, max: 2 }]
  }];
});

afterEach(cleanup);

describe('Schreibmodus in der Oberfläche', () => {
  it('zeigt Standortdetails im Read-Only-Modus, lässt die Felder aber nicht bearbeiten', async () => {
    render(LocationsPage);

    expect(screen.queryByRole('button', { name: '+ Neuer Standort' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: /Raum 1/ }));
    expect(screen.getByRole('region', { name: 'Standortdetails' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Standortdetails' }).textContent).toContain('raum-1');
    expect(screen.queryByLabelText('ID')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
  });

  it('öffnet Standortdetails auch im Schreibmodus zunächst schreibgeschützt', async () => {
    enterEditMode();
    render(LocationsPage);

    await fireEvent.click(screen.getByRole('button', { name: /Raum 1/ }));
    expect(screen.getByRole('region', { name: 'Standortdetails' })).toBeTruthy();
    expect(screen.queryByLabelText('ID')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByLabelText('ID').matches(':disabled')).toBe(true);
    expect(screen.getByLabelText('Name').matches(':disabled')).toBe(false);
  });

  it('erlaubt das Anlegen von Standorten erst im aktivierten Schreibmodus', async () => {
    enterEditMode();
    render(LocationsPage);

    await fireEvent.click(screen.getByRole('button', { name: /Raum 1/ }));
    await fireEvent.click(screen.getByRole('button', { name: '+ Neuer Standort' }));
    expect(screen.getByLabelText('ID')).toBeTruthy();
    expect((screen.getByLabelText('ID') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText('ID') as HTMLInputElement).value).toBe('');
  });

  it('sperrt Asset-Felder und Aktionen im Read-Only-Modus', async () => {
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-1',
          type: 'projektor',
          hersteller: 'Testhersteller',
          modell: 'Testmodell',
          seriennummer: '',
          inventarnummer: '',
          location: null,
          zustand: 'einwandfrei',
          notizen: '',
          erstellt: null,
          geaendert: null
        }
      }
    });

    expect(screen.queryByLabelText('Hersteller')).toBeNull();
    expect(screen.getByText('Testhersteller')).toBeTruthy();
    expect(screen.getByText('Testmodell')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
    await fireEvent.submit(screen.getByRole('heading', { name: 'Asset asset-1' }).closest('form')!);
    expect(mocks.assets.updateAsset).not.toHaveBeenCalled();
  });

  it('verhindert das Erzeugen neuer Assets im Read-Only-Modus', async () => {
    render(NewAssetPage);

    expect(screen.getByLabelText('Hersteller').matches(':disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Erzeugen' })).toBeNull();
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);
    expect(mocks.assets.createAsset).not.toHaveBeenCalled();
  });

  it('zeigt Typ-Verwaltungsaktionen erst im Schreibmodus und Typdetails auf Anfrage', () => {
    render(TypesPage);
    expect(screen.queryByRole('button', { name: '+ Neuer Typ' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
    expect(screen.queryByText('seriennummer')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details ansehen: Projektor' }));
    expect(screen.getByRole('heading', { name: 'Details: Projektor' })).toBeTruthy();
    expect(screen.getByText('seriennummer')).toBeTruthy();
    expect(screen.getByText('lampen')).toBeTruthy();

    cleanup();
    enterEditMode();
    render(TypesPage);
    expect(screen.getByRole('button', { name: '+ Neuer Typ' })).toBeTruthy();
  });
});
