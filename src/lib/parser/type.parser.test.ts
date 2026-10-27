import { describe, it, expect } from 'vitest';
import { parseType } from './type.parser';

describe('parseType', () => {
  const baseType = [
    'name: Basis',
    'kategorie: intern',
    '',
    'feld: id, uuid, pflicht',
    'feld: type, text, pflicht',
    'feld: zustand, dropdown, neu|einwandfrei|defekt, pflicht',
    'feld: passwort, text, optional, sensitiv',
    '',
    'block: stromanschluss, 0, 5',
    'block: port, 0, 50'
  ].join('\n');

  it('parsed Basis-Vorlage ohne extends', () => {
    const result = parseType('_base', baseType);
    expect(result.id).toBe('_base');
    expect(result.name).toBe('Basis');
    expect(result.extends).toBeUndefined();
    expect(result.kategorie).toBe('intern');
  });

  it('parsed alle Feld-Definitionen', () => {
    const result = parseType('_base', baseType);
    expect(result.fields).toEqual([
      { nr: 0, name: 'id', art: 'uuid', optionen: null, pflicht: true, sensitiv: false },
      { nr: 1, name: 'type', art: 'text', optionen: null, pflicht: true, sensitiv: false },
      { nr: 2, name: 'zustand', art: 'dropdown', optionen: 'neu|einwandfrei|defekt', pflicht: true, sensitiv: false },
      { nr: 3, name: 'passwort', art: 'text', optionen: null, pflicht: false, sensitiv: true }
    ]);
  });

  it('parst einzelne und mehrere kompatible Typ-IDs einer Asset-Referenz', () => {
    const parsed = parseType('adapter', [
      'feld: kabel, asset_ref, hdmi-kabel|usb-c',
      'feld: geraet, asset_ref, projektor'
    ].join('\n'));

    expect(parsed.fields.map(field => field.optionen)).toEqual(['hdmi-kabel|usb-c', 'projektor']);
  });

  it('parst ein Bildfeld als eigenen Asset-Feldtyp', () => {
    const parsed = parseType('kamera', 'feld: typenschild, image, pflicht');

    expect(parsed.fields).toEqual([{
      nr: 0,
      name: 'typenschild',
      art: 'image',
      optionen: null,
      pflicht: true,
      sensitiv: false
    }]);
  });

  it('parst Kommazahl- und Mehrere-Bilder-Felder', () => {
    const parsed = parseType('pruefgeraet', [
      'feld: ableitstrom, decimal, pflicht',
      'feld: maengelfotos, images, optional'
    ].join('\n'));

    expect(parsed.fields.map(field => field.art)).toEqual(['decimal', 'images']);
    expect(parsed.fields.map(field => field.pflicht)).toEqual([true, false]);
  });

  it('parsed Block-Definitionen', () => {
    const result = parseType('_base', baseType);
    expect(result.blocks).toEqual([
      { compId: 'stromanschluss', min: 0, max: 5 },
      { compId: 'port', min: 0, max: 50 }
    ]);
  });

  it('parst typfeste Werte für Felder einer Block-Komponente', () => {
    const parsed = parseType('hdmi-kabel', [
      'block: port, 2, 2',
      'block-feld: port, anschlusstyp, HDMI'
    ].join('\n'));

    expect(parsed.blocks).toEqual([{
      compId: 'port',
      min: 2,
      max: 2,
      fixedFields: { anschlusstyp: 'HDMI' }
    }]);
  });
});

describe('parseType mit extends', () => {
  const projektorType = [
    'extends: _base',
    'name: Projektor',
    'kategorie: gerät',
    'icon: projector',
    '',
    'feld: auflösung, dropdown, 1080p|4k|laser, optional',
    'feld: helligkeit, number, optional',
    '',
    'block: port, 0, 10'
  ].join('\n');

  it('parsed extends-Referenz', () => {
    const result = parseType('projektor', projektorType);
    expect(result.id).toBe('projektor');
    expect(result.extends).toBe('_base');
    expect(result.name).toBe('Projektor');
    expect(result.icon).toBe('projector');
  });

  it('parsed typ-spezifische Felder', () => {
    const result = parseType('projektor', projektorType);
    expect(result.fields).toEqual([
      { nr: 0, name: 'auflösung', art: 'dropdown', optionen: '1080p|4k|laser', pflicht: false, sensitiv: false },
      { nr: 1, name: 'helligkeit', art: 'number', optionen: null, pflicht: false, sensitiv: false }
    ]);
  });
});

