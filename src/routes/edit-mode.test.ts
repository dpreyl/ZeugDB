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
      fieldsVersion: 0,
      findFull: vi.fn(),
      getField: vi.fn(() => undefined),
      getFields: vi.fn((_id: string): Record<string, string> => ({})),
      setFields: vi.fn(),
      updateAsset: vi.fn(),
      remove: vi.fn(),
      createAsset: vi.fn(() => 'asset-new'),
      reserveAssetId: vi.fn(() => 'asset-draft')
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
    fotoStore: {
      fehle: true,
      uploadFoto: vi.fn().mockResolvedValue('fotos/asset-1/photo-0.png'),
      ladeFoto: vi.fn(),
      loescheFoto: vi.fn()
    },
    formDraftFiles: {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue({}),
      clear: vi.fn().mockResolvedValue(undefined)
    },
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
vi.mock('$lib/services/foto-init', () => ({ initFotoService: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/services/form-draft-files', () => ({ formDraftFiles: mocks.formDraftFiles }));
vi.mock('$lib/stores/fotos.store.svelte', () => ({
  getFotoStore: () => mocks.fotoStore
}));
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
  localStorage.clear();
  sessionStorage.removeItem('zeugdb:edit-session');
  vi.clearAllMocks();
  mocks.locations.all = [{ id: 'raum-1', name: 'Raum 1', art: 'punkt', lat: 52, lon: 13 }];
  mocks.assets.all = [];
  mocks.assets.getFields.mockReset().mockReturnValue({});
  mocks.assets.setFields.mockReset();
  mocks.assets.reserveAssetId.mockReset().mockReturnValue('asset-draft');
  mocks.fotoStore.fehle = true;
  mocks.fotoStore.uploadFoto.mockReset().mockResolvedValue('fotos/asset-1/photo-0.png');
  mocks.formDraftFiles.save.mockReset().mockResolvedValue(undefined);
  mocks.formDraftFiles.load.mockReset().mockResolvedValue({});
  mocks.formDraftFiles.clear.mockReset().mockResolvedValue(undefined);
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
    expect((screen.getByLabelText('Standort-ID') as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByLabelText('Name').matches(':disabled')).toBe(false);
  });

  it('erlaubt das Anlegen von Standorten erst im aktivierten Schreibmodus', async () => {
    enterEditMode();
    render(LocationsPage);

    await fireEvent.click(screen.getByRole('button', { name: /Raum 1/ }));
    await fireEvent.click(screen.getByRole('button', { name: '+ Neuer Standort' }));
    expect(screen.getByLabelText('Standort-ID')).toBeTruthy();
    expect((screen.getByLabelText('Standort-ID') as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText('Standort-ID') as HTMLInputElement).value).toBe('');
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
    expect(screen.queryByLabelText('Typenschild-Foto hochladen')).toBeNull();
    expect(screen.queryByLabelText('Übersichtsbild hochladen')).toBeNull();
    await fireEvent.submit(screen.getByRole('heading', { name: 'Asset asset-1' }).closest('form')!);
    expect(mocks.assets.updateAsset).not.toHaveBeenCalled();
  });

  it('offers separate nameplate and overview photo uploads in edit mode', () => {
    enterEditMode();
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-1',
          type: 'projektor',
          bezeichnung: 'Projektor Saal 1',
          hersteller: '',
          modell: '',
          seriennummer: '',
          inventarnummer: '',
          zustand: 'einwandfrei',
          notizen: '',
          blocks: {},
          location: null,
          erstellt: null,
          geaendert: null
        }
      }
    });

    expect(screen.getByLabelText('Typenschild-Foto hochladen')).toBeTruthy();
    expect(screen.getByLabelText('Übersichtsbild hochladen')).toBeTruthy();
    expect(screen.getByText(/Git-LFS-Repository/)).toBeTruthy();
  });

  it('stores the uploaded path under the selected photo role', async () => {
    enterEditMode();
    mocks.fotoStore.fehle = false;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:photo'),
      revokeObjectURL: vi.fn()
    });
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-1',
          type: 'projektor',
          bezeichnung: 'Projektor Saal 1',
          hersteller: '',
          modell: '',
          seriennummer: '',
          inventarnummer: '',
          zustand: 'einwandfrei',
          notizen: '',
          blocks: {},
          location: null,
          erstellt: null,
          geaendert: null
        }
      }
    });

    const image = new File(['image'], 'label.png', { type: 'image/png' });
    Object.defineProperty(image, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(5))
    });
    await fireEvent.change(screen.getByLabelText('Typenschild-Foto hochladen'), {
      target: { files: [image] }
    });

    await waitFor(() => {
      expect(mocks.assets.setFields).toHaveBeenCalledWith(
        'asset-1',
        expect.objectContaining({
          fotos: 'fotos/asset-1/photo-0.png',
          foto_typenschild: 'fotos/asset-1/photo-0.png'
        })
      );
    });
  });

  it('öffnet auf Mobilgeräten die rückseitige Kamera für Foto-Uploads', () => {
    enterEditMode();
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-camera-test',
          type: 'projektor',
          bezeichnung: 'Kamera-Test',
          hersteller: '',
          modell: '',
          seriennummer: '',
          inventarnummer: '',
          zustand: '',
          notizen: '',
          location: null,
          erstellt: null,
          geaendert: null
        }
      }
    });

    for (const label of ['Typenschild-Foto hochladen', 'Übersichtsbild hochladen']) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.type).toBe('file');
      expect(input.accept).toContain('image/jpeg');
      expect(input.getAttribute('capture')).toBe('environment');
    }
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
    await fireEvent.input(screen.getByLabelText('Bezeichnung'), { target: { value: 'Projektor Saal 1' } });
    await fireEvent.input(screen.getByLabelText(/Lichtstärke/), { target: { value: '5000' } });
    await fireEvent.change(screen.getByLabelText('Auflösung'), { target: { value: '4K' } });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);

    expect(mocks.assets.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      type: 'projektor',
      fields: { bezeichnung: 'Projektor Saal 1', 'Lichtstärke': '5000', 'Auflösung': '4K' }
    }));
    await waitFor(() => expect(mocks.goto).toHaveBeenCalledWith(expect.stringMatching(/\/$/)));
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

    await fireEvent.input(screen.getByLabelText('Bezeichnung'), { target: { value: 'Projektor im Saal' } });
    const cableSelect = screen.getByLabelText('kabel') as HTMLSelectElement;
    expect([...cableSelect.options].map(option => option.value)).toContain('cable-1');
    expect([...cableSelect.options].map(option => option.value)).not.toContain('projector-1');
    await fireEvent.change(cableSelect, { target: { value: 'cable-1' } });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);

    expect(mocks.assets.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      type: 'projektor',
      fields: { bezeichnung: 'Projektor im Saal' },
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
          bezeichnung: 'Projektor im Saal',
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
    expect((screen.getByLabelText('Bezeichnung') as HTMLInputElement).value).toBe('Projektor im Saal');
    await fireEvent.input(screen.getByLabelText('Bezeichnung'), { target: { value: 'Projektor Saal 2' } });
    await fireEvent.input(input, { target: { value: '5500' } });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Asset asset-1' }).closest('form')!);

    expect(mocks.assets.updateAsset).toHaveBeenCalledWith('asset-1', expect.objectContaining({
      fields: expect.objectContaining({ bezeichnung: 'Projektor Saal 2', 'Lichtstärke': '5500' })
    }));
    expect(mocks.goto).toHaveBeenCalledWith(expect.stringMatching(/\/$/));
  });

  it('löscht ein Asset im Schreibmodus und kehrt zur Übersicht zurück', async () => {
    enterEditMode();
    mocks.assets.remove.mockReturnValue(true);
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-to-delete',
          type: 'projektor',
          bezeichnung: 'Projektor Saal 1',
          hersteller: '',
          modell: '',
          seriennummer: '',
          inventarnummer: '',
          zustand: '',
          notizen: '',
          location: null,
          erstellt: null,
          geaendert: null
        }
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(mocks.assets.remove).toHaveBeenCalledWith('asset-to-delete');
    expect(mocks.persistStore).toHaveBeenCalled();
    expect(mocks.goto).toHaveBeenCalledWith(expect.stringMatching(/\/$/));
    confirmMock.mockRestore();
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

  it('zeigt Komponentenfelder separat und lässt Typen nur auf Komponenten verweisen', async () => {
    enterEditMode();
    mocks.components.all = [{
      id: 'lampen',
      name: 'Lampe',
      fields: [{ nr: 0, name: 'Leuchtmittel', art: 'text', optionen: null, pflicht: false, sensitiv: false }]
    }];
    render(TypesPage);

    expect(screen.getByText('Leuchtmittel')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Typ bearbeiten: Projektor' }));

    const componentSelect = screen.getByLabelText('Baustein-Komponente') as HTMLSelectElement;
    expect(componentSelect.value).toBe('lampen');
    expect(screen.queryByText('Felder für Lampe')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Komponentenfeld' })).toBeNull();
  });
});
