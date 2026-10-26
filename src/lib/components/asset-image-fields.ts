import type { FieldType } from '$lib/parser/types';

type ImageField = Pick<FieldType, 'name' | 'art'>;
type UploadImage = (assetId: string, file: File) => Promise<string>;

/**
 * Lädt ausgewählte Bildfelder hoch und gibt ihre Pfade zusammen mit den
 * übrigen Feldwerten zurück. Ein Feld ohne ausgewählte Datei bleibt unverändert.
 */
export async function uploadImageFields(
  assetId: string,
  fields: ImageField[],
  selectedFiles: Record<string, File>,
  currentValues: Record<string, string>,
  upload: UploadImage,
  onUploaded: (fieldName: string, path: string) => void = () => {}
): Promise<Record<string, string>> {
  const values = { ...currentValues };

  for (const field of fields) {
    if (field.art !== 'image') continue;
    const file = selectedFiles[field.name];
    if (!file) continue;
    const path = await upload(assetId, file);
    values[field.name] = path;
    onUploaded(field.name, path);
  }

  return values;
}
