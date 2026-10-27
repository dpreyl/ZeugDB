import { describe, expect, it } from 'vitest';
import { sortByLabel } from './sort-options';

describe('sortByLabel', () => {
  it('sorts labels alphabetically with natural number order without mutating the input', () => {
    const options = [
      { id: 'ten', label: 'Raum 10' },
      { id: 'zebra', label: 'Zebra' },
      { id: 'two', label: 'Raum 2' }
    ];

    expect(sortByLabel(options, option => option.label).map(option => option.id))
      .toEqual(['two', 'ten', 'zebra']);
    expect(options.map(option => option.id)).toEqual(['ten', 'zebra', 'two']);
  });
});
