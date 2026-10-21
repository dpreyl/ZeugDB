import { afterEach, describe, expect, it } from 'vitest';
import { loadGitFsToStores } from './git-store-loader';
import { getAssetStore, resetAssetStore } from '../stores/assets.store.svelte';
import { getComponentsStore, resetComponentsStore } from '../stores/components.store.svelte';
import { getLocationsStore, resetLocationsStore } from '../stores/locations.store.svelte';
import { getTypesStore, resetTypesStore } from '../stores/types.store.svelte';

describe('loadGitFsToStores', () => {
  afterEach(() => {
    resetAssetStore();
    resetComponentsStore();
    resetLocationsStore();
    resetTypesStore();
    localStorage.clear();
  });

  it('lädt Asset-Blöcke und wiederverwendbare Komponentendefinitionen', async () => {
    const files: Record<string, string> = {
      'assets/projector-1.asset': 'id: projector-1\ntype: projector\nport[0].name: HDMI OUT\n',
      'types/projector.type': 'name: Projektor\nblock: port, 0, 8\n',
      'components/port.comp': 'name: Port\nfeld: name, text, optional\n'
    };
    const directories: Record<string, string[]> = {
      assets: ['projector-1.asset'],
      types: ['projector.type'],
      components: ['port.comp'],
      locations: []
    };
    const repo = {
      readdir: async (path: string) => directories[path] ?? [],
      readFile: async (path: string) => {
        if (!(path in files)) throw new Error(`missing: ${path}`);
        return files[path];
      }
    };

    await loadGitFsToStores(repo as never);

    expect(getAssetStore().getBlocks('projector-1')).toEqual({
      port: { '0': { name: 'HDMI OUT' } }
    });
    expect(getComponentsStore().findById('port')).toMatchObject({
      id: 'port',
      name: 'Port',
      fields: [{ name: 'name', art: 'text' }]
    });
    expect(getTypesStore().findById('projector')?.blocks).toEqual([
      { compId: 'port', min: 0, max: 8 }
    ]);
  });
});
