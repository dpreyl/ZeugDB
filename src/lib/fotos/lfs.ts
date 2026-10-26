/**
 * Eigenimplementierung von Git-LFS für ZeugDB.
 *
 * Ersetzt isogit-lfs vollständig. Verwendet die Git LFS HTTP API direkt
 * und speichert Binaries persistent in IndexedDB — überlebt Page-Reloads.
 *
 * Flow:
 *   1. Upload: Binary → SHA-256 → Pointer-Info + IndexedDB-Speicherung
 *   2. Git-Commit: Pointer-Text als Dateiinhalt
 *   3. Sync/Push: flushPending() → LFS Batch-API → Upload → IndexedDB-Cleanup
 */

import {
  putLfsBinary,
  getLfsBinary,
  getAllLfsBinaries,
  deleteLfsBinary
} from './lfs-db';
import sha from 'sha.js';

/**
 * LFS-Pointer-Information (OID + Größe).
 */
export interface PointerInfo {
  oid: string;
  size: number;
}

/**
 * LFS-Pointer-Objekt (wie vom Server zurückgegeben).
 */
export interface Pointer {
  oid: string;
  size: number;
}

interface LfsAction {
  href: string;
  header?: Record<string, string>;
}

/**
 * LFS-Konfiguration.
 */
export interface LfsConfig {
  /** Remote-Repo-URL (z.B. `https://gitea.local/user/repo`) */
  repoUrl: string;
  /** Benutzername für Basic Auth */
  username: string;
  /** PAT / Token (wird als Passwort für Basic Auth verwendet) */
  token: string;
}

/** LFS-Pointer-Version-Header */
const LFS_HEADER = 'version https://git-lfs.github.com/spec/v1';

/**
 * Prüft, ob ein Blob ein Git-LFS-Pointer ist.
 */
export function isLfsPointer(content: Uint8Array): boolean {
  const text = new TextDecoder().decode(content.slice(0, LFS_HEADER.length));
  return text === LFS_HEADER;
}

/**
 * Erstellt einen LFS-Pointer als Text (z.B. für Git-FS-Schreibung).
 */
export function pointerToText(info: PointerInfo): string {
  return `${LFS_HEADER}\noid sha256:${info.oid}\nsize ${info.size}\n`;
}

/**
 * Berechnet SHA-256 Hash als hex-String via Web Crypto API.
 */
async function sha256Hex(data: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data as BufferSource);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  return sha('sha256').update(data).digest('hex');
}

/**
 * Leitet die LFS-Server-URL aus der Repo-URL ab.
 *
 * Gitea:      https://gitea.example/user/repo           → /info/lfs
 * GitHub:     https://github.com/user/repo               → /git-lfs
 * GitLab:     https://gitlab.example/user/repo           → /lfs
 */
function deriveLfsUrl(repoUrl: string): string {
  // GitHub: /git-lfs
  try {
    const url = new URL(repoUrl);
    if (url.hostname === 'github.com') {
      return `${repoUrl}/git-lfs`;
    }
    // GitLab: /lfs (am Pfad-Ende)
    if (url.hostname.includes('gitlab')) {
      return `${repoUrl}/lfs`;
    }
    // Default (Gitea, self-hosted): /info/lfs
    return `${repoUrl}/info/lfs`;
  } catch {
    // Fallback bei ungültiger URL
    return `${repoUrl}/info/lfs`;
  }
}

/**
 * Erzeugt Basic Auth Header-Wert.
 */
