import { describe, expect, it } from 'vitest';
import { buildTypeDefinition, createTypeDraft, previewTypeId } from './type-form.helpers';

describe('type form helpers', () => {
  it('converts a stored type into editable options, including legacy comma-separated values', () => {
    const draft = createTypeDraft({
      id: 'device',
      name: 'Gerät',
      fields: [
        { nr: 0, name: 'Zustand', art: 'auswahl', optionen: 'neu,defekt', pflicht: true, sensitiv: false },
        { nr: 1, name: 'Ort', art: 'dropdown', optionen: 'Innen|Außen', pflicht: false, sensitiv: false }
      ],
      blocks: [{ compId: 'port', min: 0, max: 4 }]
    });

    expect(draft.fields.map(field => field.optionen)).toEqual([['neu', 'defekt'], ['Innen', 'Außen']]);
    expect(draft.blocks).toEqual([{ compId: 'port', min: 0, max: 4 }]);
  });

  it('removes reserved asset metadata fields from legacy type drafts', () => {
    const draft = createTypeDraft({
      id: 'device',
      fields: [
        { nr: 0, name: 'type', art: 'text', optionen: null, pflicht: true, sensitiv: false },
        { nr: 1, name: 'bezeichnung', art: 'text', optionen: null, pflicht: true, sensitiv: false },
        { nr: 2, name: 'Zustand', art: 'text', optionen: null, pflicht: false, sensitiv: false }
      ],
      blocks: []
    });

    expect(draft.fields.map(field => field.name)).toEqual(['Zustand']);
  });

  it('creates a normalized id from a new type name', () => {
    expect(previewTypeId('Gerät & Zubehör')).toBe('geraet-zubehoer');
    expect(previewTypeId(' !!! ')).toBe('');
  });

  it('builds a type from structured fields and blocks', () => {
    const result = buildTypeDefinition({
      id: null,
      name: 'Projektor',
      extendsId: '_base',
      kategorie: 'gerät',
      icon: 'projector',
      fields: [
        { name: 'Zustand', art: 'dropdown', optionen: ['neu', 'defekt'], pflicht: true, sensitiv: false },
        { name: 'Passwort', art: 'text', optionen: [], pflicht: false, sensitiv: true }
      ],
      blocks: [{ compId: 'anschluss', min: 0, max: 4 }]
    }, []);

    expect(result.errors).toEqual([]);
    expect(result.type).toEqual({
      id: 'projektor',
      name: 'Projektor',
      extends: '_base',
      kategorie: 'gerät',
      icon: 'projector',
      fields: [
        { nr: 0, name: 'Zustand', art: 'dropdown', optionen: 'neu|defekt', pflicht: true, sensitiv: false },
        { nr: 1, name: 'Passwort', art: 'text', optionen: null, pflicht: false, sensitiv: true }
      ],
      blocks: [{ compId: 'anschluss', min: 0, max: 4 }]
    });
  });

  it('stores asset reference constraints as pipe-separated compatible type ids', () => {
    const result = buildTypeDefinition({
      id: null,
      name: 'Adapter',
      extendsId: '',
      kategorie: '',
      icon: '',
      fields: [{
        name: 'Zielgerät',
        art: 'asset_ref',
        optionen: ['projektor', 'monitor'],
        pflicht: false,
        sensitiv: false
      }],
      blocks: []
    }, []);

    expect(result.type?.fields[0].optionen).toBe('projektor|monitor');
  });

  it('preserves an existing id and allows editing that type', () => {
    const current = {
      id: 'old-id',
      name: 'Alt',
      fields: [],
      blocks: []
    };

    const result = buildTypeDefinition({
      id: current.id,
      name: 'Neuer Name',
      extendsId: '',
      kategorie: '',
      icon: '',
      fields: [],
      blocks: []
    }, [current]);

    expect(result.type?.id).toBe('old-id');
    expect(result.errors).toEqual([]);
  });

  it('requires a type name and a name for every field', () => {
    const result = buildTypeDefinition({
      id: null,
      name: '',
      extendsId: '',
      kategorie: '',
      icon: '',
      fields: [{ name: ' ', art: 'text', optionen: [], pflicht: false, sensitiv: false }],
      blocks: []
    }, []);

    expect(result.type).toBeUndefined();
    expect(result.errors).toContain('Bitte gib einen Typnamen ein.');
    expect(result.errors).toContain('Aus dem Typnamen kann keine gültige ID gebildet werden.');
    expect(result.errors).toContain('Bitte gib für jedes Feld einen Namen ein.');
  });

  it('rejects reserved asset metadata fields in new type definitions', () => {
    const result = buildTypeDefinition({
      id: null,
      name: 'Projektor',
      extendsId: '',
      kategorie: '',
      icon: '',
      fields: [
        { name: 'Type', art: 'text', optionen: [], pflicht: false, sensitiv: false },
        { name: 'Bezeichnung', art: 'text', optionen: [], pflicht: false, sensitiv: false }
      ],
      blocks: []
    }, []);

    expect(result.type).toBeUndefined();
    expect(result.errors).toContain('„type“ ist reserviert; der Asset-Typ wird beim Anlegen ausgewählt.');
    expect(result.errors).toContain('„bezeichnung“ ist reserviert; die Asset-Bezeichnung ist ein festes Asset-Feld.');
  });

  it('requires at least one option for a dropdown field', () => {
    const result = buildTypeDefinition({
      id: null,
      name: 'Status',
      extendsId: '',
      kategorie: '',
      icon: '',
      fields: [{ name: 'Zustand', art: 'dropdown', optionen: [], pflicht: false, sensitiv: false }],
      blocks: []
    }, []);

    expect(result.type).toBeUndefined();
    expect(result.errors).toContain('Für eine Auswahlliste ist mindestens ein Auswahlwert erforderlich.');
  });

  it('rejects missing names, duplicate ids, fields, options and invalid block limits', () => {
    const result = buildTypeDefinition({
      id: null,
      name: 'Projektor',
      extendsId: '',
      kategorie: '',
      icon: '',
      fields: [
        { name: 'Status', art: 'dropdown', optionen: ['neu', 'neu'], pflicht: false, sensitiv: false },
        { name: ' status ', art: 'text', optionen: [], pflicht: false, sensitiv: false }
      ],
      blocks: [{ compId: 'port', min: 3, max: 1 }]
    }, [{ id: 'projektor', fields: [], blocks: [] }]);

    expect(result.type).toBeUndefined();
    expect(result.errors).toContain('Es gibt bereits einen Typ mit dieser ID.');
    expect(result.errors).toContain('Feldnamen müssen eindeutig sein.');
    expect(result.errors).toContain('Auswahlwerte müssen eindeutig und dürfen nicht leer sein.');
    expect(result.errors).toContain('Der Maximalwert eines Bausteins muss mindestens dem Minimalwert entsprechen.');
  });
});
