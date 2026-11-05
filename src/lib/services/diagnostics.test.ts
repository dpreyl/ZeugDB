import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDiagnosticLogs,
  getDiagnosticLogs,
  logDiagnostic,
  subscribeDiagnosticLogs
} from './diagnostics';

describe('diagnostics', () => {
  beforeEach(() => {
    localStorage.clear();
    clearDiagnosticLogs();
  });

  it('keeps log entries in order and persists them between page loads', () => {
    logDiagnostic('info', 'Synchronisierung gestartet');
    logDiagnostic('warn', 'Vorschau konnte nicht gespeichert werden');

    expect(getDiagnosticLogs().map(({ level, message }) => [level, message])).toEqual([
      ['info', 'Synchronisierung gestartet'],
      ['warn', 'Vorschau konnte nicht gespeichert werden']
    ]);
    expect(JSON.parse(localStorage.getItem('zeugdb-diagnostics') ?? '[]')).toHaveLength(2);
  });

  it('limits the log size and message length', () => {
    for (let index = 0; index < 205; index += 1) {
      logDiagnostic('info', `Eintrag ${index}`);
    }
    logDiagnostic('error', 'x'.repeat(1500));

    const entries = getDiagnosticLogs();
    expect(entries).toHaveLength(200);
    expect(entries[0].message).toBe('Eintrag 6');
    expect(entries.at(-1)?.message).toHaveLength(1000);
  });

  it('notifies subscribers when entries are added or cleared', () => {
    const updates: number[] = [];
    const unsubscribe = subscribeDiagnosticLogs((entries) => updates.push(entries.length));
    logDiagnostic('error', 'Sync fehlgeschlagen');
    clearDiagnosticLogs();
    unsubscribe();
    logDiagnostic('info', 'Nach Abmeldung');

    expect(updates).toEqual([0, 1, 0]);
  });
});
