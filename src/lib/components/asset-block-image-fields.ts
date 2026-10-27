import type { ComponentDefinition } from '$lib/parser/types';
import { getImageFieldPaths, serializeImagePaths } from './asset-image-fields';
import type { AssetBlockValues } from './asset-blocks.helpers';

export type AssetBlockImageField = {
  blockId: string;
  instanceId: string;
  field: ComponentDefinition['fields'][number];
};

export function getBlockImageFieldKey(blockId: string, instanceId: string, fieldName: string): string {
  return JSON.stringify([blockId, instanceId, fieldName]);
}

export function getBlockImageFields(
  values: AssetBlockValues,
  components: ComponentDefinition[]
): AssetBlockImageField[] {
  return Object.entries(values).flatMap(([blockId, instances]) => {
    const component = components.find(item => item.id === blockId);
    if (!component) return [];
    return Object.keys(instances).flatMap(instanceId =>
      component.fields
        .filter(field => field.art === 'image' || field.art === 'images')
        .map(field => ({ blockId, instanceId, field }))
    );
  });
}

export function appendBlockImagePaths(
  values: AssetBlockValues,
  blockId: string,
  instanceId: string,
  fieldName: string,
  addedPaths: string[],
  multiple: boolean
): AssetBlockValues {
  if (addedPaths.length === 0) return values;
  const current = values[blockId]?.[instanceId] ?? {};
  const paths = multiple
    ? [...new Set([...getImageFieldPaths(current[fieldName], 'images'), ...addedPaths])]
    : addedPaths.slice(-1);
  return {
    ...values,
    [blockId]: {
      ...values[blockId],
      [instanceId]: {
        ...current,
        [fieldName]: multiple ? serializeImagePaths(paths) : paths[0]
      }
    }
  };
}

export function getBlockImagePaths(
  values: AssetBlockValues,
  components: ComponentDefinition[]
): string[] {
  return getBlockImageFields(values, components).flatMap(({ blockId, instanceId, field }) =>
    getImageFieldPaths(values[blockId]?.[instanceId]?.[field.name], field.art)
  );
}

export function removeBlockImagePath(
  values: AssetBlockValues,
  components: ComponentDefinition[],
  path: string
): AssetBlockValues {
  let next = values;
  for (const { blockId, instanceId, field } of getBlockImageFields(values, components)) {
    const current = next[blockId]?.[instanceId]?.[field.name];
    const paths = getImageFieldPaths(current, field.art);
    if (!paths.includes(path)) continue;
    const remaining = paths.filter(item => item !== path);
    next = {
      ...next,
      [blockId]: {
        ...next[blockId],
        [instanceId]: {
          ...next[blockId]?.[instanceId],
          [field.name]: field.art === 'images'
            ? serializeImagePaths(remaining)
            : remaining[0] ?? ''
        }
      }
    };
  }
  return next;
}
