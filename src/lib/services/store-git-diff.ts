import type { GitRepo } from '../git/repo';
import { getAssetStore } from '../stores/assets.store.svelte';
import { getComponentsStore } from '../stores/components.store.svelte';
import { getLocationsStore } from '../stores/locations.store.svelte';
import { getTypesStore } from '../stores/types.store.svelte';
import { serializeAssetFile } from './init';
import { serializeComponent } from '../parser/comp.writer';
import { serializeLocation } from '../parser/location.writer';
import { serializeType } from '../parser/type.writer';

type ExpectedFile = { path: string; content: string };

/**
 * Checks whether persisted application stores contain data not represented in Git.
 * This catches saved offline edits, which do not change Git until the sync workflow.
 */
export async function hasLocalStoreChanges(repo: GitRepo): Promise<boolean> {
  const assets = getAssetStore();
  const assetFiles = assets.all.flatMap(row => {
    const asset = assets.findFull(row.id);
    return asset
      ? [{ path: `assets/${encodeURIComponent(row.id)}.asset`, content: serializeAssetFile(asset) }]
      : [];
  });
  if (!(await directoryMatches(repo, 'assets', '.asset', assetFiles))) return true;

  const typeFiles = getTypesStore().all.map(type => ({
    path: `types/${encodeURIComponent(type.id)}.type`,
    content: serializeType(type)
  }));
  if (!(await directoryMatches(repo, 'types', '.type', typeFiles))) return true;

  const componentFiles = getComponentsStore().all.map(component => ({
    path: `components/${encodeURIComponent(component.id)}.comp`,
    content: serializeComponent(component)
  }));
  if (!(await directoryMatches(repo, 'components', '.comp', componentFiles))) return true;

  const locationFiles = getLocationsStore().all.flatMap(location =>
    location.id
      ? [{
          path: `locations/${encodeURIComponent(location.id)}.location`,
          content: serializeLocation(location)
        }]
      : []
  );
  return !(await directoryMatches(repo, 'locations', '.location', locationFiles));
}

async function directoryMatches(
  repo: GitRepo,
  directory: string,
  extension: string,
  expected: ExpectedFile[]
): Promise<boolean> {
  let fileNames: string[];
  try {
    fileNames = (await repo.readdir(directory)).filter(file => file.endsWith(extension));
  } catch (error) {
    if (isMissingPath(error)) fileNames = [];
    else throw error;
  }

  if (fileNames.length !== expected.length) return false;
  const expectedByPath = new Map(expected.map(file => [file.path, file.content]));
  for (const fileName of fileNames) {
    const path = `${directory}/${fileName}`;
    const expectedContent = expectedByPath.get(path);
    if (expectedContent === undefined || await readFileOrNull(repo, path) !== expectedContent) {
      return false;
    }
  }
  return true;
}

async function readFileOrNull(repo: GitRepo, path: string): Promise<string | null> {
  try {
    return await repo.readFile(path);
  } catch (error) {
    if (isMissingPath(error)) return null;
    throw error;
  }
}

function isMissingPath(error: unknown): boolean {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT';
}
