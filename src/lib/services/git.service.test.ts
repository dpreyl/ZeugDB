import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadGitConfig,
  saveGitConfig,
  pushToRemote,
  pullFromRemote,
  commitChanges,
  commitAllToGit,
  isRepoInitialized,
  getSyncStatus,
  resetGitRepo,
  fetchRemote,
  type GitConfig
} from './git.service';
import * as repoModule from '$lib/git/repo';
import * as assetStoreModule from '$lib/stores/assets.store.svelte';
import * as locationStoreModule from '$lib/stores/locations.store.svelte';

function mockGitRepo(implementation: Partial<repoModule.GitRepo>): void {
  vi.spyOn(repoModule, 'GitRepo').mockImplementation(function () {
    return implementation as repoModule.GitRepo;
  });
}

describe('git.service — Konfiguration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gibt null zurück, wenn keine Konfiguration gespeichert ist', () => {
    expect(loadGitConfig()).toBeNull();
  });

  it('liest eine gespeicherte Konfiguration', () => {
    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    saveGitConfig(config);
    expect(loadGitConfig()).toEqual(config);
  });

  it('überschreibt eine bestehende Konfiguration', () => {
    const config1: GitConfig = {
      url: 'http://old.com/repo.git',
      username: 'olduser',
      token: 'old-token'
    };
    saveGitConfig(config1);
    const config2: GitConfig = {
      url: 'http://new.com/repo.git',
      username: 'newuser',
      token: 'new-token'
    };
    saveGitConfig(config2);
    expect(loadGitConfig()).toEqual(config2);
  });

  it('gibt null bei korrupten Daten zurück', () => {
    localStorage.setItem('zeugdb:gitConfig', 'invalid json');
    expect(loadGitConfig()).toBeNull();
  });
});

describe('git.service — Push', () => {
  beforeEach(() => {
    resetGitRepo();
    vi.spyOn(repoModule, 'openGitDb').mockResolvedValue({} as IDBDatabase);
  });

  afterEach(() => {
    resetGitRepo();
    vi.restoreAllMocks();
  });

  it('übergibt Auth-Daten an repo.push', async () => {
    const progressCallback = vi.fn();
    const mockPush = vi.fn().mockResolvedValue([]);
    mockGitRepo({
      push: mockPush
    });

    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    await pushToRemote(config, 'main', progressCallback);

    expect(mockPush).toHaveBeenCalledWith({
      auth: { username: 'testuser', token: 'secret-token' },
      branch: 'main',
      onprogress: progressCallback
    });
  });

  it('akzeptiert optionalen Branch-Parameter', async () => {
    const mockPush = vi.fn().mockResolvedValue([]);
    mockGitRepo({
      push: mockPush
    });

    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    await pushToRemote(config);

    expect(mockPush).toHaveBeenCalledWith({
      auth: { username: 'testuser', token: 'secret-token' },
      branch: undefined,
      onprogress: undefined
    });
  });
});

describe('git.service — Pull', () => {
  beforeEach(() => {
    resetGitRepo();
    vi.spyOn(repoModule, 'openGitDb').mockResolvedValue({} as IDBDatabase);
  });

  afterEach(() => {
    resetGitRepo();
    vi.restoreAllMocks();
  });

  it('übergibt Auth- und Author-Daten an repo.pull', async () => {
    const mockPull = vi.fn().mockResolvedValue(undefined);
    mockGitRepo({
      pull: mockPull
    });

    // Mock syncAssetsToDb und persistStore
    const syncModule = await import('$lib/fs/repo-sync');
    vi.spyOn(syncModule, 'syncAssetsToDb').mockResolvedValue();
    const initModule = await import('./init');
    vi.spyOn(initModule, 'persistStore').mockImplementation(() => {});

    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    // Minimales Database-Mock für den Test
    const mockDb = {
      run: vi.fn(),
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn(),
        free: vi.fn()
      })
    } as unknown as import('../db').Database;
    await pullFromRemote(config, 'Author', 'author@example.com', mockDb);

    expect(mockPull).toHaveBeenCalledWith({
      auth: { username: 'testuser', token: 'secret-token' },
      author: { name: 'Author', email: 'author@example.com' },
      onprogress: undefined
    });
  });
});

