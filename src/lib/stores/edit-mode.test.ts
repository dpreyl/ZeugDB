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

beforeEach(() => {
  resetEditMode();
  Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
});

describe('EditMode', () => {
  it('startet im Read-Only Modus', () => {
    const mode = getEditMode();
    expect(mode.isEditing).toBe(false);
    expect(mode.branch).toBeNull();
  });

  it('erlaubt Übergang in Edit-Modus mit Branch-Namen', () => {
    const mode = getEditMode();
    mode.enterEditMode('test-user', 'test-email');
    expect(mode.isEditing).toBe(true);
    expect(mode.branch).toMatch(/^edit\/test-user/);
  });

  it('verwirft Änderungen und kehrt zu Read-Only zurück', () => {
    const mode = getEditMode();
    mode.enterEditMode('test-user', 'test-email');
    mode.discard();
    expect(mode.isEditing).toBe(false);
    expect(mode.branch).toBeNull();
  });

  it('verhindert doppelten Edit-Modus', () => {
    const mode = getEditMode();
    mode.enterEditMode('test-user', 'test-email');
    const branch = mode.branch;
    mode.enterEditMode('other-user', 'other@email');
    expect(mode.branch).toBe(branch); // unverändert
  });
});

