/**
 * IndexedDB-Persistenzschicht für LFS-Binaries.
 *
 * Speichert Binaries zwischen Upload und Sync-Push.
 * Überlebt Page-Reloads — löst das In-Memory-Problem.
 *
 * Key = SHA-256 OID des Binaries.
 * Value = { oid, size, data: ArrayBuffer }.
 */

const DB_NAME = 'ZeugDB.LFS';
const DB_VERSION = 2;
const STORE_NAME = 'entries';
const PREVIEW_STORE_NAME = 'previews';

interface LfsEntry {
  oid: string;
  size: number;
  data: ArrayBuffer;
}

let _db: IDBDatabase | null = null;

async function openDb(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'oid' });
      }
      if (!db.objectStoreNames.contains(PREVIEW_STORE_NAME)) {
        db.createObjectStore(PREVIEW_STORE_NAME, { keyPath: 'oid' });
      }
    };
    request.onsuccess = () => {
      _db = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Speichert ein Binary in IndexedDB. Bestehende Einträge mit gleichem
 * OID werden überschrieben.
 */
export async function putLfsBinary(oid: string, size: number, data: Uint8Array): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const entry: LfsEntry = { oid, size, data: data.buffer.slice(0, data.byteLength) as ArrayBuffer };
  store.put(entry);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Liest ein Binary aus IndexedDB. Gibt null wenn nicht gefunden.
 */
export async function getLfsBinary(oid: string): Promise<{ oid: string; size: number; data: Uint8Array } | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.get(oid);
  return new Promise<{ oid: string; size: number; data: Uint8Array } | null>((resolve) => {
    req.onsuccess = () => {
      const entry = req.result as LfsEntry | undefined;
      if (!entry) return resolve(null);
      resolve({
        oid: entry.oid,
        size: entry.size,
        data: new Uint8Array(entry.data)
      });
    };
    req.onerror = () => resolve(null);
  });
}

/**
 * Liest alle Binaries aus IndexedDB.
 */
export async function getAllLfsBinaries(): Promise<{ oid: string; size: number; data: Uint8Array }[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();
  return new Promise<{ oid: string; size: number; data: Uint8Array }[]>((resolve) => {
    req.onsuccess = () => {
      const entries = req.result as LfsEntry[];
      resolve(entries.map(e => ({
        oid: e.oid,
        size: e.size,
        data: new Uint8Array(e.data)
      })));
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Löscht ein Binary aus IndexedDB.
 */
export async function deleteLfsBinary(oid: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(oid);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Löscht alle Binaries aus IndexedDB.
 */
export async function clearLfsBinaries(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.clear();
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Speichert ein heruntergeladenes Vorschaubild unabhängig von Upload-Queues.
 */
export async function putLfsPreview(oid: string, data: Uint8Array): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PREVIEW_STORE_NAME, 'readwrite');
  tx.objectStore(PREVIEW_STORE_NAME).put({
    oid,
    size: data.byteLength,
    data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  });
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Liest ein persistent gespeichertes Vorschaubild.
 */
export async function getLfsPreview(oid: string): Promise<Uint8Array | null> {
  const db = await openDb();
  const tx = db.transaction(PREVIEW_STORE_NAME, 'readonly');
  const req = tx.objectStore(PREVIEW_STORE_NAME).get(oid);
  return new Promise<Uint8Array | null>((resolve) => {
    req.onsuccess = () => {
      const entry = req.result as LfsEntry | undefined;
      resolve(entry ? new Uint8Array(entry.data) : null);
    };
    req.onerror = () => resolve(null);
  });
}

/**
 * Entfernt ein Vorschaubild aus dem lokalen Cache.
 */
export async function deleteLfsPreview(oid: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PREVIEW_STORE_NAME, 'readwrite');
  tx.objectStore(PREVIEW_STORE_NAME).delete(oid);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Test-Hilfe: schließt die DB-Verbindung und nullt den Cache.
 */
export function closeLfsDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}