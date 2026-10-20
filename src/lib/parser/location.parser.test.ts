import { describe, it, expect } from 'vitest';
import { parseLocation } from './location.parser';

describe('parseLocation', () => {
  it('parst Location mit allen Feldern', () => {
    const input = [
      'id: 7f3a2b1c-4e8d-9f1a-2b3c-d4e5f6a7b8c9',
      'name: Berlin – Raum 101',
      'eltern: 1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6',
      'lat: 52.52',
      'lon: 13.405'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.id).toBe('7f3a2b1c-4e8d-9f1a-2b3c-d4e5f6a7b8c9');
    expect(result.name).toBe('Berlin – Raum 101');
    expect(result.eltern).toBe('1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6');
    expect(result.lat).toBeCloseTo(52.52);
    expect(result.lon).toBeCloseTo(13.405);
  });

  it('parst Location ohne Eltern (Root)', () => {
    const input = 'id: root-1\nname: Hauptsitz';
    const result = parseLocation(input);
    expect(result.eltern).toBeUndefined();
    expect(result.lat).toBeUndefined();
  });
  it('parst Location mit art=punkt', () => {
    const input = 'id: p1\nname: Turm\nart: punkt\nlat: 52.52\nlon: 13.405';
    const result = parseLocation(input);
    expect(result.art).toBe('punkt');
    expect(result.lat).toBeCloseTo(52.52);
  });

  it('parst polygon-Block', () => {
    const input = [
      'id: raum-1',
      'name: Gebäude A',
      'art: raum',
      '[polygon]',
      '  0:lat: 52.5200',
      '  0:lon: 13.4050',
      '  1:lat: 52.5210',
      '  1:lon: 13.4050',
      '  2:lat: 52.5210',
      '  2:lon: 13.4060',
      '  3:lat: 52.5200',
      '  3:lon: 13.4060',
      '[/polygon]'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.art).toBe('raum');
    expect(result.polygon).toHaveLength(4);
    expect(result.polygon![0]).toEqual({ lat: 52.52, lon: 13.405 });
    expect(result.polygon![2]).toEqual({ lat: 52.521, lon: 13.406 });
  });

  it('parst route-Block', () => {
    const input = [
      'id: leitung-1',
      'name: Kabeltrasse A-B',
      'art: leitung',
      '[route]',
      '  0:lat: 52.52',
      '  0:lon: 13.405',
      '  1:lat: 52.525',
      '  1:lon: 13.41',
      '  2:lat: 52.53',
      '  2:lon: 13.415',
      '[/route]'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.art).toBe('leitung');
    expect(result.route).toHaveLength(3);
    expect(result.route![0]).toEqual({ lat: 52.52, lon: 13.405 });
  });

  it('ignoriert Kommentare und leere Zeilen', () => {
    const input = [
      '# Standort',
      'id: test',
      '',
      'name: Test',
      '# Koordinaten',
      'lat: 50'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.id).toBe('test');
    expect(result.name).toBe('Test');
    expect(result.lat).toBeCloseTo(50);
  });

  it('parses art-Feld', () => {
    const input = 'id: test\nart: raum';
    const result = parseLocation(input);
    expect(result.art).toBe('raum');
  });

  it('parses art leitung', () => {
    const input = 'id: test\nart: leitung';
    const result = parseLocation(input);
    expect(result.art).toBe('leitung');
  });

  it('default art ist punkte wenn nicht angegeben', () => {
    const input = 'id: test';
    const result = parseLocation(input);
    expect(result.art).toBeUndefined();
  });

  it('parses polygon-Block', () => {
    const input = [
      'id: raum-101',
      'name: Raum 101',
      'art: raum',
      '---polygon---',
      '48.1358:11.57',
      '48.1358:11.58',
      '48.1360:11.58',
      '48.1360:11.57'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.art).toBe('raum');
    expect(result.polygon).toHaveLength(4);
    expect(result.polygon![0].lat).toBeCloseTo(48.1358);
    expect(result.polygon![0].lon).toBeCloseTo(11.57);
    expect(result.polygon![1].lat).toBeCloseTo(48.1358);
    expect(result.polygon![1].lon).toBeCloseTo(11.58);
    expect(result.polygon![2].lat).toBeCloseTo(48.1360);
    expect(result.polygon![2].lon).toBeCloseTo(11.58);
    expect(result.polygon![3].lat).toBeCloseTo(48.1360);
    expect(result.polygon![3].lon).toBeCloseTo(11.57);
  });

  it('parses route-Block', () => {
    const input = [
      'id: leitung-a',
      'name: Leitung A\u2192B',
      'art: leitung',
      '---route---',
      '48.1358:11.57',
      '48.1359:11.575',
      '48.1360:11.58'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.art).toBe('leitung');
    expect(result.route).toHaveLength(3);
    expect(result.route![0].lat).toBeCloseTo(48.1358);
    expect(result.route![0].lon).toBeCloseTo(11.57);
    expect(result.route![1].lat).toBeCloseTo(48.1359);
    expect(result.route![1].lon).toBeCloseTo(11.575);
    expect(result.route![2].lat).toBeCloseTo(48.1360);
    expect(result.route![2].lon).toBeCloseTo(11.58);
  });

  it('mixed: lat/lon und polygon gleichzeitig', () => {
    const input = [
      'id: gemischt',
      'lat: 52.52',
      'lon: 13.405',
      '---polygon---',
      '48.1358:11.57',
      '48.1358:11.58',
      '48.1360:11.58'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.lat).toBeCloseTo(52.52);
    expect(result.lon).toBeCloseTo(13.405);
    expect(result.polygon).toHaveLength(3);
  });

  it('skippt ung\u00fcltige Koordinaten (NaN) im polygon-Block', () => {
    const input = [
      'id: raum-bad',
      '---polygon---',
      '48.1358:11.57',
      'abc:xyz',
      '48.1360:11.58'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.polygon).toHaveLength(2);
    expect(result.polygon![0].lat).toBeCloseTo(48.1358);
    expect(result.polygon![1].lat).toBeCloseTo(48.1360);
  });

  it('skippt ung\u00fcltige Koordinaten (NaN) im route-Block', () => {
    const input = [
      'id: leitung-bad',
      '---route---',
      '48.1358:11.57',
      '::',
      '48.1360:11.58'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.route).toHaveLength(2);
  });

  it('ignoriert leere Zeilen und Kommentare im Block', () => {
    const input = [
      'id: test',
      '---polygon---',
      '# Eckpunkt 1',
      '48.1358:11.57',
      '',
      '48.1360:11.58'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.polygon).toHaveLength(2);
  });

  it('block beendet sich bei neuem Direktfeld', () => {
    const input = [
      'id: test',
      '---polygon---',
      '48.1358:11.57',
      '48.1360:11.58',
      'lat: 52.52'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.polygon).toHaveLength(2);
    expect(result.lat).toBeCloseTo(52.52);
  });

  it('block beendet sich bei neuem Block-Header', () => {
    const input = [
      'id: test',
      '---polygon---',
      '48.1358:11.57',
      '---route---',
      '52.52:13.405'
    ].join('\n');

    const result = parseLocation(input);
    expect(result.polygon).toHaveLength(1);
    expect(result.route).toHaveLength(1);
  });

  it('ignoriert ungültige art-Werte und nichtnumerische Koordinaten', () => {
    const result = parseLocation('id: test\nart: unbekannt\nlat: n/a\nlon: 13abc');
    expect(result.art).toBeUndefined();
    expect(result.lat).toBeUndefined();
    expect(result.lon).toBeUndefined();
  });

  it('beendet einen Block nur mit dem passenden Abschluss', () => {
    const input = [
      'art: raum',
      '[polygon]',
      '0:lat: 52',
      '0:lon: 13',
      '[/route]',
      '1:lat: 53',
      '1:lon: 14',
      '2:lat: 54',
      '2:lon: 15',
      '[/polygon]'
    ].join('\n');

    expect(parseLocation(input).polygon).toEqual([
      { lat: 52, lon: 13 },
      { lat: 53, lon: 14 },
      { lat: 54, lon: 15 }
    ]);
  });
});

