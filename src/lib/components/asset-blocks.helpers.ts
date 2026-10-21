import type { BlockDef, FieldType, TypeDefinition } from '$lib/parser/types';

export type AssetReferenceOption = {
  id: string;
  type: string;
  label: string;
};

export type AssetBlockValues = Record<string, Record<string, Record<string, string>>>;

export function resolveAssetTypeBlocks(typeId: string, types: TypeDefinition[]): BlockDef[] {
  const byId = new Map(types.map(type => [type.id, type]));

  function resolve(id: string, visited: Set<string>): BlockDef[] {
    const type = byId.get(id);
    if (!type || visited.has(id)) return [];

    const nextVisited = new Set(visited).add(id);
    const inherited = type.extends ? resolve(type.extends, nextVisited) : [];
    const blocks = new Map(inherited.map(block => [block.compId, block]));
    for (const block of type.blocks) blocks.set(block.compId, block);
    return [...blocks.values()];
  }

  return resolve(typeId, new Set());
}

export function createBlockValues(
  definitions: BlockDef[],
  existing: AssetBlockValues = {}
): AssetBlockValues {
  const result: AssetBlockValues = {};
  for (const definition of definitions) {
    const instances = Object.fromEntries(
      Object.entries(existing[definition.compId] ?? {})
        .map(([index, fields]) => [index, { ...fields }])
    );
    for (let index = 0; index < definition.min; index++) {
      instances[String(index)] ??= {};
    }
    result[definition.compId] = instances;
  }
  return result;
}

export function compatibleAssets(
  field: FieldType,
  assets: AssetReferenceOption[],
  types: TypeDefinition[],
  excludedAssetId?: string
): AssetReferenceOption[] {
  const allowedTypes = field.optionen
    ?.split(/[|,]/)
    .map(type => type.trim())
    .filter(Boolean) ?? [];

  return assets.filter(asset =>
    asset.id !== excludedAssetId &&
    (allowedTypes.length === 0 || allowedTypes.some(allowed => isTypeOrSubtype(asset.type, allowed, types)))
  );
}

function isTypeOrSubtype(typeId: string, expectedType: string, types: TypeDefinition[]): boolean {
  const byId = new Map(types.map(type => [type.id, type]));
  const visited = new Set<string>();
  let current = byId.get(typeId);

  while (current && !visited.has(current.id)) {
    if (current.id === expectedType) return true;
    visited.add(current.id);
    current = current.extends ? byId.get(current.extends) : undefined;
  }

  return typeId === expectedType;
}
