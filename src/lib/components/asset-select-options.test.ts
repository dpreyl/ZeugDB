import { describe, expect, it } from 'vitest';
import { getAssetSelectOptions } from './asset-select-options';

describe('getAssetSelectOptions', () => {
  it('shows identifying manufacturer/model details and sorts by visible label', () => {
    const options = getAssetSelectOptions(
      [
        { id: 'b', type: 'mixer', location: null, erstellt: null, geaendert: null },
        { id: 'a', type: 'unknown', location: null, erstellt: null, geaendert: null }
      ],
      [{ id: 'mixer', name: 'Mischpult' }],
      (id): Record<string, string> => id === 'b' ? { hersteller: 'Audio Co', modell: 'M-2' } : {}
    );

    expect(options).toEqual([
      { id: 'b', type: 'mixer', label: 'Mischpult · Audio Co M-2 · b' },
      { id: 'a', type: 'unknown', label: 'unknown · a' }
    ]);
  });
});
