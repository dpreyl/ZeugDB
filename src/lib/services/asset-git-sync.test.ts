import { describe, expect, it, vi } from 'vitest';
import type { GitRepo } from '../git/repo';
import { syncAssetsToGit } from './asset-git-sync';

describe('syncAssetsToGit', () => {
  it('schreibt neue oder geänderte Assets und erkennt entfernte Asset-Dateien', async () => {
    const repo = {
      readdir: vi.fn().mockImplementation(async (directory: string) =>
        directory === 'assets'
          ? ['asset-old.asset', 'keep.txt']
          : Promise.reject(new Error('Verzeichnis fehlt'))
      ),
      readFile: vi.fn().mockImplementation(async (path: string) =>
        path === 'assets/asset-current.asset'
          ? 'id: asset-current\ntype: current\n'
          : Promise.reject(new Error('Datei fehlt'))
      ),
      writeFile: vi.fn().mockResolvedValue(undefined)
    } as unknown as GitRepo;

    const changes = await syncAssetsToGit(repo, [
      { id: 'asset-current', content: 'id: asset-current\ntype: current\n' },
      { id: 'asset/new', content: 'new content' }
    ]);

    expect(repo.writeFile).toHaveBeenCalledWith('assets/asset%2Fnew.asset', 'new content');
    expect(changes).toEqual({
      changedFiles: ['assets/asset%2Fnew.asset'],
      deletedFiles: ['assets/asset-old.asset']
    });
  });

  it('lässt vorhandene Asset-Dateien bei gleichen Werten unverändert', async () => {
    const original = '# Prüfergebnis\n type: leiter\nid: asset-1\ndatum: 2025-06-20\n';
    const repo = {
      readdir: vi.fn().mockResolvedValue(['asset-1.asset']),
      readFile: vi.fn().mockResolvedValue(original),
      writeFile: vi.fn().mockResolvedValue(undefined)
    } as unknown as GitRepo;

    const changes = await syncAssetsToGit(repo, [{
      id: 'asset-1',
      content: 'id: asset-1\ntype: leiter\ndatum: 2025-06-20\n'
    }]);

    expect(repo.writeFile).not.toHaveBeenCalled();
    expect(changes.changedFiles).toEqual([]);
    expect(changes.deletedFiles).toEqual([]);
  });

  it('behandelt ein fehlendes assets-Verzeichnis als leeren Bestand', async () => {
    const repo = {
      readdir: vi.fn().mockRejectedValue(new Error('Verzeichnis fehlt')),
      readFile: vi.fn().mockRejectedValue(new Error('Datei fehlt')),
      writeFile: vi.fn().mockResolvedValue(undefined)
    } as unknown as GitRepo;

    await expect(syncAssetsToGit(repo, [])).resolves.toEqual({
      changedFiles: [],
      deletedFiles: []
    });
  });
});
