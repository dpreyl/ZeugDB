import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSyncStatus, resetGitRepo, syncEditBranch } from './git.service';
import * as repoModule from '$lib/git/repo';
import * as assetStoreModule from '$lib/stores/assets.store.svelte';
import * as locationStoreModule from '$lib/stores/locations.store.svelte';
import * as typeStoreModule from '$lib/stores/types.store.svelte';
import * as fotoStoreModule from '$lib/stores/fotos.store.svelte';
import { resetAssetStore } from '$lib/stores/assets.store.svelte';

beforeEach(() => {
  vi.stubGlobal('indexedDB', {});
  resetGitRepo();
});

afterEach(() => {
  resetGitRepo();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockGitRepo(implementation: Partial<repoModule.GitRepo>): void {
  vi.spyOn(repoModule, 'GitRepo').mockImplementation(function () {
    return { status: vi.fn().mockResolvedValue([]), ...implementation } as repoModule.GitRepo;
  });
}

describe('syncEditBranch', () => {
  it('archives save commits before checkout and deletes the edit branch only after push', async () => {
    const fetch = vi.fn().mockResolvedValue(undefined);
    const checkout = vi.fn().mockResolvedValue(undefined);
    const merge = vi.fn().mockResolvedValue(undefined);
    const push = vi.fn().mockResolvedValue([]);
    const readdir = vi.fn().mockResolvedValue([]);
    const deleteBranch = vi.fn().mockResolvedValue(undefined);
    const archiveBranch = vi.fn().mockResolvedValue(undefined);
    mockGitRepo({ fetchFromRemote: fetch, checkoutBranch: checkout, mergeBranch: merge, push, readdir, deleteBranch, archiveBranch });

    vi.spyOn(assetStoreModule, 'getAssetStore').mockReturnValue({
      all: [], findFull: vi.fn(), setAll: vi.fn()
    } as unknown as ReturnType<typeof assetStoreModule.getAssetStore>);
    vi.spyOn(locationStoreModule, 'getLocationsStore').mockReturnValue({
      all: [], clear: vi.fn(), add: vi.fn()
    } as unknown as ReturnType<typeof locationStoreModule.getLocationsStore>);
    vi.spyOn(typeStoreModule, 'getTypesStore').mockReturnValue({
      all: [], clear: vi.fn(), add: vi.fn()
    } as unknown as ReturnType<typeof typeStoreModule.getTypesStore>);
    const editModeModule = await import('$lib/stores/edit-mode.svelte');
    const editMode = {
      isEditing: true, branch: 'edit/test-user-session', username: 'test-user', finishEdit: vi.fn()
    };
    const flushPendingLfs = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fotoStoreModule, 'getFotoStore').mockReturnValue({
      flushPendingLfs,
      syncPreviews: vi.fn().mockResolvedValue({ downloaded: 0, skipped: true })
    } as unknown as ReturnType<typeof fotoStoreModule.getFotoStore>);
    vi.spyOn(editModeModule, 'getEditMode').mockReturnValue(
      editMode as unknown as import('$lib/stores/edit-mode.svelte').EditMode
    );

    const config = { url: 'http://phone-lan/repo', username: 'test', token: 'token' };
    await syncEditBranch(config, 'Author', 'author@example.com');

    expect(fetch).toHaveBeenCalledWith({
      url: config.url,
      auth: { username: config.username, token: config.token }
    });
    expect(archiveBranch).toHaveBeenCalledWith('edit/test-user-session', 'history/test-user-session');
    expect(archiveBranch.mock.invocationCallOrder[0]).toBeLessThan(checkout.mock.invocationCallOrder[0]);
    expect(merge).toHaveBeenNthCalledWith(1, expect.objectContaining({ branch: 'origin/main' }));
    expect(merge).toHaveBeenNthCalledWith(2, expect.objectContaining({
      branch: 'edit/test-user-session', squash: true
    }));
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ url: config.url, branch: 'main' }));
    expect(flushPendingLfs).toHaveBeenCalledOnce();
    expect(checkout).toHaveBeenLastCalledWith('main', true);
    expect(deleteBranch.mock.invocationCallOrder[0]).toBeGreaterThan(push.mock.invocationCallOrder[0]);
    expect(editMode.finishEdit).toHaveBeenCalledOnce();
  });
});

describe('getSyncStatus', () => {
  it('reports initialized repository status and local changes', async () => {
    mockGitRepo({
      isInitialized: () => Promise.resolve(true),
      getRemoteUrl: () => Promise.resolve('http://example.com/repo.git'),
      status: () => Promise.resolve([{ file: 'test.txt', before: null, after: 2 }])
    });

    const status = await getSyncStatus();
    expect(status.initialized).toBe(true);
    expect(status.remoteUrl).toBe('http://example.com/repo.git');
    expect(status.hasChanges).toBe(true);
  });

  it('reports an uninitialized repository', async () => {
    mockGitRepo({ isInitialized: () => Promise.resolve(false) });

    const status = await getSyncStatus();
    expect(status.initialized).toBe(false);
    expect(status.remoteUrl).toBeUndefined();
    expect(status.hasChanges).toBe(false);
  });

  it('reports asset-store data as a local change even when Git is clean', async () => {
    resetAssetStore();
    assetStoreModule.getAssetStore().createAsset({
      id: 'asset-local-only',
      type: 'projektor',
      fields: { bezeichnung: 'Noch nicht synchronisiert' }
    });
    mockGitRepo({
      isInitialized: () => Promise.resolve(true),
      getRemoteUrl: () => Promise.resolve('http://example.com/repo.git'),
      status: () => Promise.resolve([]),
      readdir: vi.fn().mockResolvedValue([])
    });

    const status = await getSyncStatus();

    expect(status.hasChanges).toBe(true);
    resetAssetStore();
  });
});
