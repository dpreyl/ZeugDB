import { describe, expect, it } from 'vitest';
import {
  getNextInspectionIndex,
  getMeasurementsForProtectionClass,
  searchInspectionCandidates,
  type InspectionCandidate
} from './dguv.helpers';

describe('DGUV assistant helpers', () => {
  it('sucht über alle Räume nach Bezeichnung oder Gerätetyp', () => {
    const candidates: InspectionCandidate[] = [
      {
        id: 'asset-1',
        designation: 'Kaffeemaschine',
        type: 'kaffeemaschine',
        typeName: 'Kaffeemaschine',
        location: 'Raum 1',
        searchValues: ['Inventar 42']
      },
      {
        id: 'asset-2',
        designation: 'Beamer',
        type: 'projektor',
        typeName: 'Projektor',
        location: 'Raum 2',
        searchValues: []
      }
    ];

    expect(searchInspectionCandidates(candidates, 'kaffee')).toEqual([candidates[0]]);
    expect(searchInspectionCandidates(candidates, 'projektor')).toEqual([candidates[1]]);
    expect(searchInspectionCandidates(candidates, 'inventar 42')).toEqual([candidates[0]]);
    expect(searchInspectionCandidates(candidates, 'nicht vorhanden')).toEqual([]);
  });

  it('fragt für SK I und SK II jeweils die passenden Messwerte ab', () => {
    expect(getMeasurementsForProtectionClass('I')?.map(field => field.name)).toEqual([
      'Schutzleiterwiderstand (Ohm)',
      'Isolationswiderstand (MOhm)',
      'Ableitstrom IPE (mA)'
    ]);
    expect(getMeasurementsForProtectionClass('II')?.map(field => field.name)).toEqual([
      'Isolationswiderstand (MOhm)',
      'Ableitstrom IBERÜH (mA)'
    ]);
    expect(getMeasurementsForProtectionClass('III')).toBeNull();
  });

  it('hängt Prüfungen an den nächsten freien numerischen Index an', () => {
    expect(getNextInspectionIndex({})).toBe(0);
    expect(getNextInspectionIndex({ pruefung: { '0': {}, '2': {}, invalid: {} } })).toBe(3);
  });
});
