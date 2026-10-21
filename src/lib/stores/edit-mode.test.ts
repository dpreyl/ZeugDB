import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEditMode, resetEditMode } from './edit-mode.svelte';

// In test environment, mock localStorage
const mockLocalStorage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockLocalStorage[key] = val; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; }
  }
});
const mockSessionStorage: Record<string, string> = {};
Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    getItem: (key: string) => mockSessionStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockSessionStorage[key] = val; },
    removeItem: (key: string) => { delete mockSessionStorage[key]; }
  }
});

beforeEach(() => {
  resetEditMode();
  Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
  Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]);
});

describe('EditMode', () => {
  it('startet im Read-Only Modus', () => {
    const mode = getEditMode();
    expect(mode.isEditing).toBe(false);
    expect(mode.branch).toBeNull();
  });

  it('ignoriert ungültige gespeicherte Edit-Sitzungsdaten', () => {
    mockSessionStorage['zeugdb:edit-session'] = JSON.stringify({
      branch: 'main',
      username: 'test-user'
    });

    const mode = getEditMode();

    expect(mode.isEditing).toBe(false);
    expect(mode.branch).toBeNull();
    expect(sessionStorage.getItem('zeugdb:edit-session')).toBeNull();
  });

  it('erlaubt Übergang in Edit-Modus mit Branch-Namen', () => {
    const mode = getEditMode();
    mode.enterEditMode('test-user', 'test-email');
    expect(mode.isEditing).toBe(true);
    expect(mode.branch).toMatch(/^edit\/test-user/);
  });

  it('setzt eine aktive Edit-Sitzung nach einem Neuladen im selben Tab fort', () => {
    const mode = getEditMode();
    mode.enterEditMode('test-user', 'test-email');
    const branch = mode.branch;

    resetEditMode();
    const restored = getEditMode();

    expect(restored.isEditing).toBe(true);
    expect(restored.branch).toBe(branch);
    expect(restored.username).toBe('test-user');
  });

  it('erstellt für mehrere Sitzungen am selben Tag unterschiedliche Branches', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('session-one')
        .mockReturnValueOnce('session-two')
    });
    const mode = getEditMode();

    mode.enterEditMode('test-user', 'test-email');
    const firstBranch = mode.branch;
    mode.finishEdit();
    expect(sessionStorage.getItem('zeugdb:edit-session')).toBeNull();
    mode.enterEditMode('test-user', 'test-email');

    expect(mode.branch).not.toBe(firstBranch);
    expect(firstBranch).toMatch(/^edit\/test-user-\d{8}-session-one$/);
    expect(mode.branch).toMatch(/^edit\/test-user-\d{8}-session-two$/);
    vi.unstubAllGlobals();
  });

  it('verwirft Änderungen und kehrt zu Read-Only zurück', () => {
    const mode = getEditMode();
    mode.enterEditMode('test-user', 'test-email');
    mode.discard();
    expect(mode.isEditing).toBe(false);
    expect(mode.branch).toBeNull();
    expect(sessionStorage.getItem('zeugdb:edit-session')).toBeNull();
  });

  it('verhindert doppelten Edit-Modus', () => {
    const mode = getEditMode();
    mode.enterEditMode('test-user', 'test-email');
    const branch = mode.branch;
    mode.enterEditMode('other-user', 'other@email');
    expect(mode.branch).toBe(branch); // unverändert
  });
});

