import type { FieldType, BlockDef, TypeDefinition } from './types';

/**
 * Parst eine `.type`-Datei (Asset-Typ-Vorlage).
 */
export function parseType(id: string, text: string): TypeDefinition {
  const type: TypeDefinition = { id, fields: [], blocks: [] };
  let fieldNr = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // extends: parent
    if (line.startsWith('extends:')) {
      type.extends = line.slice(8).trim();
      continue;
    }

    // name: ...
    if (line.startsWith('name:')) {
      type.name = line.slice(5).trim();
      continue;
    }

    // kategorie: ...
    if (line.startsWith('kategorie:')) {
      type.kategorie = line.slice(10).trim();
      continue;
    }

    // icon: ...
    if (line.startsWith('icon:')) {
      type.icon = line.slice(5).trim();
      continue;
    }

    // feld: name, art, [optionen|pflicht|optional], [sensitiv]
    if (line.startsWith('feld:')) {
      const field = parseFieldLine(line.slice(5).trim(), fieldNr);
      type.fields.push(field);
      fieldNr++;
      continue;
    }

    // block: compId, min, max
    if (line.startsWith('block:')) {
      const block = parseBlockLine(line.slice(6).trim());
      type.blocks.push(block);
      continue;
    }
  }

  return type;
}

function parseFieldLine(rest: string, nr: number): FieldType {
  // feld: name, art, [optionen|pflicht|optional], [sensitiv]
  // Beispiel: "id, uuid, pflicht"
  // Beispiel: "zustand, dropdown, neu|einwandfrei|defekt, pflicht"
  // Beispiel: "passwort, text, optional, sensitiv"
  const parts = rest.split(',').map(s => s.trim());
  const name = parts[0];
  const art = parts[1];

  let optionen: string | null = null;
  let pflicht = false;
  let sensitiv = false;

  // Ab Teil 3: optionen (wenn pipe-getrennt) oder pflicht/optional, ggf. sensitiv
  for (let i = 2; i < parts.length; i++) {
    const part = parts[i];
    if (part === 'pflicht') {
      pflicht = true;
    } else if (part === 'optional') {
      pflicht = false;
    } else if (part === 'sensitiv') {
      sensitiv = true;
    } else if (part.includes('|')) {
      optionen = part;
    }
  }

  return { nr, name, art, optionen, pflicht, sensitiv };
}

function parseBlockLine(rest: string): BlockDef {
  // block: compId, min, max
  const parts = rest.split(',').map(s => s.trim());
  return {
    compId: parts[0],
    min: parseInt(parts[1], 10),
    max: parseInt(parts[2], 10)
  };
}

