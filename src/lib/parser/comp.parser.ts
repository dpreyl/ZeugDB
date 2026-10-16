import type { ComponentDefinition, FieldType } from './types';

/**
 * Parst eine `.comp`-Datei (wiederverwendbare Komponente).
 */
export function parseComponent(id: string, text: string): ComponentDefinition {
  const comp: ComponentDefinition = { id, name: id, fields: [] };
  let fieldNr = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('name:')) {
      comp.name = line.slice(5).trim();
      continue;
    }

    if (line.startsWith('feld:')) {
      const parts = line.slice(5).trim().split(',').map(s => s.trim());
      comp.fields.push(parseField(parts, fieldNr++));
      continue;
    }
  }

  return comp;
}

function parseField(parts: string[], nr: number): FieldType {
  const name = parts[0];
  const art = parts[1];
  let optionen: string | null = null;
  let pflicht = false;
  let sensitiv = false;

  for (let i = 2; i < parts.length; i++) {
    const part = parts[i];
    if (part === 'pflicht') pflicht = true;
    else if (part === 'optional') pflicht = false;
    else if (part === 'sensitiv') sensitiv = true;
    else if (part.includes('|')) optionen = part;
  }

  return { nr, name, art, optionen, pflicht, sensitiv };
}

