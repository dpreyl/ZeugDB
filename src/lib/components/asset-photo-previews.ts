export type PhotoPreviewData = {
  data: Uint8Array;
  mimeType: string;
};

export async function loadPhotoPreviewBlobs(
  paths: string[],
  loadFoto: (path: string) => Promise<PhotoPreviewData>
): Promise<Record<string, Blob>> {
  const previews: Record<string, Blob> = {};
  for (const path of new Set(paths)) {
    try {
      const { data, mimeType } = await loadFoto(path);
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      previews[path] = new Blob([bytes as BlobPart], { type: mimeType });
    } catch {
      // Eine fehlende lokale Vorschau soll den Rest der Asset-Seite nicht blockieren.
    }
  }
  return previews;
}
