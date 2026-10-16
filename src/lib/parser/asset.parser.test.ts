import { describe, it, expect } from 'vitest';
import { parseAsset, parseFieldLine } from './asset.parser';

describe('parseFieldLine', () => {
  it('parsed ein direktes Feld', () => {
    const result = parseFieldLine('hersteller: Sony');
    expect(result).toEqual({ kind: 'direct', key: 'hersteller', value: 'Sony' });
  });

  it('parsed ein Block-Feld', () => {
    const result = parseFieldLine('stromanschluss[1].spannung: 230');
    expect(result).toEqual({ kind: 'block', blockName: 'stromanschluss', index: 1, field: 'spannung', value: '230' });
  });

  it('parsen leerer Wert', () => {
    const result = parseFieldLine('port[2].kabel:');
    expect(result).toEqual({ kind: 'block', blockName: 'port', index: 2, field: 'kabel', value: '' });
  });

  it('wirft bei ungültigem Format', () => {
    expect(() => parseFieldLine('kein kolon hier')).toThrow();
  });

  it('parsen von Wert mit Leerzeichen', () => {
    const result = parseFieldLine('notizen: Defekt seit 01.01.');
    expect(result).toEqual({ kind: 'direct', key: 'notizen', value: 'Defekt seit 01.01.' });
  });
});

describe('parseAsset', () => {
  const sampleAsset = [
    'id: a3f2b1c0-4e8d-9f1a-2b3c-d4e5f6a7b8c9',
    'type: projektor',
    'hersteller: Sony',
    'zustand: einwandfrei',
    'stromanschluss[1].spannung: 230',
    'stromanschluss[1].steckertyp: schuko',
    'port[1].name: HDMI OUT 1',
    'port[1].kabel: c8d9e0f1-6a7b-8c9d-0e1f-2a3b4c5d6e7f',
    'port[2].name: HDMI OUT 2',
    'port[2].kabel:',
    ''
  ].join('\n');

  it('parsed alle Felder korrekt', () => {
    const result = parseAsset(sampleAsset);
    expect(result.direct).toEqual({
      'id': 'a3f2b1c0-4e8d-9f1a-2b3c-d4e5f6a7b8c9',
      'type': 'projektor',
      'hersteller': 'Sony',
      'zustand': 'einwandfrei'
    });
    expect(result.blocks).toEqual({
      'stromanschluss': {
        '1': { 'spannung': '230', 'steckertyp': 'schuko' }
      },
      'port': {
        '1': { 'name': 'HDMI OUT 1', 'kabel': 'c8d9e0f1-6a7b-8c9d-0e1f-2a3b4c5d6e7f' },
        '2': { 'name': 'HDMI OUT 2', 'kabel': '' }
      }
    });
  });

  it('ignoriert Kommentarzeilen', () => {
    const input = '# Das ist ein Kommentar\nhersteller: Sony';
    const result = parseAsset(input);
    expect(result.direct).toEqual({ 'hersteller': 'Sony' });
  });

  it('wirft bei leerem Input', () => {
    expect(() => parseAsset('')).toThrow();
  });

  it('parsen Asset mit nur Direkt-Feldern', () => {
    const input = 'id: 123\ntype: kabel\nlaenge: 150';
    const result = parseAsset(input);
    expect(result.direct).toEqual({
      'id': '123',
      'type': 'kabel',
      'laenge': '150'
    });
    expect(result.blocks).toEqual({});
  });
});

