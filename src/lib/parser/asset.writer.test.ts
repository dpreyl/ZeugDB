import { describe, it, expect } from 'vitest';
import { serializeAsset } from './asset.writer';
import { parseAsset } from './asset.parser';

describe('serializeAsset', () => {
  it('schreibt direkte Felder als key: value', () => {
    const input = {
      direct: { id: '123', type: 'kabel', laenge: '150' },
      blocks: {}
    };
    const lines = serializeAsset(input).split('\n').filter(l => l.trim());
    expect(lines).toContain('id: 123');
    expect(lines).toContain('type: kabel');
    expect(lines).toContain('laenge: 150');
  });

  it('schreibt Block-Felder als block[n].field: value', () => {
    const input = {
      direct: { id: 'a1', type: 'projektor' },
      blocks: {
        stromanschluss: {
          '1': { spannung: '230', steckertyp: 'schuko' }
        }
      }
    };
    const output = serializeAsset(input);
    expect(output).toContain('stromanschluss[1].spannung: 230');
    expect(output).toContain('stromanschluss[1].steckertyp: schuko');
  });

  it('Roundtrip: parse → serialize → parse liefert identisches Ergebnis', () => {
    const original = [
      'id: a3f2b1c0-4e8d-9f1a-2b3c-d4e5f6a7b8c9',
      'type: projektor',
      'hersteller: Sony',
      'zustand: einwandfrei',
      'stromanschluss[1].spannung: 230',
      'port[1].name: HDMI OUT 1',
      'port[1].kabel: c8d9e0f1-6a7b-8c9d-0e1f-2a3b4c5d6e7f',
      'port[2].kabel:'
    ].join('\n');

    const parsed = parseAsset(original);
    const serialized = serializeAsset(parsed);
    const reparsed = parseAsset(serialized);

    expect(reparsed.direct).toEqual(parsed.direct);
    expect(reparsed.blocks).toEqual(parsed.blocks);
  });

  it('bewahrt JSON-kodierte Mehrfach-Bildpfade in der Asset-Datei', () => {
    const photos = JSON.stringify(['fotos/asset-1/photo-0.jpg', 'fotos/asset-1/photo-1.jpg']);
    const input = { direct: { 'Mängelfotos': photos }, blocks: {} };

    expect(parseAsset(serializeAsset(input)).direct['Mängelfotos']).toBe(photos);
  });

  it('round-trips decimal values and image paths inside reusable component blocks', () => {
    const photos = JSON.stringify(['fotos/asset-1/photo-0.jpg', 'fotos/asset-1/photo-1.jpg']);
    const input = {
      direct: { id: 'asset-1' },
      blocks: { pruefung: { '0': { Ableitstrom: '0.42', Mängelfotos: photos } } }
    };

    expect(parseAsset(serializeAsset(input)).blocks).toEqual(input.blocks);
  });

  it('schreibt leere Werte ohne trailing-Whitespace', () => {
    const input = {
      direct: { id: 'x' },
      blocks: { port: { '2': { kabel: '' } } }
    };
    const output = serializeAsset(input);
    expect(output).toContain('port[2].kabel:');
  });
});

