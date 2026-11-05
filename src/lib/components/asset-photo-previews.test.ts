import { describe, expect, it, vi } from 'vitest';
import { loadPhotoPreviewBlobs } from './asset-photo-previews';

describe('loadPhotoPreviewBlobs', () => {
  it('loads unique available photos and ignores missing previews', async () => {
    const loadFoto = vi.fn(async (path: string) => {
      if (path === 'missing.jpg') throw new Error('offline');
      return { data: new TextEncoder().encode(path), mimeType: 'image/jpeg' };
    });

    const previews = await loadPhotoPreviewBlobs(
      ['one.jpg', 'one.jpg', 'missing.jpg', 'two.jpg'],
      loadFoto
    );

    expect(loadFoto).toHaveBeenCalledTimes(3);
    expect(Object.keys(previews)).toEqual(['one.jpg', 'two.jpg']);
    expect(await previews['one.jpg'].text()).toBe('one.jpg');
    expect(previews['one.jpg'].type).toBe('image/jpeg');
  });
});