describe('git.service — Commit', () => {
  beforeEach(() => {
    resetGitRepo();
    vi.spyOn(repoModule, 'openGitDb').mockResolvedValue({} as IDBDatabase);
  });

  afterEach(() => {
    resetGitRepo();
    vi.restoreAllMocks();
  });

  it('übergibt Message und Author an repo.commit', async () => {
    const mockCommit = vi.fn().mockResolvedValue('abc123');
    mockGitRepo({
      commit: mockCommit
    });

    await commitChanges('Test commit', 'Author', 'author@example.com', ['file.txt']);

    expect(mockCommit).toHaveBeenCalledWith({
      message: 'Test commit',
      authorName: 'Author',
      authorEmail: 'author@example.com',
      files: ['file.txt']
    });
  });

  it('gibt Commit-SHA zurück', async () => {
    const mockCommit = vi.fn().mockResolvedValue('deadbeef');
    mockGitRepo({
      commit: mockCommit
    });

    const sha = await commitChanges('Test', 'Author', 'a@b.com');
    expect(sha).toBe('deadbeef');
  });

  it('schreibt geänderte Standorte ins Git und committet nur diese Dateien', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const commit = vi.fn().mockResolvedValue('location-sha');
    mockGitRepo({
      readFile: vi.fn().mockRejectedValue(new Error('Datei fehlt')),
      writeFile,
      commit
    });
    vi.spyOn(assetStoreModule, 'getAssetStore').mockReturnValue({
      all: [],
      findFull: vi.fn()
    } as unknown as ReturnType<typeof assetStoreModule.getAssetStore>);
    vi.spyOn(locationStoreModule, 'getLocationsStore').mockReturnValue({
      all: [{ id: 'raum-101', name: 'Raum 101', art: 'raum', polygon: [
        { lat: 48.1, lon: 11.5 },
        { lat: 48.2, lon: 11.5 },
        { lat: 48.2, lon: 11.6 }
      ] }]
    } as unknown as ReturnType<typeof locationStoreModule.getLocationsStore>);

    await expect(commitAllToGit('Standort geändert', 'Autor', 'a@example.com'))
      .resolves.toBe('location-sha');

    expect(writeFile).toHaveBeenCalledWith(
      'locations/raum-101.location',
      expect.stringContaining('[polygon]')
    );
    expect(commit).toHaveBeenCalledWith({
      message: 'Standort geändert',
      authorName: 'Autor',
      authorEmail: 'a@example.com',
      files: ['locations/raum-101.location'],
      deletedFiles: []
    });
  });

  it('legt keinen leeren Commit an, wenn sich Standorte nicht geändert haben', async () => {
    const content = 'id: standort\nname: Lager';
    const commit = vi.fn();
    mockGitRepo({
      readFile: vi.fn().mockResolvedValue(content),
      writeFile: vi.fn(),
      commit
    });
    vi.spyOn(assetStoreModule, 'getAssetStore').mockReturnValue({
      all: [],
      findFull: vi.fn()
    } as unknown as ReturnType<typeof assetStoreModule.getAssetStore>);
    vi.spyOn(locationStoreModule, 'getLocationsStore').mockReturnValue({
      all: [{ id: 'standort', name: 'Lager' }]
    } as unknown as ReturnType<typeof locationStoreModule.getLocationsStore>);

    await expect(commitAllToGit('Keine Änderung', 'Autor', 'a@example.com')).resolves.toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });

  it('committet entfernte Standortdateien als Git-Löschung', async () => {
    const commit = vi.fn().mockResolvedValue('delete-sha');
    mockGitRepo({
      readFile: vi.fn().mockRejectedValue(new Error('Datei fehlt')),
      readdir: vi.fn().mockResolvedValue(['raum-101.location']),
      commit
    });
    vi.spyOn(assetStoreModule, 'getAssetStore').mockReturnValue({
      all: [],
      findFull: vi.fn()
    } as unknown as ReturnType<typeof assetStoreModule.getAssetStore>);
    vi.spyOn(locationStoreModule, 'getLocationsStore').mockReturnValue({
      all: []
    } as unknown as ReturnType<typeof locationStoreModule.getLocationsStore>);

    await expect(commitAllToGit('Standort gelöscht', 'Autor', 'a@example.com'))
      .resolves.toBe('delete-sha');

    expect(commit).toHaveBeenCalledWith({
      message: 'Standort gelöscht',
      authorName: 'Autor',
      authorEmail: 'a@example.com',
      files: [],
      deletedFiles: ['locations/raum-101.location']
    });
  });
});

describe('git.service — fetchRemote', () => {
  beforeEach(async () => {
    resetGitRepo();
    vi.spyOn(repoModule, 'openGitDb').mockResolvedValue({} as IDBDatabase);
    // Mock edit-mode
    const editModule = await import('$lib/stores/edit-mode.svelte');
    vi.spyOn(editModule, 'getEditMode').mockReturnValue({
      isEditing: false,
      branch: null,
      username: null,
      enterEditMode: () => {},
      discard: () => {},
      finishEdit: () => {}
    } as unknown as import('$lib/stores/edit-mode.svelte').EditMode);
    // Mock sync-meta
    const syncMetaModule = await import('$lib/stores/sync-meta.svelte');
    vi.spyOn(syncMetaModule, 'getSyncMeta').mockReturnValue({
      lastSyncAt: null,
      lastSyncType: null,
      update: vi.fn(),
      getFormattedTimestamp: () => null,
      reset: vi.fn()
    } as unknown as import('$lib/stores/sync-meta.svelte').SyncMetaStore);
    // Mock syncGitFsToStores via init.persistStore
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
    const mockReaddir = vi.fn().mockResolvedValue([]);
    mockGitRepo({
      fetchFromRemote: mockFetch,
      pull: mockPull,
      readdir: mockReaddir
    });

    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    await fetchRemote(config, 'Author', 'author@example.com');

    expect(mockFetch).toHaveBeenCalled();
    expect(mockPull).toHaveBeenCalled();
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

    // Edit-Mode aktivieren
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
    const mockReaddir = vi.fn().mockResolvedValue([]);
    mockGitRepo({
      fetchFromRemote: mockFetch,
      pull: mockPull,
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

describe('git.service — Status', () => {
  beforeEach(() => {
    resetGitRepo();
    vi.spyOn(repoModule, 'openGitDb').mockResolvedValue({} as IDBDatabase);
  });

  afterEach(() => {
    resetGitRepo();
    vi.restoreAllMocks();
  });

  it('gibt initialisierten Status zurück', async () => {
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

  it('gibt nicht-initialisierten Status zurück', async () => {
    mockGitRepo({
      isInitialized: () => Promise.resolve(false)
    });

    const status = await getSyncStatus();
    expect(status.initialized).toBe(false);
    expect(status.remoteUrl).toBeUndefined();
    expect(status.hasChanges).toBe(false);
  });
});
