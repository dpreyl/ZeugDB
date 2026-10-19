import { describe, it, expect, beforeEach } from 'vitest';
import { getSyncMeta, resetSyncMeta } from './sync-meta.svelte';

const STORAGE_KEY = 'zeugdb:syncMeta';

// localStorage mock
const mockStorage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; }
  },
  writable: true
});

beforeEach(() => {
  resetSyncMeta();
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
});

describe('SyncMetaStore', () => {
  it('startet ohne Sync-Daten', () => {
    const meta = getSyncMeta();
    expect(meta.lastSyncAt).toBeNull();
    expect(meta.lastSyncType).toBeNull();
    expect(meta.getFormattedTimestamp()).toBeNull();
  });

  it('lädt persistierte Sync-Daten beim Start', () => {
    const ts = new Date('2025-07-15T10:30:00Z');
    mockStorage[STORAGE_KEY] = JSON.stringify({ lastSyncAt: ts.toISOString(), lastSyncType: 'pull' });
    const meta = getSyncMeta();
    expect(meta.lastSyncAt).toBeInstanceOf(Date);
    expect(meta.lastSyncType).toBe('pull');
  });

  it('speichert neuen Sync-Zeitstempel persistent', () => {
    const meta = getSyncMeta();
    const ts = new Date('2025-07-15T14:22:00Z');
    meta.update(ts, 'push');

    // Singleton cached — neue Instanz liest aus localStorage
    resetSyncMeta();
    const fresh = getSyncMeta();
    expect(fresh.lastSyncAt).toBeInstanceOf(Date);
    expect(fresh.lastSyncType).toBe('push');
  });

  it('formatiert Zeitstempel als DD.MM.YYYY HH:MM', () => {
    const meta = getSyncMeta();
    // UTC+0: 15.07.2025 10:30 — aber getFormattedTimestamp nutzt lokale Zeitzone
    // Daher Test mit explizitem Datum, das unabhängig von TZ funktioniert
    meta.update(new Date('2025-07-15T10:30:00Z'), 'sync');
    const formatted = meta.getFormattedTimestamp();
    expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/);
  });

  it('setzt Metadaten bei reset zurück', () => {
    const meta = getSyncMeta();
    meta.update(new Date('2025-01-01T00:00:00Z'), 'pull');
    expect(meta.lastSyncAt).not.toBeNull();
    meta.reset();
    expect(meta.lastSyncAt).toBeNull();
    expect(meta.lastSyncType).toBeNull();
    expect(mockStorage[STORAGE_KEY]).toBeUndefined();
  });

  it('verwendet aktuellen Zeitstempel als Default', () => {
    const meta = getSyncMeta();
    const before = new Date();
    meta.update();
    const after = new Date();
    expect(meta.lastSyncAt).toBeInstanceOf(Date);
    expect(meta.lastSyncAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(meta.lastSyncAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('unterstützt drei Sync-Typen', () => {
    const meta = getSyncMeta();
    meta.update(new Date('2025-01-01T00:00:00Z'), 'pull');
    expect(meta.lastSyncType).toBe('pull');
    meta.update(new Date('2025-01-01T01:00:00Z'), 'push');
    expect(meta.lastSyncType).toBe('push');
    meta.update(new Date('2025-01-01T02:00:00Z'), 'sync');
    expect(meta.lastSyncType).toBe('sync');
  });

  it('ignoriert korrupte localStorage-Daten', () => {
    mockStorage[STORAGE_KEY] = 'nicht-json';
    const meta = getSyncMeta();
    expect(meta.lastSyncAt).toBeNull();
    expect(meta.lastSyncType).toBeNull();
  });
});

