import { describe, expect, it, vi } from 'vitest';
import { uploadImageFields } from './asset-image-fields';

describe('uploadImageFields', () => {
  it('uploads selected image fields and returns their paths alongside ordinary values', async () => {
    const file = new File(['picture'], 'label.jpg', { type: 'image/jpeg' });
    const upload = vi.fn().mockResolvedValue('fotos/asset-1/photo-0.jpg');

    const result = await uploadImageFields(
      'asset-1',
      [{ name: 'Typenschild', art: 'image' }, { name: 'Modell', art: 'text' }],
      { Typenschild: file },
      { Modell: 'X100' },
      upload
    );

    expect(upload).toHaveBeenCalledWith('asset-1', file);
    expect(result).toEqual({ Modell: 'X100', Typenschild: 'fotos/asset-1/photo-0.jpg' });
  });

  it('does not upload or invent values for an empty image field', async () => {
    const upload = vi.fn();

    const result = await uploadImageFields(
      'asset-1',
      [{ name: 'Übersicht', art: 'image' }],
      {},
      {},
      upload
    );

    expect(upload).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('propagates upload failures so the caller can avoid creating an incomplete asset', async () => {
    const file = new File(['picture'], 'label.jpg', { type: 'image/jpeg' });
    const upload = vi.fn().mockRejectedValue(new Error('LFS nicht erreichbar'));

    await expect(uploadImageFields(
      'asset-1',
      [{ name: 'Typenschild', art: 'image' }],
      { Typenschild: file },
      {},
      upload
    )).rejects.toThrow('LFS nicht erreichbar');
  });
});
