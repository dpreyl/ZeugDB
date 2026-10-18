import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadGitConfig,
  saveGitConfig,
  pushToRemote,
  pullFromRemote,
  commitChanges,
  isRepoInitialized,
  getSyncStatus,
  resetGitRepo,
  type GitConfig
} from './git.service';
import * as repoModule from '$lib/git/repo';

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
    vi.spyOn(repoModule, 'GitRepo').mockImplementation(() => ({
      push: mockPush
    }) as unknown as repoModule.GitRepo);

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
    vi.spyOn(repoModule, 'GitRepo').mockImplementation(() => ({
      push: mockPush
    }) as unknown as repoModule.GitRepo);

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
    vi.spyOn(repoModule, 'GitRepo').mockImplementation(() => ({
      pull: mockPull
    }) as unknown as repoModule.GitRepo);

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
    vi.spyOn(repoModule, 'GitRepo').mockImplementation(() => ({
      commit: mockCommit
    }) as unknown as repoModule.GitRepo);

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
    vi.spyOn(repoModule, 'GitRepo').mockImplementation(() => ({
      commit: mockCommit
    }) as unknown as repoModule.GitRepo);

    const sha = await commitChanges('Test', 'Author', 'a@b.com');
    expect(sha).toBe('deadbeef');
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
    vi.spyOn(repoModule, 'GitRepo').mockImplementation(() => ({
      isInitialized: () => Promise.resolve(true),
      getRemoteUrl: () => Promise.resolve('http://example.com/repo.git'),
      status: () => Promise.resolve([{ file: 'test.txt', before: null, after: 'abc' }])
    }) as unknown as repoModule.GitRepo);

    const status = await getSyncStatus();
    expect(status.initialized).toBe(true);
    expect(status.remoteUrl).toBe('http://example.com/repo.git');
    expect(status.hasChanges).toBe(true);
  });

  it('gibt nicht-initialisierten Status zurück', async () => {
    vi.spyOn(repoModule, 'GitRepo').mockImplementation(() => ({
      isInitialized: () => Promise.resolve(false)
    }) as unknown as repoModule.GitRepo);

    const status = await getSyncStatus();
    expect(status.initialized).toBe(false);
    expect(status.remoteUrl).toBeUndefined();
    expect(status.hasChanges).toBe(false);
  });
});
