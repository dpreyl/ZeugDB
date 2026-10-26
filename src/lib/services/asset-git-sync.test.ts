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
        path === 'assets/asset-current.asset' ? 'unchanged' : Promise.reject(new Error('Datei fehlt'))
      ),
      writeFile: vi.fn().mockResolvedValue(undefined)
    } as unknown as GitRepo;

    const changes = await syncAssetsToGit(repo, [
      { id: 'asset-current', content: 'unchanged' },
      { id: 'asset/new', content: 'new content' }
    ]);

    expect(repo.writeFile).toHaveBeenCalledWith('assets/asset%2Fnew.asset', 'new content');
    expect(changes).toEqual({
      changedFiles: ['assets/asset%2Fnew.asset'],
      deletedFiles: ['assets/asset-old.asset']
    });
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
