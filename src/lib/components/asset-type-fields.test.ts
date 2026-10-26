import { describe, expect, it } from 'vitest';
import { fieldOptions, resolveAssetTypeFields } from './asset-type-fields';
import type { TypeDefinition } from '$lib/parser/types';

const field = (name: string) => ({
  nr: 0,
  name,
  art: 'text',
  optionen: null,
  pflicht: false,
  sensitiv: false
});

describe('resolveAssetTypeFields', () => {
  it('returns inherited fields and lets child definitions override by name', () => {
    const types: TypeDefinition[] = [
      { id: '_base', fields: [field('Inventarnummer'), field('Zustand')], blocks: [] },
      { id: 'projektor', extends: '_base', fields: [field('Zustand'), field('Auflösung')], blocks: [] }
    ];

    expect(resolveAssetTypeFields('projektor', types)).toEqual([
      field('Inventarnummer'),
      field('Zustand'),
      field('Auflösung')
    ]);
  });

  it('returns no fields for an unknown type and safely stops inheritance cycles', () => {
    const types: TypeDefinition[] = [
      { id: 'eins', extends: 'zwei', fields: [field('Feld eins')], blocks: [] },
      { id: 'zwei', extends: 'eins', fields: [field('Feld zwei')], blocks: [] }
    ];

    expect(resolveAssetTypeFields('fehlt', types)).toEqual([]);
    expect(resolveAssetTypeFields('eins', types).map(item => item.name)).toEqual(['Feld zwei', 'Feld eins']);
  });

  it('does not expose reserved asset metadata as editable fields', () => {
    const types: TypeDefinition[] = [
      { id: '_base', fields: [field('type'), field('bezeichnung'), field('zustand')], blocks: [] },
      { id: 'projektor', extends: '_base', fields: [field('type'), field('bezeichnung')], blocks: [] }
    ];

    expect(resolveAssetTypeFields('projektor', types).map(item => item.name)).toEqual(['zustand']);
  });

  it('parses both current and legacy option separators', () => {
    expect(fieldOptions({ ...field('Zustand'), optionen: 'neu|defekt, in_reparatur' })).toEqual([
      'neu',
      'defekt',
      'in_reparatur'
    ]);
  });
});
