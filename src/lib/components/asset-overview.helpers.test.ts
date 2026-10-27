import { describe, expect, it } from 'vitest';
import type { Location } from '../parser/types';
import {
  filterAssetRows,
  getAssetFilterOptions,
  getLocationDisplayName,
  getLocationFilterOptions
} from './asset-overview.helpers';

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

  it('offers used rooms and their parent locations as hierarchical filter options', () => {
    const locations: Location[] = [
      { id: 'house-1', name: 'Haus 1', art: 'raum' },
      { id: 'room-a', name: 'Raum A', eltern: 'house-1', art: 'raum' },
      { id: 'room-b', name: 'Raum B', eltern: 'house-1', art: 'raum' },
      { id: 'house-2', name: 'Haus 2', art: 'raum' },
      { id: 'room-c', name: 'Raum C', eltern: 'house-2', art: 'raum' }
    ];
    const assets = [
      { ...rows[0], standort: 'room-a' },
      { ...rows[1], standort: 'room-b' },
      { ...rows[2], standort: 'room-c' }
    ];

    expect(getLocationFilterOptions(locations, assets)).toEqual([
      { id: 'house-1', label: 'Haus 1', depth: 0, values: ['room-a', 'room-b'] },
      { id: 'room-a', label: 'Raum A', depth: 1, values: ['room-a'] },
      { id: 'room-b', label: 'Raum B', depth: 1, values: ['room-b'] },
      { id: 'house-2', label: 'Haus 2', depth: 0, values: ['room-c'] },
      { id: 'room-c', label: 'Raum C', depth: 1, values: ['room-c'] }
    ]);

    const houseOneValues = getLocationFilterOptions(locations, assets)[0].values;
    expect(filterAssetRows(assets, { standort: houseOneValues })).toEqual(assets.slice(0, 2));
  });

  it('keeps missing and unknown locations filterable without losing their labels', () => {
    const unknownRows = [
      { ...rows[0], standort: 'deleted-room' },
      { ...rows[1], standort: '—' }
    ];

    expect(getLocationFilterOptions([], unknownRows)).toEqual([
      { id: '—', label: '—', depth: 0, values: ['—'] },
      { id: 'deleted-room', label: 'deleted-room', depth: 0, values: ['deleted-room'] }
    ]);
    expect(getLocationDisplayName('deleted-room', [])).toBe('deleted-room');
    expect(getLocationDisplayName('—', [])).toBe('—');
  });

  it('shows asset locations as a readable path from the parent to the room', () => {
    const locations: Location[] = [
      { id: 'house-1', name: 'Haus 1' },
      { id: 'floor-1', name: 'Obergeschoss', eltern: 'house-1' },
      { id: 'room-a', name: 'Raum A', eltern: 'floor-1' }
    ];

    expect(getLocationDisplayName('room-a', locations)).toBe('Haus 1 › Obergeschoss › Raum A');
  });
});
