import { describe, expect, it, vi } from 'vitest';
import { syncTypesToGit } from './type-git-sync';
import type { GitRepo } from '../git/repo';
import type { TypeDefinition } from '../parser/types';

describe('syncTypesToGit', () => {
  it('writes changed type definitions and reports their paths', async () => {
    const repo = {
      readFile: vi.fn().mockRejectedValue(new Error('file missing')),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([])
    };
    const types: TypeDefinition[] = [{
      id: 'projektor',
      name: 'Projektor',
      fields: [],
      blocks: []
    }];

    await expect(syncTypesToGit(repo as unknown as GitRepo, types)).resolves.toEqual({
      changedFiles: ['types/projektor.type'],
      deletedFiles: []
    });
    expect(repo.readFile).toHaveBeenCalledWith('types/projektor.type');
    expect(repo.writeFile).toHaveBeenCalledWith(
      'types/projektor.type',
      expect.any(String)
    );
  });

  it('does not rewrite identical files and reports removed type files', async () => {
    const repo = {
      readFile: vi.fn().mockResolvedValue('name: Projektor'),
      readdir: vi.fn().mockResolvedValue(['projektor.type', 'README.md', 'obsolete.type'])
    };

    await expect(syncTypesToGit(repo as unknown as GitRepo, [{
      id: 'projektor',
      name: 'Projektor',
      fields: [],
      blocks: []
    }])).resolves.toEqual({
      changedFiles: [],
      deletedFiles: ['types/obsolete.type']
    });
  });

  it('ignores a missing types directory before the first type is created', async () => {
    const repo = {
      readFile: vi.fn().mockRejectedValue(new Error('file missing')),
      readdir: vi.fn().mockRejectedValue(new Error('directory missing'))
    };

    await expect(syncTypesToGit(repo as unknown as GitRepo, [])).resolves.toEqual({
      changedFiles: [],
      deletedFiles: []
    });
  });
});
