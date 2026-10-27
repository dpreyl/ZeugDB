import { describe, expect, it, vi } from 'vitest';
import {
  appendImageFieldPaths,
  getImageFieldPaths,
  serializeImagePaths,
  uploadImageFields
} from './asset-image-fields';

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

  it('uploads multiple files for one field and stores all returned LFS paths', async () => {
    const files = [
      new File(['front'], 'front.jpg', { type: 'image/jpeg' }),
      new File(['rear'], 'rear.jpg', { type: 'image/jpeg' })
    ];
    const upload = vi.fn()
      .mockResolvedValueOnce('fotos/asset-1/photo-0.jpg')
      .mockResolvedValueOnce('fotos/asset-1/photo-1.jpg');
    const onUploaded = vi.fn();

    const result = await uploadImageFields(
      'asset-1',
      [{ name: 'Mängelfotos', art: 'images' }],
      { Mängelfotos: files },
      {},
      upload,
      onUploaded
    );

    const paths = ['fotos/asset-1/photo-0.jpg', 'fotos/asset-1/photo-1.jpg'];
    expect(upload).toHaveBeenNthCalledWith(1, 'asset-1', files[0]);
    expect(upload).toHaveBeenNthCalledWith(2, 'asset-1', files[1]);
    expect(getImageFieldPaths(result.Mängelfotos, 'images')).toEqual(paths);
    expect(onUploaded).toHaveBeenCalledWith('Mängelfotos', serializeImagePaths(paths));
  });

  it('appends uploaded image paths without losing existing field or gallery photos', () => {
    const previous = {
      Mängelfotos: serializeImagePaths(['fotos/asset-1/photo-0.jpg']),
      fotos: 'fotos/asset-1/photo-0.jpg,fotos/asset-1/photo-1.jpg'
    };

    expect(appendImageFieldPaths(
      previous,
      'Mängelfotos',
      ['fotos/asset-1/photo-2.jpg'],
      true
    )).toEqual({
      Mängelfotos: serializeImagePaths(['fotos/asset-1/photo-0.jpg', 'fotos/asset-1/photo-2.jpg']),
      fotos: 'fotos/asset-1/photo-0.jpg,fotos/asset-1/photo-1.jpg,fotos/asset-1/photo-2.jpg'
    });
    expect(getImageFieldPaths('fotos/asset-1/photo-0.jpg', 'image'))
      .toEqual(['fotos/asset-1/photo-0.jpg']);
  });
});
