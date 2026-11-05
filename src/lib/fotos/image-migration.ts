import type { RepoFs } from '../fs/repo-fs';
import { type LfsClient, isLfsPointer, pointerToText } from './lfs';
import { createImageVariants, FULL_IMAGE_MAX_BYTES, PREVIEW_IMAGE_MAX_BYTES } from './image-processing';

type ImagePointer = { oid: string; size: number };
type MigrationResult = { migrated: number; skipped: number };

const RECORD_DIRECTORIES = ['assets', 'components', 'types', 'locations'];
const RECORD_EXTENSIONS = /\.(asset|comp|type|location)$/;
const PHOTO_FILE = /^photo-(\d+)\.(png|jpe?g|gif|webp|bmp)$/i;

/**
 * Konvertiert alte Foto-Dateien idempotent in JPEG-Originale plus Offline-Previews.
 * Die betroffenen Datensatzdateien werden auf die neuen JPEG-Pfade umgestellt.
 */
export async function migrateExistingImages(
  fs: RepoFs,
  lfs: LfsClient | null
): Promise<MigrationResult> {
  let migrated = 0;
  let skipped = 0;
  const pathChanges = new Map<string, string>();
  let assetDirectories: string[];
  try {
    assetDirectories = await fs.readdir('fotos');
  } catch {
    return { migrated, skipped };
  }

  for (const assetId of assetDirectories) {
    let files: string[];
    try {
      files = await fs.readdir(`fotos/${assetId}`);
    } catch {
      continue;
    }
    const occupied = new Set(files);
    let nextIndex = files.reduce((max, file) => {
      const index = Number(file.match(/^photo-(\d+)/)?.[1]);
      return Number.isFinite(index) ? Math.max(max, index + 1) : max;
    }, 0);

    for (const file of files.filter(entry => PHOTO_FILE.test(entry))) {
      const sourcePath = `fotos/${assetId}/${file}`;
      const source = await fs.readBinaryFile(sourcePath);
      const sourcePointer = parsePointer(source);
      const existingPreviewPath = previewPath(sourcePath);
      const existingPreview = await readFileOrNull(fs, existingPreviewPath);
      if (
        file.endsWith('.jpg') &&
        existingPreview &&
        withinLimit(sourcePointer?.size ?? source.length, FULL_IMAGE_MAX_BYTES) &&
        withinLimit(parsePointer(existingPreview)?.size ?? existingPreview.length, PREVIEW_IMAGE_MAX_BYTES)
      ) {
        skipped += 1;
        continue;
      }

      const original = await getImageBytes(sourcePath, source, lfs);
      const variants = await createImageVariants(original, mimeTypeForPath(sourcePath));
      let destination = sourcePath.replace(/\.[^/.]+$/, '.jpg');
      if (destination !== sourcePath && occupied.has(destination.slice(destination.lastIndexOf('/') + 1))) {
        destination = `fotos/${assetId}/photo-${nextIndex++}.jpg`;
      }
      const destinationPreview = previewPath(destination);
      await saveImage(fs, lfs, destination, variants.full.data);
      await saveImage(fs, lfs, destinationPreview, variants.preview.data);

      if (destination !== sourcePath) {
        await fs.unlink(sourcePath);
        lfs?.removeCached(sourcePath);
        pathChanges.set(sourcePath, destination);
        occupied.delete(file);
        occupied.add(destination.slice(destination.lastIndexOf('/') + 1));
      }
      migrated += 1;
    }
  }

  if (pathChanges.size > 0) await rewriteRecordReferences(fs, pathChanges);
  return { migrated, skipped };
}

async function getImageBytes(path: string, raw: Uint8Array, lfs: LfsClient | null): Promise<Uint8Array> {
  const pointer = parsePointer(raw);
  if (!pointer) return raw;
  if (!lfs) throw new Error(`LFS-Client für die Migration von ${path} fehlt`);
  const staged = await lfs.readStagedBinary(pointer.oid);
  if (staged) return staged;
  return lfs.download(pointer, path);
}

async function saveImage(
  fs: RepoFs,
  lfs: LfsClient | null,
  path: string,
  data: Uint8Array
): Promise<void> {
  if (!lfs) {
    await fs.writeFileBinary(path, data);
    return;
  }
  const pointer = await lfs.stageBinary(data);
  await fs.writeFile(path, pointerToText(pointer));
  lfs.setCached(path, data);
  if (path.endsWith('.preview.jpg')) {
    await lfs.storePreview(pointer.oid, data);
  }
}

async function rewriteRecordReferences(fs: RepoFs, changes: Map<string, string>): Promise<void> {
  for (const directory of RECORD_DIRECTORIES) {
    let files: string[];
    try {
      files = await fs.readdir(directory);
    } catch {
      continue;
    }
    for (const file of files.filter(name => RECORD_EXTENSIONS.test(name))) {
      const path = `${directory}/${file}`;
      let content: string;
      try {
        content = await fs.readFile(path);
      } catch {
        continue;
      }
      const updated = [...changes].reduce(
        (value, [oldPath, newPath]) => value.split(oldPath).join(newPath),
        content
      );
      if (updated !== content) await fs.writeFile(path, updated);
    }
  }
}

function parsePointer(content: Uint8Array): ImagePointer | null {
  if (!isLfsPointer(content)) return null;
  const text = new TextDecoder().decode(content);
  const oid = text.match(/^oid sha256:([a-f0-9]{64})$/m)?.[1];
  const size = Number(text.match(/^size (\d+)$/m)?.[1]);
  return oid && Number.isSafeInteger(size) ? { oid, size } : null;
}

function previewPath(path: string): string {
  return path.replace(/\.[^/.]+$/, '.preview.jpg');
}

async function readFileOrNull(fs: RepoFs, path: string): Promise<Uint8Array | null> {
  try {
    return await fs.readBinaryFile(path);
  } catch {
    return null;
  }
}

function withinLimit(size: number, max: number): boolean {
  return size > 0 && size <= max;
}

function mimeTypeForPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'bmp') return 'image/bmp';
  return 'image/jpeg';
}
