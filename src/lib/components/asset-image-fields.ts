import type { FieldType } from '$lib/parser/types';

type ImageField = Pick<FieldType, 'name' | 'art'>;
type UploadImage = (assetId: string, file: File) => Promise<string>;

export function getImageFieldPaths(value: string | undefined, art: string): string[] {
  if (!value) return [];
  if (art !== 'images') return [value];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(path => typeof path === 'string')
      ? parsed
      : [value];
  } catch {
    return [value];
  }
}

export function serializeImagePaths(paths: string[]): string {
  return JSON.stringify(paths);
}

export function appendImageFieldPaths(
  currentFields: Record<string, string>,
  fieldName: string,
  addedPaths: string[],
  multiple: boolean
): Record<string, string> {
  const existingFieldPaths = multiple ? getImageFieldPaths(currentFields[fieldName], 'images') : [];
  const fieldPaths = multiple ? [...new Set([...existingFieldPaths, ...addedPaths])] : addedPaths.slice(-1);
  const photos = [...new Set([
    ...(currentFields.fotos || '').split(',').map(path => path.trim()).filter(Boolean),
    ...addedPaths
  ])];

  return {
    ...currentFields,
    ...(fieldPaths.length > 0 && {
      [fieldName]: multiple ? serializeImagePaths(fieldPaths) : fieldPaths[0]
    }),
    fotos: photos.join(',')
  };
}

export async function uploadImageFiles(
  assetId: string,
  files: File[],
  upload: UploadImage
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) paths.push(await upload(assetId, file));
  return paths;
}

/**
 * Lädt ausgewählte Bildfelder hoch und gibt ihre Pfade zusammen mit den
 * übrigen Feldwerten zurück. Ein Feld ohne ausgewählte Datei bleibt unverändert.
 */
export async function uploadImageFields(
  assetId: string,
  fields: ImageField[],
  selectedFiles: Record<string, File | File[]>,
  currentValues: Record<string, string>,
  upload: UploadImage,
  onUploaded: (fieldName: string, value: string) => void = () => {}
): Promise<Record<string, string>> {
  const values = { ...currentValues };

  for (const field of fields) {
    if (field.art !== 'image' && field.art !== 'images') continue;
    const selected = selectedFiles[field.name];
    const files = selected ? (Array.isArray(selected) ? selected : [selected]) : [];
    if (files.length === 0) continue;
    const paths = await uploadImageFiles(assetId, files, upload);
    const value = field.art === 'images' ? serializeImagePaths(paths) : paths[0];
    values[field.name] = value;
    onUploaded(field.name, value);
  }

  return values;
}
