import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEditMode, resetEditMode } from '$lib/stores/edit-mode.svelte';

const mocks = vi.hoisted(() => ({
  assets: {
    all: [],
    reserveAssetId: vi.fn(() => 'asset-draft'),
    createAsset: vi.fn(() => 'asset-draft')
  },
  types: {
    all: [{
      id: 'kamera',
      name: 'Kamera',
      fields: [{ nr: 0, name: 'Typenschild', art: 'image', optionen: null, pflicht: true, sensitiv: false }],
      blocks: []
    }]
  },
  components: { all: [] },
  locations: { all: [] },
  fotos: {
    fehle: false,
    uploadFoto: vi.fn().mockResolvedValue('fotos/asset-draft/photo-0.png')
  },
  draftFiles: {} as Record<string, Record<string, File[]>>,
  persistStore: vi.fn(),
  goto: vi.fn()
}));

vi.mock('$lib/stores/assets.store.svelte', () => ({ getAssetStore: () => mocks.assets }));
vi.mock('$lib/stores/types.store.svelte', () => ({ getTypesStore: () => mocks.types }));
vi.mock('$lib/stores/components.store.svelte', () => ({ getComponentsStore: () => mocks.components }));
vi.mock('$lib/stores/locations.store.svelte', () => ({ getLocationsStore: () => mocks.locations }));
vi.mock('$lib/stores/fotos.store.svelte', () => ({ getFotoStore: () => mocks.fotos }));
vi.mock('$lib/services/foto-init', () => ({ initFotoService: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/services/form-draft-files', () => ({
  formDraftFiles: {
    save: vi.fn(async (key: string, field: string, file: File) => {
      (mocks.draftFiles[key] ??= {})[field] = [file];
    }),
    load: vi.fn(async (key: string) => mocks.draftFiles[key] ?? {}),
    saveMany: vi.fn(async (key: string, field: string, files: File[]) => {
      (mocks.draftFiles[key] ??= {})[field] = files;
    }),
    loadMany: vi.fn(async (key: string) => mocks.draftFiles[key] ?? {}),
    clear: vi.fn(async (key: string, field?: string) => {
      if (!field) delete mocks.draftFiles[key];
      else delete mocks.draftFiles[key]?.[field];
    })
  }
}));
vi.mock('$lib/services/init', () => ({ persistStore: mocks.persistStore }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

import NewAssetPage from './+page.svelte';

function enterEditMode() {
  getEditMode().enterEditMode('test-user', 'test-user@example.test');
}

beforeEach(() => {
  resetEditMode();
  sessionStorage.removeItem('zeugdb:edit-session');
  vi.clearAllMocks();
  localStorage.clear();
  mocks.draftFiles = {};
  mocks.assets.reserveAssetId.mockReturnValue('asset-draft');
  mocks.assets.createAsset.mockReturnValue('asset-draft');
  mocks.fotos.fehle = false;
  mocks.fotos.uploadFoto.mockResolvedValue('fotos/asset-draft/photo-0.png');
  mocks.types.all = [{
    id: 'kamera',
    name: 'Kamera',
    fields: [{ nr: 0, name: 'Typenschild', art: 'image', optionen: null, pflicht: true, sensitiv: false }],
    blocks: []
  }];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Asset-Neuanlage mit Bildfeldern', () => {
  it('stellt Formularfelder und direkt ausgewählte Kamerabilder nach dem Neuladen wieder her', async () => {
    enterEditMode();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn()
    });
    render(NewAssetPage);
    await fireEvent.input(screen.getByLabelText('Bezeichnung'), {
      target: { value: 'Kamera Werkstatt' }
    });
    const image = new File(['photo'], 'kamerabild.png', { type: 'image/png' });
    await fireEvent.change(screen.getByLabelText('Bild für Typenschild'), {
      target: { files: [image] }
    });
    await waitFor(() => expect(mocks.draftFiles['asset:new']?.Typenschild).toEqual([image]));
    await waitFor(() => expect(localStorage.getItem('zeugdb:form-draft:asset:new')).not.toBeNull());

    cleanup();
    render(NewAssetPage);

    await waitFor(() =>
      expect((screen.getByLabelText('Bezeichnung') as HTMLInputElement).value).toBe('Kamera Werkstatt')
    );
    expect((await screen.findByRole('img', { name: 'Typenschild' })).getAttribute('src')).toBe('blob:preview');
  });

  it('lädt ausgewählte Bilder vor dem Erzeugen des Assets über den Foto-Service hoch', async () => {
    enterEditMode();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn()
    });
    render(NewAssetPage);

    const image = new File(['image'], 'label.png', { type: 'image/png' });
    Object.defineProperty(image, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(5))
    });
    await fireEvent.input(screen.getByLabelText('Bezeichnung'), { target: { value: 'Kamera Eingang' } });
    await fireEvent.change(screen.getByLabelText('Bild für Typenschild'), { target: { files: [image] } });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);

    await waitFor(() => expect(mocks.assets.createAsset).toHaveBeenCalled());
    expect(mocks.fotos.uploadFoto).toHaveBeenCalledWith('asset-draft', expect.any(Uint8Array), 'image/png');
    expect(mocks.fotos.uploadFoto.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.assets.createAsset.mock.invocationCallOrder[0]);
    expect(mocks.assets.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      id: 'asset-draft',
      type: 'kamera',
      fields: {
        bezeichnung: 'Kamera Eingang',
        Typenschild: 'fotos/asset-draft/photo-0.png',
        fotos: 'fotos/asset-draft/photo-0.png'
      }
    }));
    expect(localStorage.getItem('zeugdb:form-draft:asset:new')).toBeNull();
    expect(mocks.draftFiles['asset:new']).toBeUndefined();
  });

  it('verhindert die Asset-Anlage, wenn der Upload fehlschlägt', async () => {
    enterEditMode();
    mocks.fotos.uploadFoto.mockRejectedValue(new Error('LFS nicht erreichbar'));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn()
    });
    render(NewAssetPage);

    await fireEvent.input(screen.getByLabelText('Bezeichnung'), { target: { value: 'Kamera Eingang' } });
    const image = new File(['image'], 'label.png', { type: 'image/png' });
    Object.defineProperty(image, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(5))
    });
    await fireEvent.change(screen.getByLabelText('Bild für Typenschild'), { target: { files: [image] } });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('LFS nicht erreichbar'));
    expect(mocks.assets.createAsset).not.toHaveBeenCalled();
  });

  it('stellt Formularfelder und ausgewählte Bilder nach einem Reload wieder her', async () => {
    enterEditMode();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn()
    });
    const image = new File(['camera image'], 'typenschild.png', { type: 'image/png' });
    render(NewAssetPage);

    await fireEvent.input(screen.getByLabelText('Bezeichnung'), { target: { value: 'Kamera Eingang' } });
    await fireEvent.change(screen.getByLabelText('Bild für Typenschild'), { target: { files: [image] } });
    await waitFor(() => expect(mocks.draftFiles['asset:new']?.Typenschild).toEqual([image]));
    await waitFor(() => expect(localStorage.getItem('zeugdb:form-draft:asset:new')).not.toBeNull());

    cleanup();
    render(NewAssetPage);

    await waitFor(() => expect((screen.getByLabelText('Bezeichnung') as HTMLInputElement).value).toBe('Kamera Eingang'));
    expect((await screen.findByRole('img', { name: 'Typenschild' })).getAttribute('src')).toBe('blob:preview');
    expect(mocks.draftFiles['asset:new']?.Typenschild[0].name).toBe('typenschild.png');
  });

  it('speichert mehrere Bilder eines Typfelds als Git-LFS-Pfade am Asset', async () => {
    enterEditMode();
    mocks.types.all = [{
      id: 'geraet',
      name: 'Gerät',
      fields: [{ nr: 0, name: 'Mängelfotos', art: 'images', optionen: null, pflicht: false, sensitiv: false }],
      blocks: []
    }];
    mocks.fotos.uploadFoto
      .mockResolvedValueOnce('fotos/asset-draft/photo-0.jpg')
      .mockResolvedValueOnce('fotos/asset-draft/photo-1.jpg');
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn()
    });
    render(NewAssetPage);

    await fireEvent.input(screen.getByLabelText('Bezeichnung'), { target: { value: 'Gerät mit Mangel' } });
    await fireEvent.change(screen.getByLabelText('Bilder für Mängelfotos'), {
      target: { files: [
        new File(['front'], 'mangel-vorne.jpg', { type: 'image/jpeg' }),
        new File(['rear'], 'mangel-hinten.jpg', { type: 'image/jpeg' })
      ] }
    });
    await fireEvent.submit(screen.getByRole('heading', { name: 'Neues Asset' }).closest('form')!);

    await waitFor(() => expect(mocks.assets.createAsset).toHaveBeenCalled());
    expect(mocks.fotos.uploadFoto).toHaveBeenCalledTimes(2);
    expect(mocks.assets.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.objectContaining({
        'Mängelfotos': JSON.stringify([
          'fotos/asset-draft/photo-0.jpg',
          'fotos/asset-draft/photo-1.jpg'
        ]),
        fotos: 'fotos/asset-draft/photo-0.jpg,fotos/asset-draft/photo-1.jpg'
      })
    }));
  });
});
