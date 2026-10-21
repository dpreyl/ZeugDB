import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRemote, resetGitRepo, type GitConfig } from './git.service';
import * as repoModule from '$lib/git/repo';

beforeEach(() => {
  vi.stubGlobal('indexedDB', {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockGitRepo(implementation: Partial<repoModule.GitRepo>): void {
  vi.spyOn(repoModule, 'GitRepo').mockImplementation(function () {
    return implementation as repoModule.GitRepo;
  });
}

describe('git.service — fetchRemote', () => {
  beforeEach(async () => {
    resetGitRepo();
    const editModule = await import('$lib/stores/edit-mode.svelte');
    vi.spyOn(editModule, 'getEditMode').mockReturnValue({
      isEditing: false,
      branch: null,
      username: null,
      enterEditMode: () => {},
      discard: () => {},
      finishEdit: () => {}
    } as unknown as import('$lib/stores/edit-mode.svelte').EditMode);

    const syncMetaModule = await import('$lib/stores/sync-meta.svelte');
    vi.spyOn(syncMetaModule, 'getSyncMeta').mockReturnValue({
      lastSyncAt: null,
      lastSyncType: null,
      update: vi.fn(),
      getFormattedTimestamp: () => null,
      reset: vi.fn()
    } as unknown as import('$lib/stores/sync-meta.svelte').SyncMetaStore);

    const initModule = await import('./init');
    vi.spyOn(initModule, 'persistStore').mockImplementation(() => {});
  });

  afterEach(() => {
    resetGitRepo();
    vi.restoreAllMocks();
  });

  it('fetcht und pullt im Read-Only-Modus', async () => {
    const mockFetch = vi.fn().mockResolvedValue(undefined);
    const mockPull = vi.fn().mockResolvedValue(undefined);
    const mockCheckout = vi.fn().mockResolvedValue(undefined);
    const mockReaddir = vi.fn().mockResolvedValue([]);
    mockGitRepo({
      fetchFromRemote: mockFetch,
      pull: mockPull,
      checkoutBranch: mockCheckout,
      readdir: mockReaddir
    });

    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    await fetchRemote(config, 'Author', 'author@example.com');

    expect(mockFetch).toHaveBeenCalled();
    expect(mockCheckout).toHaveBeenCalledWith('main');
    expect(mockPull).toHaveBeenCalledWith(expect.objectContaining({ branch: 'main' }));
    expect(mockCheckout.mock.invocationCallOrder[0]).toBeLessThan(mockPull.mock.invocationCallOrder[0]);
  });

  it('mergt origin/main im Edit-Modus', async () => {
    const mockFetch = vi.fn().mockResolvedValue(undefined);
    const mockMerge = vi.fn().mockResolvedValue(undefined);
    const mockReaddir = vi.fn().mockResolvedValue([]);
    mockGitRepo({
      fetchFromRemote: mockFetch,
      mergeBranch: mockMerge,
      readdir: mockReaddir
    });

    const editModule = await import('$lib/stores/edit-mode.svelte');
    vi.spyOn(editModule, 'getEditMode').mockReturnValue({
      isEditing: true,
      branch: 'edit/user-20250101',
      username: 'testuser',
      enterEditMode: () => {},
      discard: () => {},
      finishEdit: () => {}
    } as unknown as import('$lib/stores/edit-mode.svelte').EditMode);

    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    await fetchRemote(config, 'Author', 'author@example.com');

    expect(mockFetch).toHaveBeenCalled();
    expect(mockMerge).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'origin/main' })
    );
  });

  it('aktualisiert den Sync-Meta-Timestamp', async () => {
    const mockFetch = vi.fn().mockResolvedValue(undefined);
    const mockPull = vi.fn().mockResolvedValue(undefined);
    const mockCheckout = vi.fn().mockResolvedValue(undefined);
    const mockReaddir = vi.fn().mockResolvedValue([]);
    mockGitRepo({
      fetchFromRemote: mockFetch,
      pull: mockPull,
      checkoutBranch: mockCheckout,
      readdir: mockReaddir
    });

    const syncMetaModule = await import('$lib/stores/sync-meta.svelte');
    const syncMeta = syncMetaModule.getSyncMeta();
    const updateSpy = vi.spyOn(syncMeta, 'update');
    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    await fetchRemote(config, 'Author', 'author@example.com');

    expect(updateSpy).toHaveBeenCalledWith(expect.any(Date), 'pull');
  });
});
