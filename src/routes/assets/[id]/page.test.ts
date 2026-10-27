import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEditMode, resetEditMode } from '$lib/stores/edit-mode.svelte';

const mocks = vi.hoisted(() => ({
  assets: {
    all: [],
    fieldsVersion: 0,
    getField: vi.fn(() => undefined),
    getFields: vi.fn(() => ({})),
    setFields: vi.fn(),
    updateAsset: vi.fn(() => true),
    remove: vi.fn(() => true)
  },
  types: {
    all: [{
      id: 'kamera',
      fields: [{ nr: 0, name: 'Typenschild', art: 'image', optionen: null, pflicht: false, sensitiv: false }],
      blocks: []
    }]
  },
  components: { all: [] },
  locations: { all: [] },
  fotos: {
    fehle: false,
    uploadFoto: vi.fn().mockResolvedValue('fotos/asset-1/photo-0.png'),
    ladeFoto: vi.fn().mockRejectedValue(new Error('not found')),
    loescheFoto: vi.fn()
  },
  persistStore: vi.fn(),
  goto: vi.fn()
}));

vi.mock('$lib/stores/assets.store.svelte', () => ({ getAssetStore: () => mocks.assets }));
vi.mock('$lib/stores/types.store.svelte', () => ({ getTypesStore: () => mocks.types }));
vi.mock('$lib/stores/components.store.svelte', () => ({ getComponentsStore: () => mocks.components }));
vi.mock('$lib/stores/locations.store.svelte', () => ({ getLocationsStore: () => mocks.locations }));
vi.mock('$lib/stores/fotos.store.svelte', () => ({ getFotoStore: () => mocks.fotos }));
vi.mock('$lib/services/foto-init', () => ({ initFotoService: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/services/init', () => ({ persistStore: mocks.persistStore }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

import AssetPage from './+page.svelte';

beforeEach(() => {
  resetEditMode();
  sessionStorage.removeItem('zeugdb:edit-session');
  localStorage.clear();
  vi.clearAllMocks();
  getEditMode().enterEditMode('test-user', 'test-user@example.test');
  mocks.assets.getField.mockReturnValue(undefined);
  mocks.assets.getFields.mockReturnValue({});
  mocks.assets.updateAsset.mockReturnValue(true);
  mocks.fotos.fehle = false;
  mocks.fotos.uploadFoto.mockResolvedValue('fotos/asset-1/photo-0.png');
  mocks.fotos.ladeFoto.mockRejectedValue(new Error('not found'));
  mocks.types.all = [{
    id: 'kamera',
    fields: [{ nr: 0, name: 'Typenschild', art: 'image', optionen: null, pflicht: false, sensitiv: false }],
    blocks: []
  }];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Bildfelder im Asset-Detail', () => {
  it('stellt ungespeicherte Asset-Änderungen nach dem erneuten Öffnen wieder her', async () => {
    const data = {
      id: 'asset-1',
      type: 'kamera',
      bezeichnung: 'Kamera Eingang',
      Typenschild: '',
      hersteller: '',
      modell: '',
      seriennummer: '',
      inventarnummer: '',
      zustand: '',
      notizen: '',
      fotos: '',
      blocks: {},
      location: null,
      erstellt: null,
      geaendert: null
    };

    render(AssetPage, { props: { data } });
    await fireEvent.input(screen.getByLabelText('Bezeichnung'), {
      target: { value: 'Kamera Werkstatt' }
    });
    await waitFor(() => expect(localStorage.getItem('zeugdb:form-draft:asset:edit:asset-1')).not.toBeNull());

    cleanup();
    render(AssetPage, { props: { data } });

    await waitFor(() =>
      expect((screen.getByLabelText('Bezeichnung') as HTMLInputElement).value).toBe('Kamera Werkstatt')
    );
    await fireEvent.submit(screen.getByLabelText('Bezeichnung').closest('form')!);
    expect(localStorage.getItem('zeugdb:form-draft:asset:edit:asset-1')).toBeNull();
  });

  it('bietet bei den Gerätefoto-Feldern direkt die Handykamera an', async () => {
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-1',
          type: 'kamera',
          bezeichnung: 'Kamera Eingang',
          Typenschild: '',
          hersteller: '',
          modell: '',
          seriennummer: '',
          inventarnummer: '',
          zustand: '',
          notizen: '',
          fotos: '',
          blocks: {},
          location: null,
          erstellt: null,
          geaendert: null
        }
      }
    });

    expect(screen.getByLabelText('Typenschild-Foto hochladen').getAttribute('capture')).toBe('environment');
    expect(screen.getByLabelText('Übersichtsbild hochladen').getAttribute('capture')).toBe('environment');
  });

  it('lädt ein Bildfeld zu Git LFS hoch und speichert den Bildpfad als Asset-Feld', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn()
    });
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-1',
          type: 'kamera',
          bezeichnung: 'Kamera Eingang',
          Typenschild: '',
          hersteller: '',
          modell: '',
          seriennummer: '',
          inventarnummer: '',
          zustand: '',
          notizen: '',
          fotos: '',
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
    await fireEvent.change(screen.getByLabelText('Bild für Typenschild'), {
      target: { files: [image] }
    });

    await waitFor(() => expect(mocks.assets.setFields).toHaveBeenCalledWith(
      'asset-1',
      expect.objectContaining({
        Typenschild: 'fotos/asset-1/photo-0.png',
        fotos: 'fotos/asset-1/photo-0.png'
      })
    ));
    expect(mocks.fotos.uploadFoto).toHaveBeenCalledWith('asset-1', expect.any(Uint8Array), 'image/png');
  });

  it('fügt mehrere ausgewählte Bilder einem Mehrfach-Bilderfeld hinzu', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn()
    });
    mocks.types.all = [{
      id: 'geraet',
      fields: [{ nr: 0, name: 'Mängelfotos', art: 'images', optionen: null, pflicht: false, sensitiv: false }],
      blocks: []
    }];
    mocks.fotos.uploadFoto
      .mockResolvedValueOnce('fotos/asset-1/photo-0.jpg')
      .mockResolvedValueOnce('fotos/asset-1/photo-1.jpg');
    render(AssetPage, {
      props: {
        data: {
          id: 'asset-1',
          type: 'geraet',
          bezeichnung: 'Gerät mit Mangel',
          'Mängelfotos': '',
          hersteller: '',
          modell: '',
          seriennummer: '',
          inventarnummer: '',
          zustand: '',
          notizen: '',
          fotos: '',
          blocks: {},
          location: null,
          erstellt: null,
          geaendert: null
        }
      }
    });

    const files = [
      new File(['front'], 'mangel-vorne.jpg', { type: 'image/jpeg' }),
      new File(['rear'], 'mangel-hinten.jpg', { type: 'image/jpeg' })
    ];
    files.forEach((file, index) => Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new Uint8Array([index]).buffer)
    }));
    await fireEvent.change(screen.getByLabelText('Bilder für Mängelfotos'), {
      target: { files }
    });

    await waitFor(() => expect(mocks.assets.setFields).toHaveBeenCalledWith(
      'asset-1',
      expect.objectContaining({
        'Mängelfotos': JSON.stringify([
          'fotos/asset-1/photo-0.jpg',
          'fotos/asset-1/photo-1.jpg'
        ]),
        fotos: 'fotos/asset-1/photo-0.jpg,fotos/asset-1/photo-1.jpg'
      })
    ));
    expect(mocks.fotos.uploadFoto).toHaveBeenCalledTimes(2);
  });
});
