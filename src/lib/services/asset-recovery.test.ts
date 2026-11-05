import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAssetStore, resetAssetStore } from '../stores/assets.store.svelte';
import { serializeAssetFile } from './init';

const gitMocks = vi.hoisted(() => ({
  listRefs: vi.fn(),
  log: vi.fn(),
  listFiles: vi.fn(),
  readBlob: vi.fn(),
  readObject: vi.fn()
}));

vi.mock('isomorphic-git', () => gitMocks);

import { scanLocalAssetHistory, serializeRecoveryScan } from './asset-recovery';

function createRepo(files: Record<string, string> = {}, loosePrefix?: string) {
  return {
    getFs: () => ({}),
    readdir: async (path: string) => {
      if (path === '.git/objects' && loosePrefix) return [loosePrefix];
      if (path === `.git/objects/${loosePrefix}` && loosePrefix) return ['c'.repeat(38)];
      if (path === '.git/objects' || path === 'assets') return [];
      const error = new Error(`Missing ${path}`) as Error & { code: string };
      error.code = 'ENOENT';
      throw error;
    },
    readFile: async (path: string) => {
      if (path in files) return files[path];
      const error = new Error(`Missing ${path}`) as Error & { code: string };
      error.code = 'ENOENT';
      throw error;
    }
  };
}

describe('scanLocalAssetHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAssetStore();
    gitMocks.listRefs.mockImplementation(async ({ filepath }: { filepath: string }) =>
      filepath === 'refs/heads' ? ['main'] : []
    );
    gitMocks.log.mockResolvedValue([{
      oid: 'commit-with-assets',
      commit: {
        message: 'Recovered asset values',
        author: { timestamp: 1700000000 }
      }
    }]);
    gitMocks.listFiles.mockResolvedValue(['assets/asset-1.asset']);
    gitMocks.readBlob.mockResolvedValue({
      blob: new TextEncoder().encode('id: asset-1\ntype: projektor\nbezeichnung: Altbestand')
    });
  });

  afterEach(() => resetAssetStore());

  it('finds historical asset versions that differ from the current store', async () => {
    const result = await scanLocalAssetHistory(createRepo() as never);

    expect(result.versions).toEqual([expect.objectContaining({
      assetId: 'asset-1',
      path: 'assets/asset-1.asset',
      commitOid: 'commit-with-assets',
      message: 'Recovered asset values',
      content: 'id: asset-1\ntype: projektor\nbezeichnung: Altbestand'
    })]);
    expect(result.commitsScanned).toBe(1);
    expect(result.refsScanned).toContain('refs/heads/main');
  });

  it('does not offer asset data already present in the current store', async () => {
    const id = getAssetStore().createAsset({
      id: 'asset-1',
      type: 'projektor',
      fields: { bezeichnung: 'Altbestand' }
    });
    const currentContent = serializeAssetFile(getAssetStore().findFull(id)!);
    expect(getAssetStore().findFull(id)).toBeTruthy();
    gitMocks.readBlob.mockResolvedValue({ blob: new TextEncoder().encode(currentContent) });

    const result = await scanLocalAssetHistory(createRepo() as never);

    expect(result.versions).toEqual([]);
  });

  it('searches dangling local commits left behind after a branch was removed', async () => {
    gitMocks.listRefs.mockResolvedValue([]);
    gitMocks.readObject.mockResolvedValue({
      oid: `ab${'c'.repeat(38)}`,
      type: 'commit',
      format: 'parsed',
      object: {
        message: 'Commit from removed edit branch',
        author: { timestamp: 1700000000 }
      }
    });

    const result = await scanLocalAssetHistory(createRepo({}, 'ab') as never);

    expect(result.versions).toEqual([expect.objectContaining({
      commitOid: `ab${'c'.repeat(38)}`,
      source: 'Nicht mehr referenzierter lokaler Commit',
      message: 'Commit from removed edit branch'
    })]);
    expect(result.looseObjectsScanned).toBe(1);
  });

  it('exports the scan result as readable JSON without changing stores', async () => {
    const result = await scanLocalAssetHistory(createRepo() as never);
    const exported = serializeRecoveryScan(result);

    expect(JSON.parse(exported)).toEqual(result);
    expect(getAssetStore().all).toEqual([]);
  });
});
