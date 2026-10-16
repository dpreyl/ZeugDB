import type { ParsedAsset } from './types';

/**
 * Serialisiert ein geparstes Asset zurück ins Dateiformat.
 * Direkte Felder zuerst, dann Block-Felder (sortiert nach Instanz-Index).
 */
export function serializeAsset(asset: ParsedAsset): string {
  const lines: string[] = [];

  // Direkte Felder (in Einfügereihenfolge — JS-Objekt preserves key order)
  for (const [key, value] of Object.entries(asset.direct)) {
    lines.push(formatLine(key, value));
  }

  // Block-Felder sortiert
  for (const [blockName, instances] of Object.entries(asset.blocks)) {
    const sortedIndices = Object.keys(instances)
      .map(Number)
      .sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      const fields = instances[String(idx)];
      for (const [field, value] of Object.entries(fields)) {
        lines.push(formatBlockLine(blockName, idx, field, value));
      }
    }
  }

  return lines.join('\n') + '\n';
}

function formatLine(key: string, value: string): string {
  return value !== '' ? `${key}: ${value}` : `${key}:`;
}

function formatBlockLine(block: string, idx: number, field: string, value: string): string {
  return formatLine(`${block}[${idx}].${field}`, value);
}

