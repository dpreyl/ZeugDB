import type { ParsedField } from './types';

/**
 * Parst eine einzelne Zeile im Format `key: value` oder `block[n].field: value`.
 * Gibt `null` bei leeren Zeilen oder Kommentaren zurück.
 */
export function parseFieldLine(line: string): ParsedField | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`Ungültiges Format (kein \":\" gefunden): ${trimmed}`);
  }

  const key = trimmed.slice(0, colonIndex).trim();
  const value = trimmed.slice(colonIndex + 1).trim();

  const blockMatch = key.match(/^(.+?)\[(\d+)\]\.(.+)$/);
  if (blockMatch) {
    return {
      kind: 'block' as const,
      blockName: blockMatch[1],
      index: parseInt(blockMatch[2], 10),
      field: blockMatch[3],
      value
    };
  }

  return { kind: 'direct' as const, key, value };
}

/**
 * Parst eine Asset-/Type-/Comp-Datei.
 * Gibt Direkt-Felder als flaches Objekt und Block-Felder als verschachtelte Struktur zurück.
 */
export function parseAsset(text: string) {
  const direct: Record<string, string> = {};
  const blocks: Record<string, Record<string, Record<string, string>>> = {};

  let hasContent = false;

  for (const rawLine of text.split('\n')) {
    const parsed = parseFieldLine(rawLine);
    if (parsed === null) continue;

    hasContent = true;

    if (parsed.kind === 'direct') {
      direct[parsed.key] = parsed.value;
    } else {
      if (!blocks[parsed.blockName]) blocks[parsed.blockName] = {};
      const instKey = String(parsed.index);
      if (!blocks[parsed.blockName][instKey]) blocks[parsed.blockName][instKey] = {};
      blocks[parsed.blockName][instKey][parsed.field] = parsed.value;
    }
  }

  if (!hasContent) {
    throw new Error('Asset-Text ist leer oder enthält nur Kommentare');
  }

  return { direct, blocks };
}

