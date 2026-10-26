import { describe, expect, it } from 'vitest';
import { filterAssetRows, getAssetFilterOptions } from './asset-overview.helpers';

const rows = [
  { id: '1', bezeichnung: 'Projektor Saal 1', typ: 'projektor', standort: 'Saal 1', geaendert: '2026-10-20' },
  { id: '2', bezeichnung: 'Projektor Saal 2', typ: 'projektor', standort: 'Saal 2', geaendert: '2026-10-20' },
  { id: '3', bezeichnung: 'HDMI lang', typ: 'hdmi-kabel', standort: 'Saal 1', geaendert: '—' }
];

describe('asset overview helpers', () => {
  it('creates unique sorted filter values for each column', () => {
    expect(getAssetFilterOptions(rows, 'typ')).toEqual(['hdmi-kabel', 'projektor']);
    expect(getAssetFilterOptions(rows, 'standort')).toEqual(['Saal 1', 'Saal 2']);
  });

  it('filters rows by the intersection of selected column values', () => {
    expect(filterAssetRows(rows, { typ: ['projektor'], standort: ['Saal 2'] })).toEqual([rows[1]]);
  });

  it('returns no rows for an explicitly empty selection and all rows for no selection', () => {
    expect(filterAssetRows(rows, { typ: [] })).toEqual([]);
    expect(filterAssetRows(rows, {})).toEqual(rows);
  });
});
