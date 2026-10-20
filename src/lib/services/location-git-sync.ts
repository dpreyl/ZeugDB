import type { Location } from '../parser/types';
import type { GitRepo } from '../git/repo';
import { serializeLocation } from '../parser/location.writer';

export type LocationSyncChanges = {
  changedFiles: string[];
  deletedFiles: string[];
};

/**
 * Spiegelt Standortdefinitionen in das Git-Arbeitsverzeichnis.
 */
export async function syncLocationsToGit(
  repo: GitRepo,
  locations: Location[]
): Promise<LocationSyncChanges> {
  const changedFiles: string[] = [];
  const deletedFiles: string[] = [];
  const currentPaths = new Set<string>();

  for (const location of locations) {
    if (!location.id) continue;
    const path = `locations/${encodeURIComponent(location.id)}.location`;
    currentPaths.add(path);
    const content = serializeLocation(location);
    if (await readFileOrNull(repo, path) !== content) {
      await repo.writeFile(path, content);
      changedFiles.push(path);
    }
  }

  try {
    const existingFiles = await repo.readdir('locations');
    for (const file of existingFiles) {
      if (!file.endsWith('.location')) continue;
      const path = `locations/${file}`;
      if (currentPaths.has(path)) continue;
      deletedFiles.push(path);
    }
  } catch {
    // Das Verzeichnis existiert vor dem ersten Standort noch nicht.
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
