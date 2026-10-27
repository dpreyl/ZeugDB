import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import AssetPhotoGallery from './AssetPhotoGallery.svelte';

describe('AssetPhotoGallery', () => {
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
        onFotoDelete: onFotoDelete
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
        onFotoDelete: vi.fn()
      }
    });

    expect(screen.getByText('Zum Hinzufügen oder Löschen von Fotos den Schreibmodus aktivieren.')).toBeTruthy();
    expect(screen.queryByLabelText('Typenschild-Foto hochladen')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Foto 1 löschen' })).toBeNull();
  });
});
