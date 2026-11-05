import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  commitAllToGit: vi.fn(),
  getGitRepo: vi.fn(),
  getCurrentBranch: vi.fn(),
  persistStore: vi.fn(),
  editMode: {
    isEditing: true,
    branch: 'edit/test-user-session',
    username: 'test-user'
  }
}));

vi.mock('./git.service', () => ({
  commitAllToGit: mocks.commitAllToGit,
  getGitRepo: mocks.getGitRepo
}));

vi.mock('./init', () => ({
  persistStore: mocks.persistStore
}));

vi.mock('../stores/edit-mode.svelte', () => ({
  getEditMode: () => mocks.editMode
}));

import { saveStoreChanges } from './store-save';

describe('saveStoreChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editMode.isEditing = true;
    mocks.editMode.branch = 'edit/test-user-session';
    mocks.editMode.username = 'test-user';
    mocks.getCurrentBranch.mockResolvedValue('edit/test-user-session');
    mocks.getGitRepo.mockResolvedValue({ getCurrentBranch: mocks.getCurrentBranch });
    mocks.commitAllToGit.mockResolvedValue('commit-sha');
  });

  afterEach(() => vi.restoreAllMocks());

  it('persists and creates a local commit on the active edit branch for each save', async () => {
    await expect(saveStoreChanges('DGUV-Prüfung gespeichert')).resolves.toBe('commit-sha');

    expect(mocks.persistStore).toHaveBeenCalledOnce();
    expect(mocks.commitAllToGit).toHaveBeenCalledWith(
      'DGUV-Prüfung gespeichert',
      'test-user',
      'test-user@zeugdb.local'
    );
  });

  it('refuses to commit when the repository is not on the active edit branch', async () => {
    mocks.getCurrentBranch.mockResolvedValue('main');

    await expect(saveStoreChanges('Asset gespeichert'))
      .rejects.toThrow('Das lokale Repository ist nicht auf dem aktiven Edit-Branch');

    expect(mocks.persistStore).not.toHaveBeenCalled();
    expect(mocks.commitAllToGit).not.toHaveBeenCalled();
  });

  it('keeps the persisted local data and surfaces a commit failure', async () => {
    mocks.commitAllToGit.mockRejectedValue(new Error('IndexedDB nicht verfügbar'));

    await expect(saveStoreChanges('Asset gespeichert')).rejects.toThrow('IndexedDB nicht verfügbar');

    expect(mocks.persistStore).toHaveBeenCalledOnce();
    expect(mocks.commitAllToGit).toHaveBeenCalledOnce();
  });

  it('does not save or commit outside edit mode', async () => {
    mocks.editMode.isEditing = false;

    await expect(saveStoreChanges('Asset gespeichert'))
      .rejects.toThrow('Speichern ist nur im Änderungsmodus möglich');

    expect(mocks.persistStore).not.toHaveBeenCalled();
    expect(mocks.commitAllToGit).not.toHaveBeenCalled();
  });
});
