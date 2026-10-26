import type { TypeDefinition } from './types';

/**
 * Serializes a type definition to the `.type` format consumed by `parseType`.
 */
export function serializeType(type: TypeDefinition): string {
  const lines: string[] = [];

  if (type.extends) lines.push(`extends: ${type.extends}`);
  if (type.name) lines.push(`name: ${type.name}`);
  if (type.kategorie) lines.push(`kategorie: ${type.kategorie}`);
  if (type.icon) lines.push(`icon: ${type.icon}`);

  for (const field of type.fields) {
    const parts = [`feld: ${field.name}`, field.art];
    if (field.optionen) parts.push(field.optionen.replaceAll(',', '|'));
    else parts.push(field.pflicht ? 'pflicht' : 'optional');
    if (field.optionen && field.pflicht) parts.push('pflicht');
    if (field.sensitiv) parts.push('sensitiv');
    lines.push(parts.join(', '));
  }

  for (const block of type.blocks) {
    lines.push(`block: ${block.compId}, ${block.min}, ${block.max}`);
    for (const [fieldName, value] of Object.entries(block.fixedFields ?? {})) {
      lines.push(`block-feld: ${block.compId}, ${fieldName}, ${value}`);
    }
  }

  return lines.join('\n');
}
