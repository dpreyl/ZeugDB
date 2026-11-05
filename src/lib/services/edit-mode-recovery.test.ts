import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const repo = {
    isInitialized: vi.fn(),
    getCurrentBranch: vi.fn(),
    status: vi.fn(),
    createBranch: vi.fn(),
    checkoutBranch: vi.fn()
  };
  const storeChanges = {
    hasLocalStoreChanges: vi.fn()
  };
  const editMode = {
    isEditing: false,
    branch: null as string | null,
    enterEditMode: vi.fn(() => {
      editMode.isEditing = true;
      editMode.branch = 'edit/recovered-session';
    }),
    resumeEditMode: vi.fn((branch: string) => {
      editMode.isEditing = true;
      editMode.branch = branch;
    }),
    discard: vi.fn(() => {
      editMode.isEditing = false;
      editMode.branch = null;
    })
  };
  return { repo, editMode, storeChanges };
});

vi.mock('./git.service', () => ({
  getGitRepo: vi.fn(async () => mocks.repo)
}));
vi.mock('$lib/stores/edit-mode.svelte', () => ({
  getEditMode: () => mocks.editMode
}));
vi.mock('./store-git-diff', () => ({
  hasLocalStoreChanges: (...args: unknown[]) => mocks.storeChanges.hasLocalStoreChanges(...args)
}));

import { recoverEditMode } from './edit-mode-recovery';

describe('recoverEditMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editMode.isEditing = false;
    mocks.editMode.branch = null;
    mocks.repo.isInitialized.mockResolvedValue(true);
    mocks.repo.getCurrentBranch.mockResolvedValue('main');
    mocks.repo.status.mockResolvedValue([]);
    mocks.repo.createBranch.mockResolvedValue(undefined);
    mocks.repo.checkoutBranch.mockResolvedValue(undefined);
    mocks.storeChanges.hasLocalStoreChanges.mockResolvedValue(false);
  });

  it('stellt einen aktiven Edit-Branch auch ohne Session-Daten wieder her', async () => {
    mocks.repo.getCurrentBranch.mockResolvedValue('edit/test-user-20250101-session');

    await recoverEditMode('test-user');

    expect(mocks.editMode.resumeEditMode).toHaveBeenCalledWith(
      'edit/test-user-20250101-session',
      'test-user'
    );
    expect(mocks.repo.createBranch).not.toHaveBeenCalled();
  });

  it('legt bei uncommitteten Änderungen auf main einen Edit-Branch an', async () => {
    mocks.repo.status.mockResolvedValue([{ file: 'assets/item.asset' }]);

    await recoverEditMode('test-user');

    expect(mocks.repo.createBranch).toHaveBeenCalledWith('edit/recovered-session');
    expect(mocks.repo.checkoutBranch).toHaveBeenCalledWith('edit/recovered-session');
    expect(mocks.editMode.isEditing).toBe(true);
  });

  it('stellt den Schreibmodus wieder her, wenn gespeicherte Store-Daten noch nicht in Git sind', async () => {
    mocks.storeChanges.hasLocalStoreChanges.mockResolvedValue(true);

    await recoverEditMode('test-user');

    expect(mocks.repo.createBranch).toHaveBeenCalledWith('edit/recovered-session');
    expect(mocks.repo.checkoutBranch).toHaveBeenCalledWith('edit/recovered-session');
    expect(mocks.editMode.isEditing).toBe(true);
  });

  it('blockiert die Wiederherstellung bei einem Fehler im Datenvergleich', async () => {
    mocks.storeChanges.hasLocalStoreChanges.mockRejectedValue(new Error('repository read failed'));

    await expect(recoverEditMode('test-user')).rejects.toThrow('repository read failed');

    expect(mocks.repo.createBranch).not.toHaveBeenCalled();
    expect(mocks.repo.checkoutBranch).not.toHaveBeenCalled();
  });

  it('ändert einen sauberen main-Branch nicht', async () => {
    await recoverEditMode('test-user');

    expect(mocks.editMode.enterEditMode).not.toHaveBeenCalled();
    expect(mocks.repo.createBranch).not.toHaveBeenCalled();
  });

  it('entfernt den vorläufigen Edit-Modus, wenn der Branchwechsel fehlschlägt', async () => {
    mocks.repo.status.mockResolvedValue([{ file: 'assets/item.asset' }]);
    mocks.repo.checkoutBranch.mockRejectedValue(new Error('checkout failed'));

    await expect(recoverEditMode('test-user')).rejects.toThrow('checkout failed');

    expect(mocks.editMode.discard).toHaveBeenCalledOnce();
  });
});
