import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEditMode, resetEditMode } from '$lib/stores/edit-mode.svelte';
import type { AssetRow } from '$lib/db';
import type { ComponentDefinition, TypeDefinition } from '$lib/parser/types';

const mocks = vi.hoisted(() => {
  const overlay = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis()
  };
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
      all: [] as AssetRow[],
      findFull: vi.fn(),
      getFields: vi.fn((_id: string): Record<string, string> => ({})),
      updateAsset: vi.fn(),
      remove: vi.fn(),
      createAsset: vi.fn(() => 'asset-new')
    },
    types: {
      all: [{
        id: 'projektor',
        name: 'Projektor',
        kategorie: 'Video',
        fields: [
          { nr: 0, name: 'hersteller', art: 'text', optionen: null, pflicht: false, sensitiv: false },
          { nr: 1, name: 'modell', art: 'text', optionen: null, pflicht: false, sensitiv: false },
          { nr: 2, name: 'seriennummer', art: 'text', optionen: null, pflicht: true, sensitiv: false },
          { nr: 3, name: 'inventarnummer', art: 'text', optionen: null, pflicht: false, sensitiv: false },
          { nr: 4, name: 'zustand', art: 'dropdown', optionen: 'neu|einwandfrei|defekt', pflicht: false, sensitiv: false }
        ],
        blocks: [{ compId: 'lampen', min: 0, max: 2 }]
      }] as TypeDefinition[],
      add: vi.fn(),
      remove: vi.fn()
    },
    components: { all: [] as ComponentDefinition[] },
    persistStore: vi.fn(),
    goto: vi.fn(),
    leaflet,
    map
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
vi.mock('$lib/stores/components.store.svelte', () => ({
  getComponentsStore: () => mocks.components
}));
vi.mock('$lib/services/init', () => ({ persistStore: mocks.persistStore }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
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
  sessionStorage.removeItem('zeugdb:edit-session');
  vi.clearAllMocks();
  mocks.locations.all = [{ id: 'raum-1', name: 'Raum 1', art: 'punkt', lat: 52, lon: 13 }];
  mocks.assets.all = [];
  mocks.assets.getFields.mockReset().mockReturnValue({});
  mocks.components.all = [];
  mocks.types.all = [{
    id: 'projektor',
    name: 'Projektor',
    kategorie: 'Video',
    fields: [
      { nr: 0, name: 'hersteller', art: 'text', optionen: null, pflicht: false, sensitiv: false },
      { nr: 1, name: 'modell', art: 'text', optionen: null, pflicht: false, sensitiv: false },
      { nr: 2, name: 'seriennummer', art: 'text', optionen: null, pflicht: true, sensitiv: false },
      { nr: 3, name: 'inventarnummer', art: 'text', optionen: null, pflicht: false, sensitiv: false },
      { nr: 4, name: 'zustand', art: 'dropdown', optionen: 'neu|einwandfrei|defekt', pflicht: false, sensitiv: false }
    ],
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

    expect(screen.getByLabelText(/hersteller/i).matches(':disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Erzeugen' })).toBeNull();
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);
    expect(mocks.assets.createAsset).not.toHaveBeenCalled();
  });

  it('zeigt und speichert benutzerdefinierte Felder aus dem gewählten Asset-Typ', async () => {
    enterEditMode();
    mocks.types.all = [{
      id: 'projektor',
      name: 'Projektor',
      kategorie: 'Video',
      fields: [
        { nr: 0, name: 'Lichtstärke', art: 'number', optionen: null, pflicht: true, sensitiv: false },
        { nr: 1, name: 'Auflösung', art: 'dropdown', optionen: '1080p|4K', pflicht: false, sensitiv: false }
      ],
      blocks: [{ compId: 'lampen', min: 0, max: 2 }]
    }];
    render(NewAssetPage);

    expect(screen.getByLabelText(/Lichtstärke/)).toBeTruthy();
    await fireEvent.input(screen.getByLabelText(/Lichtstärke/), { target: { value: '5000' } });
    await fireEvent.change(screen.getByLabelText('Auflösung'), { target: { value: '4K' } });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);

    expect(mocks.assets.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      type: 'projektor',
      fields: { 'Lichtstärke': '5000', 'Auflösung': '4K' }
    }));
  });

  it('zeigt definierte Portfelder und kompatible Geräte beim Anlegen eines Assets', async () => {
    enterEditMode();
    mocks.types.all = [{
      id: 'projektor',
      fields: [],
      blocks: [{ compId: 'port', min: 1, max: 4 }]
    }];
    mocks.components.all = [{
      id: 'port',
      name: 'Port',
      fields: [{
        nr: 0,
        name: 'kabel',
        art: 'asset_ref',
        optionen: 'kabel',
        pflicht: false,
        sensitiv: false
      }]
    }];
    mocks.assets.all = [
      { id: 'cable-1', type: 'hdmi-kabel', location: null, erstellt: null, geaendert: null },
      { id: 'projector-1', type: 'projektor', location: null, erstellt: null, geaendert: null }
    ];
    mocks.assets.getFields.mockImplementation((id: string): Record<string, string> =>
      id === 'cable-1' ? { hersteller: 'Belkin', modell: 'HDMI' } : {}
    );
    mocks.types.all.push({
      id: 'kabel',
      fields: [],
      blocks: []
    });
    mocks.types.all.push({
      id: 'hdmi-kabel',
      extends: 'kabel',
      fields: [],
      blocks: []
    });
    render(NewAssetPage);

    const cableSelect = screen.getByLabelText('kabel') as HTMLSelectElement;
    expect([...cableSelect.options].map(option => option.value)).toContain('cable-1');
    expect([...cableSelect.options].map(option => option.value)).not.toContain('projector-1');
    await fireEvent.change(cableSelect, { target: { value: 'cable-1' } });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);

    expect(mocks.assets.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      type: 'projektor',
      blocks: { port: { '0': { kabel: 'cable-1' } } }
    }));
  });

  it('zeigt definierte Typfelder in der Asset-Ansicht und speichert Änderungen', async () => {
    enterEditMode();
    mocks.types.all = [{
      id: 'projektor',
      name: 'Projektor',
      kategorie: 'Video',
      fields: [{ nr: 0, name: 'Lichtstärke', art: 'number', optionen: null, pflicht: true, sensitiv: false }],
      blocks: [{ compId: 'lampen', min: 0, max: 2 }]
    }];
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-1',
          type: 'projektor',
          hersteller: '',
          modell: '',
          seriennummer: '',
          inventarnummer: '',
          zustand: '',
          notizen: '',
          'Lichtstärke': '5000',
          location: null,
          erstellt: null,
          geaendert: null
        }
      }
    });

    const input = screen.getByLabelText(/Lichtstärke/) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('5000'));
    await fireEvent.input(input, { target: { value: '5500' } });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Asset asset-1' }).closest('form')!);

    expect(mocks.assets.updateAsset).toHaveBeenCalledWith('asset-1', expect.objectContaining({
      fields: expect.objectContaining({ 'Lichtstärke': '5500' })
    }));
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
