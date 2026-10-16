import { describe, it, expect } from 'vitest';
import { parseLocation } from './location.parser';

describe('parseLocation', () => {
  it('parsed Location mit allen Feldern', () => {
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

  it('parsed Location ohne Eltern (Root)', () => {
    const input = 'id: root-1\nname: Hauptsitz';
    const result = parseLocation(input);
    expect(result.eltern).toBeUndefined();
    expect(result.lat).toBeUndefined();
  });
});

