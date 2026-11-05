import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AssetPhotoGallery from './AssetPhotoGallery.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AssetPhotoGallery', () => {
  it('opens a photo through the detail-page image loader and closes the viewer', async () => {
    const onFotoOpen = vi.fn().mockResolvedValue({
      data: new Uint8Array([1, 2]),
      mimeType: 'image/jpeg'
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:full-photo'),
      revokeObjectURL: vi.fn()
    });
    render(AssetPhotoGallery, {
      props: {
        fotos: ['fotos/asset-1/label.jpg'],
        fotoUrls: { 'fotos/asset-1/label.jpg': 'blob:preview' },
        fotoRollenzuordnung: { typenschild: 'fotos/asset-1/label.jpg', uebersicht: '' },
        editable: false,
        uploading: false,
        error: '',
        onFotoUpload: vi.fn(),
        onFotoDelete: vi.fn(),
        onFotoOpen
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Foto 1 vergrößern' }));

    expect(onFotoOpen).toHaveBeenCalledWith('fotos/asset-1/label.jpg');
    expect(screen.getByRole('dialog', { name: 'Foto ansehen' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Foto in voller Größe' }).getAttribute('src'))
      .toBe('blob:full-photo');

    await fireEvent.click(screen.getByRole('button', { name: 'Foto schließen' }));
    expect(screen.queryByRole('dialog', { name: 'Foto ansehen' })).toBeNull();
  });

  it('shows an error in the viewer when the photo cannot be loaded', async () => {
    render(AssetPhotoGallery, {
      props: {
        fotos: ['fotos/asset-1/label.jpg'],
        fotoUrls: { 'fotos/asset-1/label.jpg': 'blob:preview' },
        fotoRollenzuordnung: { typenschild: '', uebersicht: '' },
        editable: false,
        uploading: false,
        error: '',
        onFotoUpload: vi.fn(),
        onFotoDelete: vi.fn(),
        onFotoOpen: vi.fn().mockRejectedValue(new Error('Kein lokal verfügbares Vorschaubild'))
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Foto 1 vergrößern' }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Kein lokal verfügbares Vorschaubild');
  });

  it('delegates role uploads and photo deletion', async () => {
    const onFotoUpload = vi.fn();
    const onFotoDelete = vi.fn();
    render(AssetPhotoGallery, {
      props: {
        fotos: ['fotos/asset-1/label.jpg'],
        fotoUrls: { 'fotos/asset-1/label.jpg': 'blob:label' },
        fotoRollenzuordnung: { typenschild: 'fotos/asset-1/label.jpg', uebersicht: '' },
        editable: true,
        uploading: false,
        error: '',
        onFotoUpload,
        onFotoDelete: onFotoDelete,
        onFotoOpen: vi.fn()
      }
    });

    await fireEvent.change(screen.getByLabelText('Typenschild-Foto hochladen'), {
      target: { files: [new File(['label'], 'label.jpg', { type: 'image/jpeg' })] }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Foto 1 löschen' }));

    expect(onFotoUpload).toHaveBeenCalledWith(expect.any(Event), 'typenschild');
    expect(onFotoDelete).toHaveBeenCalledWith(0);
    expect(screen.getByRole('img', { name: 'Typenschild-Foto' }).getAttribute('src')).toBe('blob:label');
  });

  it('shows a read-only notice and hides upload and delete controls', () => {
    render(AssetPhotoGallery, {
      props: {
        fotos: ['fotos/asset-1/label.jpg'],
        fotoUrls: {},
        fotoRollenzuordnung: { typenschild: '', uebersicht: '' },
        editable: false,
        uploading: false,
        error: '',
        onFotoUpload: vi.fn(),
        onFotoDelete: vi.fn(),
        onFotoOpen: vi.fn()
      }
    });

    expect(screen.getByText('Zum Hinzufügen oder Löschen von Fotos den Schreibmodus aktivieren.')).toBeTruthy();
    expect(screen.queryByLabelText('Typenschild-Foto hochladen')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Foto 1 löschen' })).toBeNull();
  });
});