function basicAuthHeader(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`);
}

/**
 * LFS-Client für ZeugDB.
 *
 * Binaries werden in IndexedDB gespeichert (persistent, überlebt Reloads).
 * Der Upload zum LFS-Server erfolgt bei flushPending() — typischerweise
 * direkt vor dem Git-Push.
 */
export class LfsClient {
  private config: LfsConfig | null = null;

  /**
   * In-Memory-Cache für sofortige Vorschau (nicht persistent).
   * Key = Git-Pfad (z.B. `fotos/asset-1/photo-0.png`)
   * Value = Binary-Daten (Uint8Array)
   */
  private cache = new Map<string, Uint8Array>();

  /**
   * Initialisiert den LFS-Client mit der Remote-Konfiguration.
   */
  configure(cfg: LfsConfig): void {
    this.config = cfg;
  }

  /**
   * Gibt die aktuelle Konfiguration zurück (null wenn nicht konfiguriert).
   */
  getConfig(): LfsConfig | null {
    return this.config;
  }

  /**
   * Hash-Binary und generiere LFS-Pointer-Info (ohne Server-Kontakt).
   */
  async computePointerInfo(data: Uint8Array): Promise<PointerInfo> {
    const oid = await sha256Hex(data);
    return { oid, size: data.length };
  }

  /**
   * Speichert ein Binary in IndexedDB und berechnet den LFS-Pointer.
   *
   * Kein Server-Kontakt. Das Binary ist persistent in IndexedDB gespeichert
   * und wartet auf flushPending(). Ein Page-Reload geht nicht verloren.
   *
   * @param data Binary-Daten des Bildes
   */
  async stageBinary(data: Uint8Array): Promise<PointerInfo> {
    const { oid, size } = await this.computePointerInfo(data);
    await putLfsBinary(oid, size, data);
    return { oid, size };
  }

  /**
   * Gibt true zurück, wenn ausstehende Uploads in IndexedDB vorhanden sind.
   */
  async hasPending(): Promise<boolean> {
    const entries = await getAllLfsBinaries();
    return entries.length > 0;
  }

  /**
   * Lädt alle in IndexedDB gespeicherten Binaries zum LFS-Server hoch.
   *
   * Vorgehen:
   *   1. Alle Binaries aus IndexedDB laden
   *   2. LFS Batch-API anfragen (POST /info/lfs/objects/batch)
   *   3. Jedes Binary zum LFS-Server PUT-ten
   *   4. Erfolgreiche Uploads aus IndexedDB löschen
   *
   * Bei Netzwerkfehlern bleiben die Binaries in IndexedDB und werden
   * beim nächsten flushPending()-Aufruf erneut versucht.
   */
  async flushPending(): Promise<void> {
    if (!this.config) {
      throw new Error('LFS-Client nicht konfiguriert');
    }

    const entries = await getAllLfsBinaries();
    if (entries.length === 0) return;

    const lfsUrl = deriveLfsUrl(this.config.repoUrl);
    const batchUrl = `${lfsUrl}/objects/batch`;
    const authHeader = basicAuthHeader(this.config.username, this.config.token);

    // 1. LFS Batch-Anfrage: erhalte Upload-URLs
    const batchPayload = {
      operation: 'upload',
      transfer: 'basic',
      objects: entries.map(e => ({ oid: e.oid, size: e.size }))
    };

    const batchResponse = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.git-lfs+json',
        'Accept': 'application/vnd.git-lfs+json',
        'Authorization': authHeader
      },
      body: JSON.stringify(batchPayload)
    });

    if (!batchResponse.ok) {
      throw new Error(`LFS Batch-API fehlgeschlagen: ${batchResponse.status} ${batchResponse.statusText}`);
    }

    const batchData = await batchResponse.json() as { objects: Array<{
      oid: string;
      size: number;
      actions?: Record<string, LfsAction> | LfsAction[];
      errors?: { code: number; message: string }[];
    }> };

    // 2. Jedes Binary hochladen
    let uploadFailed = false;
    for (const obj of batchData.objects) {
      const entry = entries.find(e => e.oid === obj.oid);
      if (!entry) continue;

      // Fehler vom Server? → in IndexedDB belassen
      if (obj.errors && obj.errors.length > 0) {
        console.warn(`LFS-Upload-Fehler (${obj.oid}):`, obj.errors[0].message);
        uploadFailed = true;
        continue;
      }

      // Upload-URL finden
      const uploadAction = Array.isArray(obj.actions)
        ? obj.actions.find(action => action.href)
        : obj.actions?.upload;
      if (!uploadAction) {
        console.warn(`LFS: Keine Upload-URL für ${obj.oid} (bereits vorhanden?`);
        // Wahrscheinlich bereits auf dem Server → aus IndexedDB entfernen
        await deleteLfsBinary(obj.oid);
        continue;
      }

      try {
        const uploadHeaders: Record<string, string> = {
          'Content-Type': 'application/octet-stream'
        };
        // Zusätzliche Header aus der Batch-Antwort
        if (uploadAction.header) {
          Object.assign(uploadHeaders, uploadAction.header);
        }

        const uploadResponse = await fetch(uploadAction.href, {
          method: 'PUT',
          headers: uploadHeaders,
          body: entry.data as BodyInit
        });

        if (!uploadResponse.ok) {
          throw new Error(`HTTP ${uploadResponse.status}`);
        }

        // Erfolgreich → aus IndexedDB löschen
        await deleteLfsBinary(obj.oid);
      } catch (err) {
        console.warn(`LFS-Upload fehlgeschlagen (${obj.oid}):`, err);
        // Bleibt in IndexedDB für nächsten Versuch
        uploadFailed = true;
      }
    }

    if (uploadFailed) {
      throw new Error('Mindestens ein LFS-Upload ist fehlgeschlagen und bleibt ausstehend');
    }
  }

  /**
   * Lädt ein Binary vom LFS-Server herunter.
   *
   * @param pointer LFS-Pointer-Objekt
   * @param gitPath Pfad im Git-Repo (für den Cache)
   */
  async download(pointer: Pointer, gitPath: string): Promise<Uint8Array> {
    if (!this.config) {
      throw new Error('LFS-Client nicht konfiguriert');
    }

    const lfsUrl = deriveLfsUrl(this.config.repoUrl);
    const authHeader = basicAuthHeader(this.config.username, this.config.token);

    const batchResponse = await fetch(`${lfsUrl}/objects/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.git-lfs+json',
        'Accept': 'application/vnd.git-lfs+json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        operation: 'download',
        transfers: ['basic'],
        objects: [{ oid: pointer.oid, size: pointer.size }]
      })
    });
    if (!batchResponse.ok) {
      throw new Error(`LFS Batch-API fehlgeschlagen: ${batchResponse.status} ${batchResponse.statusText}`);
    }

    const batchData = await batchResponse.json() as {
      objects?: Array<{
        oid: string;
        errors?: Array<{ code: number; message: string }>;
        actions?: { download?: LfsAction };
      }>;
    };
    const object = batchData.objects?.find(entry => entry.oid === pointer.oid);
    if (!object) throw new Error(`LFS-Objekt nicht gefunden: ${pointer.oid}`);
    if (object.errors?.length) {
      throw new Error(`LFS-Download fehlgeschlagen: ${object.errors[0].message}`);
    }
    const action = object.actions?.download;
    if (!action?.href) throw new Error(`Keine Download-URL für LFS-Objekt: ${pointer.oid}`);

    const response = await fetch(action.href, {
      method: 'GET',
      headers: action.header ?? {}
    });

    if (!response.ok) {
      throw new Error(`LFS-Download fehlgeschlagen: ${response.status} ${response.statusText}`);
    }

    const data = new Uint8Array(await response.arrayBuffer());
    // Im Cache speichern für Vorschau
    this.cache.set(gitPath, data);
    return data;
  }

  /**
   * Liest ein noch nicht synchronisiertes Binary aus der persistenten Queue.
   */
  async readStagedBinary(oid: string): Promise<Uint8Array | null> {
    const entry = await getLfsBinary(oid);
    return entry?.data ?? null;
  }

  /**
   * Gibt das gecachte Binary für einen Git-Pfad zurück.
   * (In-Memory-Only, nicht persistent)
   */
  getCached(gitPath: string): Uint8Array | undefined {
    return this.cache.get(gitPath);
  }

  /**
   * Speichert ein Binary im Cache (z.B. nach manuellem Download).
   */
  setCached(gitPath: string, data: Uint8Array): void {
    this.cache.set(gitPath, data);
  }

  /**
   * Entfernt ein Binary aus dem Cache.
   */
  removeCached(gitPath: string): void {
    this.cache.delete(gitPath);
  }

  /**
   * Leert den in-memory Cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}