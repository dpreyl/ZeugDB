import { describe, it, expect } from 'vitest';
import { serializeLocation } from './location.writer';
import { parseLocation } from './location.parser';
import type { Location } from './types';

describe('serializeLocation', () => {
  it('serialisiert einfachen Punkt', () => {
    const loc: Location = {
      id: 'p1',
      name: 'Turm',
      lat: 52.52,
      lon: 13.405
    };
    const output = serializeLocation(loc);
    expect(output).toContain('id: p1');
    expect(output).toContain('name: Turm');
    expect(output).toContain('lat: 52.52');
    expect(output).toContain('lon: 13.405');
  });

  it('serialisiert Standort mit art=punkt', () => {
    const loc: Location = {
      id: 'p1',
      name: 'Turm',
      art: 'punkt',
      lat: 52.52,
      lon: 13.405
    };
    expect(serializeLocation(loc)).toContain('art: punkt');
  });

  it('serialisiert polygon-Block', () => {
    const loc: Location = {
      id: 'raum-1',
      name: 'Gebäude A',
      art: 'raum',
      polygon: [
        { lat: 52.52, lon: 13.405 },
        { lat: 52.521, lon: 13.405 },
        { lat: 52.521, lon: 13.406 }
      ]
    };
    const output = serializeLocation(loc);
    expect(output).toContain('[polygon]');
    expect(output).toContain('[/polygon]');
    expect(output).toContain('  0:lat: 52.52');
    expect(output).toContain('  0:lon: 13.405');
    expect(output).toContain('  2:lon: 13.406');
  });

  it('serialisiert route-Block', () => {
    const loc: Location = {
      id: 'leitung-1',
      art: 'leitung',
      route: [
        { lat: 52.52, lon: 13.405 },
        { lat: 52.53, lon: 13.415 }
      ]
    };
    const output = serializeLocation(loc);
    expect(output).toContain('[route]');
    expect(output).toContain('[/route]');
    expect(output).toContain('  0:lat: 52.52');
    expect(output).toContain('  1:lon: 13.415');
  });

  it('serialisiert Eltern-Referenz', () => {
    const loc: Location = {
      id: 'child',
      eltern: 'parent'
    };
    expect(serializeLocation(loc)).toContain('eltern: parent');
  });

  it('lässt optionale Felder weg, wenn undefined', () => {
    const loc: Location = { id: 'minimal' };
    const output = serializeLocation(loc);
    expect(output).toBe('id: minimal');
  });

  it('roundtrip: serialize → parse ergibt gleiche Werte', () => {
    const original: Location = {
      id: 'rt-1',
      name: 'Roundtrip',
      art: 'raum',
      eltern: 'parent',
      lat: 52.52,
      lon: 13.405,
      polygon: [
        { lat: 52.52, lon: 13.405 },
        { lat: 52.53, lon: 13.415 }
      ]
    };
    const serialized = serializeLocation(original);
    const parsed = parseLocation(serialized);
    expect(parsed.id).toBe(original.id);
    expect(parsed.name).toBe(original.name);
    expect(parsed.art).toBe(original.art);
    expect(parsed.eltern).toBe(original.eltern);
    expect(parsed.lat).toBeCloseTo(original.lat!);
    expect(parsed.lon).toBeCloseTo(original.lon!);
    expect(parsed.polygon).toHaveLength(2);
    expect(parsed.polygon![0]).toEqual(original.polygon![0]);
  });
});
