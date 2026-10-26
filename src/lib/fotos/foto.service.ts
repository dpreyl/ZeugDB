import type { RepoFs } from '../fs/repo-fs';
import { type LfsClient, isLfsPointer, pointerToText } from './lfs';

/**
 * Bestimmt die Dateiendung aus dem MIME-Typ.
 */
function mimeTypeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp'
  };
  return map[mimeType] || 'bin';
}

/**
 * Service zum Hochladen, Speichern und Verwalten von Asset-Fotos.
 *
 * Jedes Foto wird in `fotos/<asset-id>/photo-N.<ext>` gespeichert.
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
   * Gibt den relativen Pfad zurück (z.B. `fotos/projektor-1/photo-0.png`).
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
    const ext = mimeTypeToExt(mimeType);
    const dir = `fotos/${assetId}`;
    const index = await this._nextIndex(dir);
    const filename = `photo-${index}.${ext}`;
    const pfad = `${dir}/${filename}`;

    if (this.lfs) {
      // Offline-first: Binary in IndexedDB stagen, Pointer ins Git-Repo schreiben.
      // Der Upload zum LFS-Server erfolgt beim nächsten Sync (flushPending).
      const info = await this.lfs.stageBinary(data);
      await this.fs.writeFile(pfad, pointerToText(info));
      this.lfs.setCached(pfad, data);
    } else {
      // Kein LFS: Binary direkt ins Repo (kompatibel mit Tests)
      await this.fs.writeFileBinary(pfad, data);
    }

    return pfad;
  }

  /**
   * Liest ein Foto und gibt die Binary-Daten zurück.
   * Bei LFS-Pointern wird aus dem Cache gelesen oder vom LFS-Server geladen.
   * Bei direkten Binaries wird die Datei gelesen.
   */
  async ladeFoto(pfad: string): Promise<{ data: Uint8Array; mimeType: string }> {
    const ext = pfad.split('.').pop()?.split('?')[0] || 'bin';
    const extMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
    };
    const mimeType = extMap[ext] || 'application/octet-stream';

    // Zuerst Cache prüfen
    if (this.lfs) {
      const cached = this.lfs.getCached(pfad);
      if (cached) return { data: cached, mimeType };
    }

    // Datei vom FS lesen
    const rawBytes = await this.fs.readBinaryFile(pfad);

    if (isLfsPointer(rawBytes)) {
      const pointer = parsePointer(rawBytes);
      if (!pointer) throw new Error(`Ungültiger LFS-Pointer: ${pfad}`);
      const cached = this.lfs?.getCached(pfad);
      if (cached) return { data: cached, mimeType };
      if (!this.lfs) throw new Error(`LFS-Client nicht konfiguriert: ${pfad}`);
      const staged = await this.lfs.readStagedBinary(pointer.oid);
      if (staged) {
        this.lfs.setCached(pfad, staged);
        return { data: staged, mimeType };
      }
      return { data: await this.lfs.download(pointer, pfad), mimeType };
    }

    // Direktes Binary (kein LFS)
    return { data: rawBytes, mimeType };
  }

  /**
   * Listet alle Fotos eines Assets.
   */
  async listFotos(assetId: string): Promise<string[]> {
    const dir = `fotos/${assetId}`;
    try {
      return await this.fs.readdir(dir);
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
      const photos = entries.filter(e => e.startsWith('photo-'));
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
}

function parsePointer(content: Uint8Array): { oid: string; size: number } | null {
  const text = new TextDecoder().decode(content);
  const oid = text.match(/^oid sha256:([a-f0-9]{64})$/m)?.[1];
  const size = Number(text.match(/^size (\d+)$/m)?.[1]);
  return oid && Number.isSafeInteger(size) ? { oid, size } : null;
}
