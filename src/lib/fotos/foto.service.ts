import type { RepoFs } from '../fs/repo-fs';
import { type LfsClient, isLfsPointer, pointerToText } from './lfs';
import { createImageVariants } from './image-processing';
import { canDownloadPreviews, estimateBrowserStorage } from './preview-storage';
import { migrateExistingImages } from './image-migration';

/**
 * Service zum Hochladen, Speichern und Verwalten von Asset-Fotos.
 *
 * Jedes Foto wird als komprimiertes JPEG und zusätzliches Offline-Vorschaubild
 * in `fotos/<asset-id>/photo-N.jpg` bzw. `photo-N.preview.jpg` gespeichert.
 * Bei aktivem LFS-Client wird das Binary zum LFS-Server hochgeladen
 * und der Dateiinhalt im Git-Repo durch den LFS-Pointer ersetzt.
 * Ohne LFS-Client wird das Binary direkt im Repo gespeichert.
 *
 * Der lokale Cache (LfsClient oder interner Fallback) hält die Binary-Daten
 * für die Vorschau im Browser.
 */
export class FotoService {
  private lfs: LfsClient | null = null;

  constructor(private fs: RepoFs) {}

  /**
   * Verknüpft den LFS-Client. Danach werden alle Uploads über LFS synchronisiert.
   */
  setLfsClient(client: LfsClient | null): void {
    this.lfs = client;
  }

  /**
   * Lädt ein Foto für ein Asset hoch.
   * Gibt den relativen Pfad zum JPEG-Original zurück.
   *
   * Mit LFS:  Binary wird lokal gestagt (offline-first), LFS-Pointer-Text
   *           wird als Dateiinhalt geschrieben. Der echte Upload zum
   *           LFS-Server erfolgt erst bei flushPending() (beim Sync-Push).
   * Ohne LFS: Binary wird direkt als Datei geschrieben.
   */
  async uploadFoto(
    assetId: string,
    data: Uint8Array,
    mimeType: string
  ): Promise<string> {
    const variants = await createImageVariants(data, mimeType);
    const dir = `fotos/${assetId}`;
    const index = await this._nextIndex(dir);
    const filename = `photo-${index}.jpg`;
    const pfad = `${dir}/${filename}`;

    await this.saveImage(pfad, variants.full.data);
    await this.saveImage(previewPath(pfad), variants.preview.data);

    return pfad;
  }

  /**
   * Liest online das Original und fällt andernfalls auf die lokale Vorschau zurück.
   */
  async ladeFoto(pfad: string): Promise<{ data: Uint8Array; mimeType: string }> {
    const online = typeof navigator === 'undefined' || navigator.onLine;
    if (online) {
      try {
        return await this.ladeOriginal(pfad);
      } catch {
        // Netzausfälle werden wie Offline-Betrieb behandelt.
      }
    }
    return this.ladeVorschau(previewPath(pfad), pfad);
  }

  /**
   * Lädt Vorschaubilder beim Sync nur, wenn die Origin-Quota genügend Platz hat.
   */
  async syncPreviews(): Promise<{ downloaded: number; skipped: boolean }> {
    if (!this.lfs || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { downloaded: 0, skipped: true };
    }
    const pointers = await this.listPreviewPointers();
    const missing: { path: string; oid: string; size: number }[] = [];
    for (const item of pointers) {
      if (await this.lfs.getStoredPreview(item.oid)) continue;
      if (await this.lfs.readStagedBinary(item.oid)) continue;
      missing.push(item);
    }
    if (missing.length === 0) return { downloaded: 0, skipped: false };
    const estimate = await estimateBrowserStorage();
    const neededBytes = missing.reduce((sum, item) => sum + item.size, 0);
    if (!canDownloadPreviews(estimate, neededBytes)) {
      return { downloaded: 0, skipped: true };
    }

    let downloaded = 0;
    for (const item of missing) {
      try {
        const data = await this.lfs.download(item, item.path, false);
        await this.lfs.storePreview(item.oid, data);
        downloaded += 1;
      } catch {
        // Ein nicht erreichbares LFS-Objekt soll den normalen Git-Sync nicht abbrechen.
      }
    }
    return { downloaded, skipped: false };
  }

  async migrateExistingImages(): Promise<{ migrated: number; skipped: number }> {
    return migrateExistingImages(this.fs, this.lfs);
  }

  /**
   * Listet alle Originalfotos eines Assets, nicht deren Vorschaubilder.
   */
  async listFotos(assetId: string): Promise<string[]> {
    const dir = `fotos/${assetId}`;
    try {
      return (await this.fs.readdir(dir))
        .filter(entry => /^photo-\d+\.(?!preview\.)[^/]+$/.test(entry));
    } catch {
      return [];
    }
  }

