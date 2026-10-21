import type { GitRepo } from '../git/repo';
import { serializeType } from '../parser/type.writer';
import type { TypeDefinition } from '../parser/types';

export type TypeSyncChanges = {
  changedFiles: string[];
  deletedFiles: string[];
};

/**
 * Mirrors type definitions into the Git working tree and finds removed files.
 */
export async function syncTypesToGit(
  repo: GitRepo,
  types: TypeDefinition[]
): Promise<TypeSyncChanges> {
  const changedFiles: string[] = [];
  const currentPaths = new Set<string>();

  for (const type of types) {
    const path = `types/${encodeURIComponent(type.id)}.type`;
    currentPaths.add(path);
    const content = serializeType(type);
    if (await readFileOrNull(repo, path) !== content) {
      await repo.writeFile(path, content);
      changedFiles.push(path);
    }
  }

  const deletedFiles: string[] = [];
  try {
    const existingFiles = await repo.readdir('types');
    for (const file of existingFiles) {
      if (!file.endsWith('.type')) continue;
      const path = `types/${file}`;
      if (!currentPaths.has(path)) deletedFiles.push(path);
    }
  } catch {
    // The directory is not present before the first type is added.
  }

  return { changedFiles, deletedFiles };
}

async function readFileOrNull(repo: GitRepo, path: string): Promise<string | null> {
  try {
    return await repo.readFile(path);
  } catch {
    return null;
  }
}
