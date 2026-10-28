import { describe, expect, it } from 'vitest';
import {
  hasCurrentDguvInspection,
  getNextInspectionIndex,
  getInspectionCandidateDetails,
  getMeasurementsForProtectionClass,
  searchInspectionCandidates,
  type InspectionCandidate
} from './dguv.helpers';

describe('DGUV assistant helpers', () => {
  it('zeigt identifizierende Gerätefelder und ignoriert leere oder andere Felder', () => {
    expect(getInspectionCandidateDetails({
      Hersteller: ' Bosch ',
      modell: 'GBH 18V',
      Seriennummer: ' ',
      Bezeichnung: 'Bohrmaschine',
      Notizen: 'Werkstatt'
    })).toEqual(['Hersteller: Bosch', 'modell: GBH 18V']);
    expect(getInspectionCandidateDetails({})).toEqual([]);
  });

  it('sucht standardmäßig nur im ausgewählten Raum und optional raumübergreifend', () => {
    const candidates: InspectionCandidate[] = [
      {
        id: 'asset-1',
        designation: 'Kaffeemaschine',
        type: 'kaffeemaschine',
        typeName: 'Kaffeemaschine',
        identifyingDetails: [],
        locationId: 'room-1',
        location: 'Raum 1',
        searchValues: ['Inventar 42']
      },
      {
        id: 'asset-2',
        designation: 'Beamer',
        type: 'projektor',
        typeName: 'Projektor',
        identifyingDetails: [],
        locationId: 'room-2',
        location: 'Raum 2',
        searchValues: []
      }
    ];

    expect(searchInspectionCandidates(candidates, 'kaffee', {
      locationId: 'room-1',
      allLocations: false
    })).toEqual([candidates[0]]);
    expect(searchInspectionCandidates(candidates, 'projektor', {
      locationId: 'room-1',
      allLocations: false
    })).toEqual([]);
    expect(searchInspectionCandidates(candidates, 'projektor', {
      locationId: 'room-1',
      allLocations: true
    })).toEqual([candidates[1]]);
    expect(searchInspectionCandidates(candidates, 'inventar 42', {
      locationId: '',
      allLocations: true
    })).toEqual([candidates[0]]);
    expect(searchInspectionCandidates(candidates, 'kaffee', {
      locationId: '',
      allLocations: false
    })).toEqual([]);
    expect(searchInspectionCandidates(candidates, 'nicht vorhanden', {
      locationId: 'room-1',
      allLocations: false
    })).toEqual([]);
    expect(searchInspectionCandidates(candidates, '', {
      locationId: 'room-1',
      allLocations: false
    })).toEqual([candidates[0]]);
  });

  it('wertet DGUV-Prüfungen bis einschließlich 18 Monate als aktuell', () => {
    const now = new Date(2025, 0, 15, 12);
    expect(hasCurrentDguvInspection({
      pruefung: {
        '0': { Prüfdatum: '2023-07-15' },
        '1': { Prüfdatum: '2022-01-01' }
      }
    }, now)).toBe(true);
    expect(hasCurrentDguvInspection({
      pruefung: { '0': { Prüfdatum: '2023-07-14' } }
    }, now)).toBe(false);
    expect(hasCurrentDguvInspection({
      pruefung: { '0': { Prüfdatum: 'kein Datum' } }
    }, now)).toBe(false);
    expect(hasCurrentDguvInspection({}, now)).toBe(false);
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
