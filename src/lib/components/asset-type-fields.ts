import type { FieldType, TypeDefinition } from '$lib/parser/types';

/**
 * Resolves the fields shown for an asset type, including its ancestors.
 * A child field with the same name replaces the inherited definition.
 */
export function resolveAssetTypeFields(typeId: string, types: TypeDefinition[]): FieldType[] {
  const byId = new Map(types.map(type => [type.id, type]));

  function resolve(id: string, visited: Set<string>): FieldType[] {
    const type = byId.get(id);
    if (!type || visited.has(id)) return [];

    const nextVisited = new Set(visited).add(id);
    const inherited = type.extends ? resolve(type.extends, nextVisited) : [];
    const fields = new Map(inherited.map(field => [field.name, field]));
    for (const field of type.fields) fields.set(field.name, field);
    return [...fields.values()];
  }

  return resolve(typeId, new Set()).filter(field => {
    const name = field.name.trim().toLocaleLowerCase();
    return name !== 'type' && name !== 'bezeichnung';
  });
}

export function fieldOptions(field: FieldType): string[] {
  if (!field.optionen) return [];
  return field.optionen.split(/[|,]/).map(option => option.trim()).filter(Boolean);
}
