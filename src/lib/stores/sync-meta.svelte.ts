/**
 * Persistierte Sync-Metadaten.
 */
interface SyncMetaPersist {
  /** ISO-String des letzten erfolgreichen Sync-Zeitpunkts. */
  lastSyncAt: string;
  /** Art der Operation ('pull' | 'push' | 'sync'). */
  lastSyncType: 'pull' | 'push' | 'sync';
}

const STORAGE_KEY = 'zeugdb:syncMeta';

/**
 * Liest gespeicherte Sync-Metadaten.
 */
function loadSyncMeta(): SyncMetaPersist | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncMetaPersist;
  } catch {
    return null;
  }
}

/**
 * Speichert Sync-Metadaten persistent.
 */
function persistSyncMeta(meta: SyncMetaPersist): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

/**
 * Reaktiver Store für Sync-Metadaten.
 */
export interface SyncMetaStore {
  /** Zeitstempel des letzten Syncs (Date-Objekt oder null). */
  lastSyncAt: Date | null;
  /** Art der letzten Operation. */
  lastSyncType: 'pull' | 'push' | 'sync' | null;

  /**
   * Aktualisiert den Sync-Zeitstempel.
   */
  update(timestamp?: Date, type?: 'pull' | 'push' | 'sync'): void;

  /**
   * Formatierter Zeitstempel für die UI (DD.MM.YYYY HH:MM) oder null.
   */
  getFormattedTimestamp(): string | null;

  /**
   * Setzt die Metadaten zurück.
   */
  reset(): void;
}

class SyncMetaImpl implements SyncMetaStore {
  public lastSyncAt: Date | null = $state(loadSyncMeta()?.lastSyncAt ? new Date(loadSyncMeta()!.lastSyncAt) : null);
  public lastSyncType: 'pull' | 'push' | 'sync' | null = $state(loadSyncMeta()?.lastSyncType ?? null);

  update(timestamp: Date = new Date(), type: 'pull' | 'push' | 'sync' = 'sync'): void {
    this.lastSyncAt = timestamp;
    this.lastSyncType = type;
    persistSyncMeta({ lastSyncAt: timestamp.toISOString(), lastSyncType: type });
  }

  getFormattedTimestamp(): string | null {
    if (!this.lastSyncAt) return null;
    const d = this.lastSyncAt;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hour}:${minute}`;
  }

  reset(): void {
    this.lastSyncAt = null;
    this.lastSyncType = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

let _instance: SyncMetaImpl | null = null;

/**
 * Gibt die Singleton-SyncMeta-Instanz zurück.
 */
export function getSyncMeta(): SyncMetaStore {
  if (!_instance) _instance = new SyncMetaImpl();
  return _instance;
}

/**
 * Reset für Tests.
 */
export function resetSyncMeta(): void {
  _instance = null;
}

