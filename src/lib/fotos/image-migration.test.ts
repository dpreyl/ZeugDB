import { describe, expect, it, vi } from 'vitest';
import { createMockFs } from '../fs/repo-fs';
import { migrateExistingImages } from './image-migration';

vi.mock('./image-processing', () => ({
  FULL_IMAGE_MAX_BYTES: 3 * 1024 * 1024,
  PREVIEW_IMAGE_MAX_BYTES: 300 * 1024,
  createImageVariants: vi.fn(async () => ({
    full: { data: new Uint8Array([0xff, 0xd8, 1]), mimeType: 'image/jpeg' },
    preview: { data: new Uint8Array([0xff, 0xd8]), mimeType: 'image/jpeg' }
  }))
}));

describe('migrateExistingImages', () => {
  it('converts old image files, creates previews, and updates asset references', async () => {
    const fs = createMockFs();
    await fs.writeFileBinary('fotos/asset-1/photo-0.png', new Uint8Array([1, 2, 3]));
    await fs.writeFile('assets/asset-1.asset', 'id: asset-1\nFoto: fotos/asset-1/photo-0.png\n');

    const result = await migrateExistingImages(fs, null);

    expect(result).toEqual({ migrated: 1, skipped: 0 });
    expect(await fs.readBinaryFile('fotos/asset-1/photo-0.jpg'))
      .toEqual(new Uint8Array([0xff, 0xd8, 1]));
    expect(await fs.readBinaryFile('fotos/asset-1/photo-0.preview.jpg'))
      .toEqual(new Uint8Array([0xff, 0xd8]));
    await expect(fs.readBinaryFile('fotos/asset-1/photo-0.png')).rejects.toThrow();
    expect(await fs.readFile('assets/asset-1.asset'))
      .toContain('Foto: fotos/asset-1/photo-0.jpg');
  });

  it('skips already normalized images within both size limits', async () => {
    const fs = createMockFs();
    await fs.writeFileBinary('fotos/asset-1/photo-0.jpg', new Uint8Array([1, 2, 3]));
    await fs.writeFileBinary('fotos/asset-1/photo-0.preview.jpg', new Uint8Array([1]));

    await expect(migrateExistingImages(fs, null)).resolves.toEqual({ migrated: 0, skipped: 1 });
  });

  it('uses a new photo index rather than overwriting an existing JPEG', async () => {
    const fs = createMockFs();
    await fs.writeFileBinary('fotos/asset-1/photo-0.png', new Uint8Array([1]));
    await fs.writeFileBinary('fotos/asset-1/photo-0.jpg', new Uint8Array([9]));
    await fs.writeFileBinary('fotos/asset-1/photo-0.preview.jpg', new Uint8Array([8]));

    const result = await migrateExistingImages(fs, null);

    expect(result).toEqual({ migrated: 1, skipped: 1 });
    expect(await fs.readBinaryFile('fotos/asset-1/photo-1.jpg'))
      .toEqual(new Uint8Array([0xff, 0xd8, 1]));
  });
});
