import { afterEach, describe, expect, it } from 'vitest';
import { getAssetStore, resetAssetStore } from '../stores/assets.store.svelte';
import { serializeAssetFile } from './init';
import { hasLocalStoreChanges } from './store-git-diff';

function createRepo(files: Record<string, string> = {}) {
  return {
    readdir: async (directory: string) => Object.keys(files)
      .filter(path => path.startsWith(`${directory}/`))
      .map(path => path.slice(directory.length + 1)),
    readFile: async (path: string) => {
      if (!(path in files)) throw new Error(`Missing ${path}`);
      return files[path];
    }
  };
}

describe('hasLocalStoreChanges', () => {
  afterEach(() => resetAssetStore());

  it('reports no pending store data when stores match the repository', async () => {
    const store = getAssetStore();
    const id = store.createAsset({
      id: 'asset-1',
      type: 'projektor',
      fields: { bezeichnung: 'Projektor' }
    });
    const asset = store.findFull(id)!;
    const repo = createRepo({
      [`assets/${encodeURIComponent(id)}.asset`]: serializeAssetFile(asset)
    });

    await expect(hasLocalStoreChanges(repo as never)).resolves.toBe(false);
  });

  it('detects saved asset data that is not yet written to Git', async () => {
    getAssetStore().createAsset({
      id: 'asset-local-only',
      type: 'projektor',
      fields: { bezeichnung: 'Lokal gespeichert' }
    });

    await expect(hasLocalStoreChanges(createRepo() as never)).resolves.toBe(true);
  });

  it('detects repository assets missing from the local store', async () => {
    const repo = createRepo({ 'assets/asset-remote.asset': 'id: asset-remote' });

    await expect(hasLocalStoreChanges(repo as never)).resolves.toBe(true);
  });
});
