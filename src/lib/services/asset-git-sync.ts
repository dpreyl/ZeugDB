import type { GitRepo } from '../git/repo';
import { preserveAssetFileContent } from '../parser/asset-preserve';

export type AssetGitFile = {
  id: string;
  content: string;
};

export type AssetSyncChanges = {
  changedFiles: string[];
  deletedFiles: string[];
};

export async function syncAssetsToGit(
  repo: GitRepo,
  assets: AssetGitFile[]
): Promise<AssetSyncChanges> {
  const changedFiles: string[] = [];
  const currentPaths = new Set<string>();

  for (const asset of assets) {
    const path = `assets/${encodeURIComponent(asset.id)}.asset`;
    currentPaths.add(path);
    const original = await readFileOrNull(repo, path);
    const content = original === null
      ? asset.content
      : preserveAssetFileContent(original, asset.content);
    if (original !== content) {
      await repo.writeFile(path, content);
      changedFiles.push(path);
    }
  }

  const deletedFiles: string[] = [];
  try {
    for (const file of await repo.readdir('assets')) {
      if (!file.endsWith('.asset')) continue;
      const path = `assets/${file}`;
      if (!currentPaths.has(path)) deletedFiles.push(path);
    }
  } catch {
    // The assets directory may not exist before the first asset is created.
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