  /**
   * Löscht ein Foto und entfernt es aus dem Cache.
   */
  async loescheFoto(pfad: string): Promise<void> {
    await this.fs.unlink(pfad);
    this.lfs?.removeCached(pfad);
    const preview = previewPath(pfad);
    try {
      const raw = await this.fs.readBinaryFile(preview);
      if (isLfsPointer(raw)) {
        const pointer = parsePointer(raw);
        if (pointer) await this.lfs?.removeStoredPreview(pointer.oid);
      }
      await this.fs.unlink(preview);
    } catch {
      // Ältere Fotos haben noch kein separates Vorschaubild.
    }
    this.lfs?.removeCached(preview);
  }

  /**
   * Importiert ein Binary in den Cache (z.B. nach manuellem Download vom LFS-Server).
   */
  cacheFoto(pfad: string, data: Uint8Array): void {
    this.lfs?.setCached(pfad, data);
  }

  private async _nextIndex(dir: string): Promise<number> {
    try {
      const entries = await this.fs.readdir(dir);
      const photos = entries.filter(e => /^photo-\d+\.(?!preview\.)/.test(e));
      const indices = photos
        .map(e => {
          const match = e.match(/^photo-(\d+)/);
          return match ? parseInt(match[1], 10) : -1;
        })
        .filter(n => n >= 0);
      return indices.length > 0 ? Math.max(...indices) + 1 : 0;
    } catch {
      return 0;
    }
  }

  private async saveImage(path: string, data: Uint8Array): Promise<void> {
    if (!this.lfs) {
      await this.fs.writeFileBinary(path, data);
      return;
    }
    const info = await this.lfs.stageBinary(data);
    await this.fs.writeFile(path, pointerToText(info));
    this.lfs.setCached(path, data);
    if (path.endsWith('.preview.jpg')) {
      await this.lfs.storePreview(info.oid, data);
    }
  }

  private async ladeOriginal(pfad: string): Promise<{ data: Uint8Array; mimeType: string }> {
    const mimeType = mimeTypeForPath(pfad);
    const rawBytes = await this.fs.readBinaryFile(pfad);
    if (!isLfsPointer(rawBytes)) return { data: rawBytes, mimeType };
    const pointer = parsePointer(rawBytes);
    if (!pointer) throw new Error(`Ungültiger LFS-Pointer: ${pfad}`);
    if (!this.lfs) throw new Error(`LFS-Client nicht konfiguriert: ${pfad}`);
    return { data: await this.lfs.download(pointer, pfad), mimeType };
  }

  private async ladeVorschau(
    preview: string,
    original: string
  ): Promise<{ data: Uint8Array; mimeType: string }> {
    try {
      const rawBytes = await this.fs.readBinaryFile(preview);
      if (!isLfsPointer(rawBytes)) return { data: rawBytes, mimeType: 'image/jpeg' };
      const pointer = parsePointer(rawBytes);
      if (!pointer) throw new Error(`Ungültiger LFS-Pointer: ${preview}`);
      const cached = await this.lfs?.getStoredPreview(pointer.oid);
      if (cached) return { data: cached, mimeType: 'image/jpeg' };
      const staged = await this.lfs?.readStagedBinary(pointer.oid);
      if (staged) return { data: staged, mimeType: 'image/jpeg' };
      if (this.lfs && (typeof navigator === 'undefined' || navigator.onLine)) {
        const data = await this.lfs.download(pointer, preview, false);
        await this.lfs.storePreview(pointer.oid, data);
        return { data, mimeType: 'image/jpeg' };
      }
    } catch {
      // Der Fehler unten nennt den fehlenden Offline-Fallback.
    }
    throw new Error(`Kein lokal verfügbares Vorschaubild für ${original}`);
  }

  private async listPreviewPointers(): Promise<Array<{ path: string; oid: string; size: number }>> {
    const result: Array<{ path: string; oid: string; size: number }> = [];
    let assets: string[];
    try {
      assets = await this.fs.readdir('fotos');
    } catch {
      return result;
    }
    for (const asset of assets) {
      let files: string[];
      try {
        files = await this.fs.readdir(`fotos/${asset}`);
      } catch {
        continue;
      }
      for (const file of files.filter(name => /^photo-\d+\.preview\.jpg$/.test(name))) {
        const path = `fotos/${asset}/${file}`;
        try {
          const pointer = parsePointer(await this.fs.readBinaryFile(path));
          if (pointer) result.push({ path, ...pointer });
        } catch {
          // Unlesbare Einträge überspringen.
        }
      }
    }
    return result;
  }
}

function previewPath(original: string): string {
  return original.replace(/\.[^/.]+$/, '.preview.jpg');
}

function mimeTypeForPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'bmp') return 'image/bmp';
  return 'image/jpeg';
}

function parsePointer(content: Uint8Array): { oid: string; size: number } | null {
  const text = new TextDecoder().decode(content);
  const oid = text.match(/^oid sha256:([a-f0-9]{64})$/m)?.[1];
  const size = Number(text.match(/^size (\d+)$/m)?.[1]);
  return oid && Number.isSafeInteger(size) ? { oid, size } : null;
}
