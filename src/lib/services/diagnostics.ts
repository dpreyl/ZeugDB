export type DiagnosticLevel = 'info' | 'warn' | 'error';

export interface DiagnosticEntry {
  timestamp: string;
  level: DiagnosticLevel;
  message: string;
}

const STORAGE_KEY = 'zeugdb-diagnostics';
const MAX_ENTRIES = 200;
const MAX_MESSAGE_LENGTH = 1000;

let entries: DiagnosticEntry[] = [];
let loaded = false;
const listeners = new Set<(entries: DiagnosticEntry[]) => void>();

function readStoredEntries(): DiagnosticEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is DiagnosticEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.timestamp === 'string' &&
      (entry.level === 'info' || entry.level === 'warn' || entry.level === 'error') &&
      typeof entry.message === 'string'
    ).slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

function ensureLoaded(): void {
  if (loaded) return;
  entries = readStoredEntries();
  loaded = true;
}

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Diagnostics bleiben mindestens bis zum nächsten Seitenwechsel im Speicher.
  }
}

function notify(): void {
  const snapshot = getDiagnosticLogs();
  for (const listener of listeners) listener(snapshot);
}

export function getDiagnosticLogs(): DiagnosticEntry[] {
  ensureLoaded();
  return entries.map((entry) => ({ ...entry }));
}

export function logDiagnostic(level: DiagnosticLevel, message: string): void {
  ensureLoaded();
  const text = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return;
  entries = [
    ...entries,
    { timestamp: new Date().toISOString(), level, message: text }
  ].slice(-MAX_ENTRIES);
  persist();
  notify();
}

export function clearDiagnosticLogs(): void {
  entries = [];
  loaded = true;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Leeren des sichtbaren Logs soll nicht von Storage-Rechten abhängen.
    }
  }
  notify();
}

export function subscribeDiagnosticLogs(
  listener: (entries: DiagnosticEntry[]) => void
): () => void {
  listeners.add(listener);
  listener(getDiagnosticLogs());
  return () => listeners.delete(listener);
}
