import { describe, expect, it, vi } from 'vitest';
import { createImageVariants, type ImageEncoder } from './image-processing';

describe('createImageVariants', () => {
  it('creates a full image and a smaller preview within their size limits', async () => {
    const encoder: ImageEncoder = {
      decode: vi.fn().mockResolvedValue({ width: 4000, height: 3000 }),
      encode: vi.fn(async (_frame, width, height, quality) => {
        const size = Math.min(3_000_000, Math.round(width * height * quality / 5));
        return new Uint8Array(size);
      })
    };

    const result = await createImageVariants(new Uint8Array([1]), 'image/png', encoder);

    expect(result.full.mimeType).toBe('image/jpeg');
    expect(result.preview.mimeType).toBe('image/jpeg');
    expect(result.full.data.length).toBeLessThanOrEqual(3 * 1024 * 1024);
    expect(result.preview.data.length).toBeLessThanOrEqual(300 * 1024);
    expect(encoder.decode).toHaveBeenCalledWith(expect.any(Uint8Array), 'image/png');
  });

  it('reduces dimensions and quality until a large photo fits the configured cap', async () => {
    const encode = vi.fn(async (_frame, width, height, quality) =>
      new Uint8Array(Math.round(width * height * quality))
    );
    const encoder: ImageEncoder = {
      decode: vi.fn().mockResolvedValue({ width: 6000, height: 4000 }),
      encode
    };

    const result = await createImageVariants(new Uint8Array([1]), 'image/jpeg', encoder);

    expect(result.full.data.length).toBeLessThanOrEqual(3 * 1024 * 1024);
    expect(result.preview.data.length).toBeLessThanOrEqual(300 * 1024);
    expect(encode.mock.calls.some(([, width]) => width < 2560)).toBe(true);
    expect(encode.mock.calls.some(([, , , quality]) => quality < 0.86)).toBe(true);
  });

  it('rejects empty images and invalid decoded dimensions', async () => {
    const encoder: ImageEncoder = {
      decode: vi.fn().mockResolvedValue({ width: 0, height: 100 }),
      encode: vi.fn()
    };

    await expect(createImageVariants(new Uint8Array(), 'image/jpeg', encoder))
      .rejects.toThrow('Bilddatei ist leer');
    await expect(createImageVariants(new Uint8Array([1]), 'image/jpeg', encoder))
      .rejects.toThrow('Bildgröße konnte nicht ermittelt werden');
    expect(encoder.encode).not.toHaveBeenCalled();
  });
});
