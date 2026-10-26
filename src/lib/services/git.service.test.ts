import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadGitConfig,
  saveGitConfig,
  getGitRepo,
  cloneRepo,
  pushToRemote,
  pullFromRemote,
  commitChanges,
  commitAllToGit,
  isRepoInitialized,
  getSyncStatus,
  resetGitRepo,
  syncEditBranch,
  type GitConfig
} from './git.service';
import * as repoModule from '$lib/git/repo';
import * as assetStoreModule from '$lib/stores/assets.store.svelte';
import * as locationStoreModule from '$lib/stores/locations.store.svelte';
import * as typeStoreModule from '$lib/stores/types.store.svelte';
import * as fotoStoreModule from '$lib/stores/fotos.store.svelte';

beforeEach(() => {
  vi.stubGlobal('indexedDB', {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockGitRepo(implementation: Partial<repoModule.GitRepo>): void {
  vi.spyOn(repoModule, 'GitRepo').mockImplementation(function () {
    return {
      status: vi.fn().mockResolvedValue([]),
      ...implementation
    } as repoModule.GitRepo;
  });
}

describe('git.service — lokales Dateisystem', () => {
  afterEach(() => {
    resetGitRepo();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('initialisiert LightningFS mit einem stabilen Dateisystemnamen', async () => {
    const repoConstructor = vi.spyOn(repoModule, 'GitRepo');
    repoConstructor.mockImplementation(function () {
      return {} as repoModule.GitRepo;
    });

    await getGitRepo();

    expect(repoConstructor).toHaveBeenCalledWith('zeugdb-git');
  });

  it('initialisiert LightningFS nicht außerhalb eines Browsers', async () => {
    const repoConstructor = vi.spyOn(repoModule, 'GitRepo');
    vi.stubGlobal('indexedDB', undefined);

    try {
      await expect(getGitRepo()).rejects.toThrow('Git-Repository kann nur im Browser verwendet werden');
      expect(repoConstructor).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

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

describe('git.service — Clone', () => {
  beforeEach(() => {
    resetGitRepo();
    localStorage.clear();
  });

  afterEach(() => {
    resetGitRepo();
    vi.restoreAllMocks();
  });

  it('lädt Repository-Daten nach dem Klonen in die Stores', async () => {
    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'token'
    };
    const mockClone = vi.fn().mockResolvedValue(undefined);
    mockGitRepo({ clone: mockClone });
    const loader = await import('./git-store-loader');
    const loadStores = vi.spyOn(loader, 'loadGitFsToStores').mockResolvedValue();

    await cloneRepo(config);

    expect(mockClone).toHaveBeenCalledWith({
      url: config.url,
      auth: { username: config.username, token: config.token },
      onprogress: undefined
    });
    expect(loadStores).toHaveBeenCalledOnce();
    expect(loadStores).toHaveBeenCalledWith(expect.anything());
    expect(loadGitConfig()).toEqual(config);
  });
});

describe('git.service — Push', () => {
  beforeEach(() => {
    resetGitRepo();
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

  it('committet entfernte Asset-Dateien als Git-Löschung', async () => {
    const commit = vi.fn().mockResolvedValue('asset-delete-sha');
    mockGitRepo({
      readFile: vi.fn().mockRejectedValue(new Error('Datei fehlt')),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockImplementation(async (directory: string) =>
        directory === 'assets' ? ['asset-old.asset', 'README.md'] : []
      ),
      commit
    });
    vi.spyOn(assetStoreModule, 'getAssetStore').mockReturnValue({
      all: [],
      findFull: vi.fn()
    } as unknown as ReturnType<typeof assetStoreModule.getAssetStore>);
    vi.spyOn(locationStoreModule, 'getLocationsStore').mockReturnValue({
      all: []
    } as unknown as ReturnType<typeof locationStoreModule.getLocationsStore>);
    vi.spyOn(typeStoreModule, 'getTypesStore').mockReturnValue({
      all: []
    } as unknown as ReturnType<typeof typeStoreModule.getTypesStore>);

    await expect(commitAllToGit('Asset gelöscht', 'Autor', 'a@example.com'))
      .resolves.toBe('asset-delete-sha');

    expect(commit).toHaveBeenCalledWith({
      message: 'Asset gelöscht',
      authorName: 'Autor',
      authorEmail: 'a@example.com',
      files: [],
      deletedFiles: ['assets/asset-old.asset']
    });
  });

  it('committet geänderte Typdefinitionen als .type-Dateien', async () => {
    const commit = vi.fn().mockResolvedValue('type-sha');
    mockGitRepo({
      readFile: vi.fn().mockRejectedValue(new Error('Datei fehlt')),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      commit
    });
    vi.spyOn(assetStoreModule, 'getAssetStore').mockReturnValue({
      all: [],
      findFull: vi.fn()
    } as unknown as ReturnType<typeof assetStoreModule.getAssetStore>);
    vi.spyOn(locationStoreModule, 'getLocationsStore').mockReturnValue({
      all: []
    } as unknown as ReturnType<typeof locationStoreModule.getLocationsStore>);
    vi.spyOn(typeStoreModule, 'getTypesStore').mockReturnValue({
      all: [{ id: 'projektor', name: 'Projektor', fields: [], blocks: [] }]
    } as unknown as ReturnType<typeof typeStoreModule.getTypesStore>);

    await expect(commitAllToGit('Typ geändert', 'Autor', 'a@example.com'))
      .resolves.toBe('type-sha');

    expect(commit).toHaveBeenCalledWith(expect.objectContaining({
      files: ['types/projektor.type'],
      deletedFiles: []
    }));
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

  it('committet neue und gelöschte Foto-Dateien aus dem Git-Arbeitsbaum', async () => {
    const commit = vi.fn().mockResolvedValue('photo-sha');
    mockGitRepo({
      readFile: vi.fn().mockRejectedValue(new Error('Datei fehlt')),
      readdir: vi.fn().mockResolvedValue([]),
      commit,
      status: vi.fn().mockResolvedValue([
        { file: 'fotos/asset-1/photo-0.png', before: null, after: 2 },
        { file: 'fotos/asset-1/photo-1.png', before: 1, after: null }
      ])
    });
    vi.spyOn(assetStoreModule, 'getAssetStore').mockReturnValue({
      all: [],
      findFull: vi.fn()
    } as unknown as ReturnType<typeof assetStoreModule.getAssetStore>);
    vi.spyOn(locationStoreModule, 'getLocationsStore').mockReturnValue({
      all: []
    } as unknown as ReturnType<typeof locationStoreModule.getLocationsStore>);
    vi.spyOn(typeStoreModule, 'getTypesStore').mockReturnValue({
      all: []
    } as unknown as ReturnType<typeof typeStoreModule.getTypesStore>);

    await expect(commitAllToGit('Foto geändert', 'Autor', 'a@example.com')).resolves.toBe('photo-sha');

    expect(commit).toHaveBeenCalledWith({
      message: 'Foto geändert',
      authorName: 'Autor',
      authorEmail: 'a@example.com',
      files: ['fotos/asset-1/photo-0.png'],
      deletedFiles: ['fotos/asset-1/photo-1.png']
    });
  });
});

describe('git.service — syncEditBranch', () => {
  beforeEach(() => {
    resetGitRepo();
  });

  afterEach(() => {
    resetGitRepo();
    vi.restoreAllMocks();
  });

  it('holt origin/main nach main, bevor es den Edit-Branch einspielt und pusht', async () => {
    const mockFetch = vi.fn().mockResolvedValue(undefined);
    const mockCheckout = vi.fn().mockResolvedValue(undefined);
    const mockMerge = vi.fn().mockResolvedValue(undefined);
    const mockPush = vi.fn().mockResolvedValue([]);
    const mockReaddir = vi.fn().mockResolvedValue([]);
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    mockGitRepo({
      fetchFromRemote: mockFetch,
      checkoutBranch: mockCheckout,
      mergeBranch: mockMerge,
      push: mockPush,
      readdir: mockReaddir,
      deleteBranch: mockDelete
    });

    vi.spyOn(assetStoreModule, 'getAssetStore').mockReturnValue({
      all: [],
      findFull: vi.fn(),
      setAll: vi.fn()
    } as unknown as ReturnType<typeof assetStoreModule.getAssetStore>);
    vi.spyOn(locationStoreModule, 'getLocationsStore').mockReturnValue({
      all: [],
      clear: vi.fn(),
      add: vi.fn()
    } as unknown as ReturnType<typeof locationStoreModule.getLocationsStore>);
    vi.spyOn(typeStoreModule, 'getTypesStore').mockReturnValue({
      all: [],
      clear: vi.fn(),
      add: vi.fn()
    } as unknown as ReturnType<typeof typeStoreModule.getTypesStore>);

    const editModeModule = await import('$lib/stores/edit-mode.svelte');
    const editMode = {
      isEditing: true,
      branch: 'edit/test-user-session',
      username: 'test-user',
      finishEdit: vi.fn()
    };
    const flushPendingLfs = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fotoStoreModule, 'getFotoStore').mockReturnValue({
      flushPendingLfs
    } as unknown as ReturnType<typeof fotoStoreModule.getFotoStore>);
    vi.spyOn(editModeModule, 'getEditMode').mockReturnValue(
      editMode as unknown as import('$lib/stores/edit-mode.svelte').EditMode
    );

    await syncEditBranch(
      { url: 'http://example.com/repo.git', username: 'test', token: 'token' },
      'Author',
      'author@example.com'
    );

    expect(mockMerge).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ branch: 'origin/main' })
    );
    expect(mockMerge).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ branch: 'edit/test-user-session', squash: true })
    );
    expect(mockFetch.mock.invocationCallOrder[0]).toBeLessThan(mockCheckout.mock.invocationCallOrder[0]);
    expect(mockCheckout.mock.invocationCallOrder[0]).toBeLessThan(mockMerge.mock.invocationCallOrder[0]);
    expect(mockMerge.mock.invocationCallOrder[0]).toBeLessThan(mockMerge.mock.invocationCallOrder[1]);
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ branch: 'main' }));
    expect(flushPendingLfs).toHaveBeenCalledOnce();
    expect(mockCheckout).toHaveBeenLastCalledWith('main', true);
    expect(mockPush.mock.invocationCallOrder[0]).toBeLessThan(
      mockCheckout.mock.invocationCallOrder[mockCheckout.mock.invocationCallOrder.length - 1]
    );
    expect(editMode.finishEdit).toHaveBeenCalledOnce();
  });
});

describe('git.service — Status', () => {
  beforeEach(() => {
    resetGitRepo();
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
