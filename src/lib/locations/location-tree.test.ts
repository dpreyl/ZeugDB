import { describe, expect, it } from 'vitest';
import { flattenLocationTree } from './location-tree';

describe('flattenLocationTree', () => {
  it('includes descendants at every depth and marks locations with missing parents', () => {
    const root = { id: 'root' };
    const child = { id: 'child', eltern: 'root' };
    const grandchild = { id: 'grandchild', eltern: 'child' };
    const orphan = { id: 'orphan', eltern: 'missing' };

    expect(flattenLocationTree([root, child, grandchild, orphan])).toEqual([
      { location: root, depth: 0, hasMissingParent: false },
      { location: child, depth: 1, hasMissingParent: false },
      { location: grandchild, depth: 2, hasMissingParent: false },
      { location: orphan, depth: 0, hasMissingParent: true }
    ]);
  });

  it('keeps every item visible without looping when the parent graph contains a cycle', () => {
    const first = { id: 'first', eltern: 'second' };
    const second = { id: 'second', eltern: 'first' };

    const rows = flattenLocationTree([first, second]);

    expect(rows.map(({ location }) => location.id)).toEqual(['first', 'second']);
    expect(rows.map(({ depth }) => depth)).toEqual([0, 1]);
  });

  it('sorts roots and siblings by name while keeping each hierarchy together', () => {
    const locations = [
      { id: 'room-10', name: 'Raum 10', eltern: 'house-1' },
      { id: 'house-2', name: 'Haus 2' },
      { id: 'room-2', name: 'Raum 2', eltern: 'house-1' },
      { id: 'house-1', name: 'Haus 1' }
    ];

    expect(flattenLocationTree(locations).map(({ location }) => location.id))
      .toEqual(['house-1', 'room-2', 'room-10', 'house-2']);
  });
});
