export const FULL_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const PREVIEW_IMAGE_MAX_BYTES = 300 * 1024;

export interface ImageFrame {
  width: number;
  height: number;
  source?: unknown;
}

export interface ImageEncoder {
  decode(data: Uint8Array, mimeType: string): Promise<ImageFrame>;
  encode(frame: ImageFrame, width: number, height: number, quality: number): Promise<Uint8Array>;
}

export interface EncodedImage {
  data: Uint8Array;
  mimeType: 'image/jpeg';
}

export interface ImageVariants {
  full: EncodedImage;
  preview: EncodedImage;
}

const browserEncoder: ImageEncoder = {
  async decode(data, mimeType) {
    if (typeof createImageBitmap !== 'function') {
      throw new Error('Bildverarbeitung wird von diesem Browser nicht unterstützt');
    }
    const imageBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const bitmap = await createImageBitmap(new Blob([imageBuffer], { type: mimeType }));
    return { width: bitmap.width, height: bitmap.height, source: bitmap };
  },
  async encode(frame, width, height, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Bildfläche konnte nicht erstellt werden');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(frame.source as CanvasImageSource, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('JPEG konnte nicht erstellt werden')),
        'image/jpeg', quality);
    });
    return new Uint8Array(await blob.arrayBuffer());
  }
};

/**
 * Erstellt ein komprimiertes Original und ein platzsparendes Offline-Vorschaubild.
 */
export async function createImageVariants(
  data: Uint8Array,
  mimeType: string,
  encoder: ImageEncoder = browserEncoder
): Promise<ImageVariants> {
  if (data.length === 0) throw new Error('Bilddatei ist leer');
  const frame = await encoder.decode(data, mimeType);
  try {
    if (!Number.isFinite(frame.width) || !Number.isFinite(frame.height)
      || frame.width < 1 || frame.height < 1) {
      throw new Error('Bildgröße konnte nicht ermittelt werden');
    }

    const [full, preview] = await Promise.all([
      encodeWithinLimit(encoder, frame, FULL_IMAGE_MAX_BYTES, 2560, 0.86),
      encodeWithinLimit(encoder, frame, PREVIEW_IMAGE_MAX_BYTES, 1280, 0.78)
    ]);
    return {
      full: { data: full, mimeType: 'image/jpeg' },
      preview: { data: preview, mimeType: 'image/jpeg' }
    };
  } finally {
    (frame.source as { close?: () => void } | undefined)?.close?.();
  }
}

async function encodeWithinLimit(
  encoder: ImageEncoder,
  frame: ImageFrame,
  maxBytes: number,
  maxDimension: number,
  initialQuality: number
): Promise<Uint8Array> {
  const largestSide = Math.max(frame.width, frame.height);
  let scale = Math.min(1, maxDimension / largestSide);
  let quality = initialQuality;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const width = Math.max(1, Math.round(frame.width * scale));
    const height = Math.max(1, Math.round(frame.height * scale));
    const encoded = await encoder.encode(frame, width, height, quality);
    if (encoded.length <= maxBytes) return encoded;

    if (quality > 0.56) {
      quality = Math.max(0.56, quality - 0.08);
    } else {
      scale *= 0.82;
      quality = initialQuality;
    }
  }
  throw new Error('Bild konnte nicht ausreichend komprimiert werden');
}
