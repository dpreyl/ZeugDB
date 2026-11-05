import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ClickablePhoto from './ClickablePhoto.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ClickablePhoto', () => {
  it('loads the image on demand and opens the accessible viewer', async () => {
    const onOpen = vi.fn().mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'image/jpeg'
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:full-size'),
      revokeObjectURL
    });
    render(ClickablePhoto, {
      props: {
        path: 'fotos/asset-1/photo-0.jpg',
        src: 'blob:preview',
        alt: 'Gerätebild',
        imageClass: 'preview',
        onOpen
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Bild vergrößern: Gerätebild' }));

    expect(onOpen).toHaveBeenCalledWith('fotos/asset-1/photo-0.jpg');
    expect(screen.getByRole('img', { name: 'Foto in voller Größe' }).getAttribute('src'))
      .toBe('blob:full-size');

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Foto ansehen' })).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:full-size');
  });

  it('keeps images without an open handler as plain, non-interactive previews', () => {
    render(ClickablePhoto, {
      props: {
        path: 'fotos/asset-1/photo-0.jpg',
        src: 'blob:preview',
        alt: 'Gerätebild',
        imageClass: 'preview'
      }
    });

    expect(screen.getByRole('img', { name: 'Gerätebild' }).getAttribute('src')).toBe('blob:preview');
    expect(screen.queryByRole('button', { name: 'Bild vergrößern: Gerätebild' })).toBeNull();
  });
});
