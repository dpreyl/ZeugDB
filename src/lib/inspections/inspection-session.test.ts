import { describe, expect, it } from 'vitest';
import { loadInspectionSession, saveInspectionSession } from './inspection-session';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

describe('DGUV assistant session', () => {
  it('remembers examiner and selected room', () => {
    const storage = createStorage();
    saveInspectionSession({ examiner: 'Alex Prüfer', locationId: 'raum-2' }, storage);

    expect(loadInspectionSession(storage)).toEqual({
      examiner: 'Alex Prüfer',
      locationId: 'raum-2'
    });
  });

  it('returns empty defaults for missing or invalid saved state', () => {
    expect(loadInspectionSession(createStorage())).toEqual({ examiner: '', locationId: '' });
    expect(loadInspectionSession(createStorage({ 'zeugdb:dguv-session': '{invalid' })))
      .toEqual({ examiner: '', locationId: '' });
  });
});
