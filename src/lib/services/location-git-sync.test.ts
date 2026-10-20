import { describe, expect, it, vi } from 'vitest';
import { syncLocationsToGit } from './location-git-sync';
import type { GitRepo } from '../git/repo';

function createRepo(overrides: Partial<GitRepo> = {}) {
  return {
    readFile: vi.fn().mockRejectedValue(new Error('Datei fehlt')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    ...overrides
  } as unknown as GitRepo;
}

describe('syncLocationsToGit', () => {
  it('schreibt geänderte Standorte im .location-Format', async () => {
    const repo = createRepo();
    const result = await syncLocationsToGit(repo, [
      { id: 'raum 101', name: 'Raum 101', art: 'raum', polygon: [
        { lat: 48.1, lon: 11.5 },
        { lat: 48.2, lon: 11.5 },
        { lat: 48.2, lon: 11.6 }
      ] }
    ]);

    expect(repo.writeFile).toHaveBeenCalledWith(
      'locations/raum%20101.location',
      expect.stringContaining('[polygon]')
    );
    expect(result).toEqual({
      changedFiles: ['locations/raum%20101.location'],
      deletedFiles: []
    });
  });

  it('überspringt unveränderte Dateien', async () => {
    const content = 'id: lager\nname: Lager';
    const repo = createRepo({ readFile: vi.fn().mockResolvedValue(content) });

    await expect(syncLocationsToGit(repo, [{ id: 'lager', name: 'Lager' }]))
      .resolves.toEqual({ changedFiles: [], deletedFiles: [] });
    expect(repo.writeFile).not.toHaveBeenCalled();
  });

  it('staged Dateien gelöschter Standorte', async () => {
    const repo = createRepo({
      readdir: vi.fn().mockResolvedValue(['raum-101.location', 'readme.txt'])
    });

    await expect(syncLocationsToGit(repo, []))
      .resolves.toEqual({
        changedFiles: [],
        deletedFiles: ['locations/raum-101.location']
      });
  });

  it('behandelt ein fehlendes locations-Verzeichnis als leeren Bestand', async () => {
    const repo = createRepo({
      readdir: vi.fn().mockRejectedValue(new Error('Verzeichnis fehlt'))
    });

    await expect(syncLocationsToGit(repo, []))
      .resolves.toEqual({ changedFiles: [], deletedFiles: [] });
  });
});
