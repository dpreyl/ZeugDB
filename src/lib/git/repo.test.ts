import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock isomorphic-git
vi.mock('isomorphic-git/lightningfs.js', () => ({
  LightningFS: class {
    writeFile = vi.fn();
    readFile = vi.fn();
    readdir = vi.fn();
    mkdir = vi.fn();
    rmdir = vi.fn();
    unlink = vi.fn();
    stat = vi.fn();
    lstat = vi.fn();
    appendFile = vi.fn();
  }
}));

// Hole die echten Module um die Mocks zu patchen
vi.mock('isomorphic-git', async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    init: vi.fn().mockResolvedValue(undefined),
    clone: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue([]),
    pull: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue('abc123'),
    currentBranch: vi.fn().mockResolvedValue('main'),
    listFiles: vi.fn().mockResolvedValue([]),
    statusMatrix: vi.fn().mockResolvedValue([]),
    listRemotes: vi.fn().mockResolvedValue([{ remote: 'origin', url: 'http://test/repo' }]),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    branch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
  };
});

import * as git from 'isomorphic-git';
import { GitRepo } from './repo';

describe('GitRepo Branch-Management', () => {
  let repo: GitRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error mock
    git.currentBranch.mockResolvedValue('main');
    repo = new GitRepo({} as IDBDatabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createBranch erstellt neuen Branch vom aktuellen HEAD', async () => {
    await repo.createBranch('edit/test-2025');
    expect(git.branch).toHaveBeenCalledWith(
      expect.objectContaining({
        fs: expect.anything(),
        dir: '/',
        ref: 'edit/test-2025',
        checkout: false
      })
    );
  });

  it('checkoutBranch wechselt zu bestehendem Branch', async () => {
    await repo.checkoutBranch('edit/test-2025');
    expect(git.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        fs: expect.anything(),
        dir: '/',
        ref: 'edit/test-2025'
      })
    );
  });

  it('getCurrentBranch gibt aktuellen Branch zurück', async () => {
    // @ts-expect-error mock
    git.currentBranch.mockResolvedValue('main');
    const branch = await repo.getCurrentBranch();
    expect(branch).toBe('main');
  });

  it('mergeBranch führt Merge durch', async () => {
    await repo.mergeBranch({
      branch: 'edit/test-2025',
      authorName: 'Test',
      authorEmail: 'test@test.de',
      squash: true,
      message: 'Squash merge edit/test-2025'
    });
    expect(git.merge).toHaveBeenCalled();
  });
});

describe('GitRepo Dateiverwaltung', () => {
  let repo: GitRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new GitRepo({} as IDBDatabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('legt das Elternverzeichnis vor dem Schreiben an', async () => {
    const fs = repo.getFs() as unknown as {
      mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
      writeFile: (path: string, data: Uint8Array) => Promise<void>;
    };
    fs.mkdir = vi.fn().mockResolvedValue(undefined);
    fs.writeFile = vi.fn().mockResolvedValue(undefined);
    const mkdir = vi.spyOn(fs, 'mkdir');
    const writeFile = vi.spyOn(fs, 'writeFile');

    await repo.writeFile('locations/raum-101.location', 'id: raum-101');

    expect(mkdir).toHaveBeenCalledWith('locations', { recursive: true });
    expect(writeFile).toHaveBeenCalled();
  });

  it('staged gelöschte Dateien beim Commit mit git.remove', async () => {
    await repo.commit({
      message: 'Standort gelöscht',
      authorName: 'Autor',
      authorEmail: 'a@example.com',
      deletedFiles: ['locations/raum-101.location']
    });

    expect(git.remove).toHaveBeenCalledWith(
      expect.objectContaining({
        fs: expect.anything(),
        dir: '/',
        filepath: 'locations/raum-101.location'
      })
    );
  });

  it('meldet nur Dateien mit Änderungen gegenüber HEAD', async () => {
    // @ts-expect-error mocked function
    git.statusMatrix.mockResolvedValue([
      ['assets/clean.asset', 1, 1, 1],
      ['assets/edited.asset', 1, 2, 1],
      ['assets/staged.asset', 1, 1, 2],
      ['assets/new.asset', 0, 2, 0]
    ]);

    await expect(repo.status()).resolves.toEqual([
      { file: 'assets/edited.asset', before: 1, after: 2 },
      { file: 'assets/staged.asset', before: 1, after: 2 },
      { file: 'assets/new.asset', before: null, after: 2 }
    ]);
  });
});
