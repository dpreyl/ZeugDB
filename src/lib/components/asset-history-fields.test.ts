import { describe, expect, it } from 'vitest';
import { getAssetHistoryFields } from './asset-history-fields';

describe('getAssetHistoryFields', () => {
  it('lists direct and indexed block fields without asset metadata', () => {
    expect(getAssetHistoryFields({
      id: 'asset-1',
      type: 'geraet',
      location: 'raum-1',
      erstellt: '2026-10-01',
      bezeichnung: 'Mischpult',
      Schutzklasse: 'I',
      blocks: {
        pruefung: {
          '0': { Prüfdatum: '2026-10-28', Prüfergebnis: 'Bestanden' }
        }
      }
    })).toEqual([
      'Schutzklasse',
      'bezeichnung',
      'pruefung[0].Prüfdatum',
      'pruefung[0].Prüfergebnis'
    ]);
  });

  it('returns no fields for missing or invalid asset data', () => {
    expect(getAssetHistoryFields(null)).toEqual([]);
    expect(getAssetHistoryFields({ id: 'asset-1', blocks: null })).toEqual([]);
  });
});
