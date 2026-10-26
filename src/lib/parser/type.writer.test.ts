import { describe, expect, it } from 'vitest';
import { serializeType } from './type.writer';
import { parseType } from './type.parser';
import type { TypeDefinition } from './types';

describe('serializeType', () => {
  it('serializes metadata, options, flags, and blocks in the parser format', () => {
    const type: TypeDefinition = {
      id: 'projektor',
      name: 'Projektor',
      extends: '_base',
      kategorie: 'gerät',
      icon: 'projector',
      fields: [
        { nr: 0, name: 'zustand', art: 'dropdown', optionen: 'neu|defekt', pflicht: true, sensitiv: false },
        { nr: 1, name: 'seriennummer', art: 'text', optionen: null, pflicht: false, sensitiv: true }
      ],
      blocks: [{ compId: 'anschluss', min: 0, max: 4 }]
    };

    expect(serializeType(type)).toMatchInlineSnapshot(`
      "extends: _base
      name: Projektor
      kategorie: gerät
      icon: projector
      feld: zustand, dropdown, neu|defekt, pflicht
      feld: seriennummer, text, optional, sensitiv
      block: anschluss, 0, 4"
    `);
    expect(parseType(type.id, serializeType(type))).toEqual(type);
  });

  it('omits absent metadata and optional field flags', () => {
    expect(serializeType({
      id: 'simple',
      fields: [{ nr: 0, name: 'notiz', art: 'text', optionen: null, pflicht: false, sensitiv: false }],
      blocks: []
    })).toBe('feld: notiz, text, optional');
  });

  it('serializes and parses image fields without changing their field type', () => {
    const type: TypeDefinition = {
      id: 'kamera',
      fields: [{
        nr: 0,
        name: 'typenschild',
        art: 'image',
        optionen: null,
        pflicht: true,
        sensitiv: false
      }],
      blocks: []
    };

    expect(serializeType(type)).toBe('feld: typenschild, image, pflicht');
    expect(parseType(type.id, serializeType(type))).toEqual(type);
  });

  it('serializes fixed values for component fields in a type block', () => {
    const type: TypeDefinition = {
      id: 'hdmi-kabel',
      fields: [],
      blocks: [{
        compId: 'port',
        min: 2,
        max: 2,
        fixedFields: { anschlusstyp: 'HDMI' }
      }]
    };

    expect(serializeType(type)).toBe([
      'block: port, 2, 2',
      'block-feld: port, anschlusstyp, HDMI'
    ].join('\n'));
    expect(parseType(type.id, serializeType(type))).toEqual(type);
  });
});
