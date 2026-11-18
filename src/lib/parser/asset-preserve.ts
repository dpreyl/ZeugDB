import { parseAsset, parseFieldLine } from './asset.parser';
import type { ParsedField } from './types';

const DEFAULT_DIRECT_FIELDS = new Map([['zustand', 'einwandfrei']]);

/**
 * Applies serialized values while retaining unchanged source lines verbatim.
 */
export function preserveAssetFileContent(original: string, desired: string): string {
  const desiredFields = collectFields(desired);
  const seen = new Set<string>();
  const originalLines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const updatedLines = originalLines.map(line => {
    const ending = line.match(/\r?\n$/)?.[0] ?? '';
    const body = ending ? line.slice(0, -ending.length) : line;
    const parsed = parseFieldLine(body);
    if (!parsed) return line;

    const key = fieldKey(parsed);
    if (!desiredFields.has(key)) {
      if (parsed.kind === 'block') return '';
      if (parsed.key === 'location') return '';
      return parsed.value === '' ? line : replaceFieldValue(body, ending, '');
    }

    seen.add(key);
    const value = desiredFields.get(key)!;
    return parsed.value === value ? line : replaceFieldValue(body, ending, value);
  });

  const additions = [...desiredFields].flatMap(([key, value]) => {
    if (seen.has(key)) return [];
    const parsed = parseFieldLine(`${key}: ${value}`);
    if (!parsed) return [];
    if (parsed.kind === 'direct' && (
      value === '' || DEFAULT_DIRECT_FIELDS.get(parsed.key) === value
    )) return [];
    return [value === '' ? `${key}:` : `${key}: ${value}`];
  });
  if (additions.length === 0) return updatedLines.join('');

  const updated = updatedLines.join('');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const separator = updated && !updated.endsWith('\n') ? eol : '';
  const trailingEol = original.endsWith('\n') ? eol : '';
  return `${updated}${separator}${additions.join(eol)}${trailingEol}`;
}

function collectFields(text: string): Map<string, string> {
  const parsed = parseAsset(text);
  const fields = new Map<string, string>(Object.entries(parsed.direct));
  for (const [blockName, instances] of Object.entries(parsed.blocks)) {
    for (const [index, block] of Object.entries(instances)) {
      for (const [field, value] of Object.entries(block)) {
        fields.set(`${blockName}[${index}].${field}`, value);
      }
    }
  }
  return fields;
}

function fieldKey(field: ParsedField): string {
  return field.kind === 'direct'
    ? field.key
    : `${field.blockName}[${field.index}].${field.field}`;
}

function replaceFieldValue(body: string, ending: string, value: string): string {
  const colon = body.indexOf(':');
  const prefix = body.slice(0, colon + 1);
  const spacing = body.slice(colon + 1).match(/^\s*/)?.[0] ?? '';
  return `${prefix}${spacing}${value}${ending}`;
}
