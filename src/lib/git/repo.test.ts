import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock LightningFS with its promise-based API.
const lightningFsMocks = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@isomorphic-git/lightning-fs', () => ({
  default: class {
    promises = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(new TextEncoder().encode('')),
      readdir: vi.fn().mockResolvedValue([]),
      mkdir: lightningFsMocks.mkdir,
      flush: vi.fn().mockResolvedValue(undefined),
      rmdir: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn(),
      lstat: vi.fn()
    };
  }
}));

// Hole die echten Module um die Mocks zu patchen
vi.mock('isomorphic-git', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, any>;
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
    addRemote: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    branch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockResolvedValue({ tree: 'merge-tree-123' }),
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
    repo = new GitRepo('test');
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

  it('persistiert geklonte Repos vollständig, bevor clone zurückkehrt', async () => {
    const flush = vi.spyOn(repo.getFs().promises, 'flush');

    await repo.clone({
      url: 'http://test/repo',
      auth: { username: 'admin', token: 'token' }
    });

    expect(git.clone).toHaveBeenCalled();
    expect(flush).toHaveBeenCalledOnce();
  });

  it('verwendet beim Pull die aktuell konfigurierte Remote-URL', async () => {
    await repo.pull({
      url: 'http://phone-lan/repo',
      auth: { username: 'admin', token: 'token' },
      author: { name: 'Test', email: 'test@example.com' }
    });

    expect(git.pull).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://phone-lan/repo',
      remote: 'origin'
    }));
    expect(git.addRemote).toHaveBeenCalledWith(expect.objectContaining({
      remote: 'origin',
      url: 'http://phone-lan/repo',
      force: true
    }));
  });

  it('verwendet beim Push die aktuell konfigurierte Remote-URL', async () => {
    await repo.push({
      url: 'http://phone-lan/repo',
      auth: { username: 'admin', token: 'token' }
    });

    expect(git.push).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://phone-lan/repo',
      remote: 'origin'
    }));
    expect(git.addRemote).toHaveBeenCalledWith(expect.objectContaining({
      remote: 'origin',
      url: 'http://phone-lan/repo',
      force: true
    }));
  });

  it('verwendet beim Fetch die aktuell konfigurierte Remote-URL', async () => {
    await repo.fetchFromRemote({
      url: 'http://phone-lan/repo',
      auth: { username: 'admin', token: 'token' }
    });

    expect(git.fetch).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://phone-lan/repo',
      remote: 'origin'
    }));
    expect(git.addRemote).toHaveBeenCalledWith(expect.objectContaining({
      remote: 'origin',
      url: 'http://phone-lan/repo',
      force: true
    }));
  });

  it('persistiert Branch- und HEAD-Änderungen vor Rückkehr', async () => {
    const flush = vi.spyOn(repo.getFs().promises, 'flush');

    await repo.createBranch('edit/test-2025');
    await repo.checkoutBranch('edit/test-2025');

    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('legt Elternverzeichnisse für verschachtelte Branch-Namen an', async () => {
    await repo.createBranch('edit/test-2025');

    expect(lightningFsMocks.mkdir).toHaveBeenCalledWith('/.git/refs/heads/edit');
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

  it('checkoutBranch kann den Arbeitsbaum auf den Branch-Stand zurücksetzen', async () => {
    await repo.checkoutBranch('main', true);

    expect(git.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        dir: '/',
        ref: 'main',
        force: true
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
    expect(git.merge).toHaveBeenCalledWith(
      expect.objectContaining({
        dir: '/',
        theirs: 'edit/test-2025',
        fastForward: false,
        noUpdateBranch: true
      })
    );
    expect(git.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        dir: '/',
        tree: 'merge-tree-123',
        message: 'Squash merge edit/test-2025'
      })
    );
  });

  it('erstellt keinen leeren Commit, wenn der Branch bereits integriert ist', async () => {
    // @ts-expect-error mocked result
    git.merge.mockResolvedValue({ alreadyMerged: true });

    await repo.mergeBranch({
      branch: 'edit/test-2025',
      authorName: 'Test',
      authorEmail: 'test@test.de',
      squash: true
    });

    expect(git.commit).not.toHaveBeenCalled();
  });
});

describe('GitRepo Dateiverwaltung', () => {
  let repo: GitRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new GitRepo('test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('legt das Elternverzeichnis vor dem Schreiben an', async () => {
    const fs = repo.getFs() as unknown as {
      promises: {
        mkdir: (path: string) => Promise<void>;
        writeFile: (path: string, data: Uint8Array) => Promise<void>;
      };
    };
    fs.promises.mkdir = vi.fn().mockResolvedValue(undefined);
    fs.promises.writeFile = vi.fn().mockResolvedValue(undefined);
    const mkdir = vi.spyOn(fs.promises, 'mkdir');
    const writeFile = vi.spyOn(fs.promises, 'writeFile');

    await repo.writeFile('locations/floors/raum-101.location', 'id: raum-101');

    expect(mkdir.mock.calls).toEqual([['/locations'], ['/locations/floors']]);
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.calls[0][0]).toBe('/locations/floors/raum-101.location');
    expect(new TextDecoder().decode(writeFile.mock.calls[0][1])).toBe('id: raum-101');
  });

  it('normalisiert Punktsegmente und absolute Repo-Pfade für LightningFS', async () => {
    const fs = repo.getFs() as unknown as {
      promises: {
        mkdir: (path: string) => Promise<void>;
        writeFile: (path: string, data: Uint8Array) => Promise<void>;
      };
    };
    const mkdir = vi.spyOn(fs.promises, 'mkdir');
    const writeFile = vi.spyOn(fs.promises, 'writeFile');

    await repo.writeFile('./assets//test.asset', 'id: test');

    expect(mkdir).toHaveBeenCalledWith('/assets');
    expect(writeFile).toHaveBeenCalledWith(
      '/assets/test.asset',
      new TextEncoder().encode('id: test')
    );
  });

  it('ignoriert bereits vorhandene Elternverzeichnisse', async () => {
    const fs = repo.getFs() as unknown as {
      promises: {
        mkdir: (path: string) => Promise<void>;
        writeFile: (path: string, data: Uint8Array) => Promise<void>;
      };
    };
    const exists = Object.assign(new Error('already exists'), { code: 'EEXIST' });
    fs.promises.mkdir = vi.fn().mockRejectedValue(exists);

    await expect(repo.writeFile('locations/raum-101.location', 'id: raum-101')).resolves.toBeUndefined();
    expect(fs.promises.mkdir).toHaveBeenCalledWith('/locations');
    expect(fs.promises.writeFile).toHaveBeenCalled();
  });

  it('liest Textdateien über die LightningFS-Promise-API', async () => {
    const fs = repo.getFs() as unknown as {
      promises: { readFile: (path: string) => Promise<Uint8Array> };
    };
    fs.promises.readFile = vi.fn().mockResolvedValue(
      new TextEncoder().encode('id: lampe')
    );

    await expect(repo.readFile('assets/lampe.asset')).resolves.toBe('id: lampe');
    expect(fs.promises.readFile).toHaveBeenCalledWith('/assets/lampe.asset');
  });

  it('gibt Verzeichnisnamen als Strings zurück', async () => {
    const fs = repo.getFs() as unknown as {
      promises: { readdir: (path: string) => Promise<string[]> };
    };
    fs.promises.readdir = vi.fn().mockResolvedValue(['lampe.asset']);

    await expect(repo.readdir('assets')).resolves.toEqual(['lampe.asset']);
    expect(fs.promises.readdir).toHaveBeenCalledWith('/assets');
  });

  it('löscht Dateien über die LightningFS-Promise-API', async () => {
    const fs = repo.getFs() as unknown as {
      promises: { unlink: (path: string) => Promise<void> };
    };
    fs.promises.unlink = vi.fn().mockResolvedValue(undefined);

    await repo.unlink('assets/lampe.asset');
    expect(fs.promises.unlink).toHaveBeenCalledWith('/assets/lampe.asset');
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
