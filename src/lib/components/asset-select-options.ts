import type { AssetRow } from '$lib/db';
import type { TypeDefinition } from '$lib/parser/types';
import { sortByLabel } from './sort-options';

export type AssetSelectOption = {
  id: string;
  type: string;
  label: string;
};

export function getAssetSelectOptions(
  assets: readonly AssetRow[],
  types: readonly Pick<TypeDefinition, 'id' | 'name'>[],
  getFields: (assetId: string) => Record<string, string>
): AssetSelectOption[] {
  return sortByLabel(assets.map(asset => {
    const assetType = types.find(type => type.id === asset.type);
    const fields = getFields(asset.id);
    const details = [fields.hersteller, fields.modell].filter(Boolean).join(' ');
    return {
      id: asset.id,
      type: asset.type,
      label: [assetType?.name ?? asset.type, details, asset.id].filter(Boolean).join(' · ')
    };
  }), option => option.label);
}
