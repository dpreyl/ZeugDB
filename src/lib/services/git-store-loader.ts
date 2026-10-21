import type { AssetRow } from '../db';
import { parseAsset } from '../parser/asset.parser';
import { parseComponent } from '../parser/comp.parser';
import { parseLocation } from '../parser/location.parser';
import { parseType } from '../parser/type.parser';
import { getAssetStore } from '../stores/assets.store.svelte';
import { getComponentsStore } from '../stores/components.store.svelte';
import { getLocationsStore } from '../stores/locations.store.svelte';
import { getTypesStore } from '../stores/types.store.svelte';
import type { GitRepo } from '../git/repo';
import { loadComponentsFromGit } from './component-git-sync';
import { persistStore } from './init';

/**
 * Reads repository files into the application stores after a pull.
 */
export async function loadGitFsToStores(repo: GitRepo): Promise<void> {
  const assetStore = getAssetStore();
  const typesStore = getTypesStore();
  const componentsStore = getComponentsStore();
  const locationsStore = getLocationsStore();
  const assetRows: {
    row: AssetRow;
    fields: Record<string, string>;
    blocks: ReturnType<typeof parseAsset>['blocks'];
  }[] = [];

  try {
    for (const file of await repo.readdir('assets')) {
      if (!file.endsWith('.asset')) continue;
      const { direct, blocks } = parseAsset(await repo.readFile(`assets/${file}`));
      const row: AssetRow = {
        id: direct.id ?? file.replace('.asset', ''),
        type: direct.type ?? '',
        location: direct.location ?? null,
        erstellt: direct.erstellt ?? null,
        geaendert: direct.geaendert ?? null
      };
      const rowKeys = new Set(['id', 'type', 'location', 'erstellt', 'geaendert']);
      const fields = Object.fromEntries(
        Object.entries(direct).filter(([key]) => !rowKeys.has(key))
      );
      assetRows.push({ row, fields, blocks });
    }
  } catch {
    // The directory is absent before the first asset is added.
  }
  assetStore.setAll(assetRows.map(asset => asset.row));
  for (const { row, fields, blocks } of assetRows) {
    if (Object.keys(fields).length > 0) assetStore.setFields(row.id, fields);
    assetStore.setBlocks(row.id, blocks);
  }

  typesStore.clear();
  try {
    for (const file of await repo.readdir('types')) {
      if (!file.endsWith('.type')) continue;
      const id = file.slice(0, -'.type'.length);
      typesStore.add(parseType(id, await repo.readFile(`types/${file}`)));
    }
  } catch {
    // The directory is absent before the first type is added.
  }

  componentsStore.setAll(await loadComponentsFromGit(repo));

  locationsStore.clear();
  try {
    for (const file of await repo.readdir('locations')) {
      if (!file.endsWith('.location')) continue;
      locationsStore.add(parseLocation(await repo.readFile(`locations/${file}`)));
    }
  } catch {
    // The directory is absent before the first location is added.
  }

  persistStore();
}
