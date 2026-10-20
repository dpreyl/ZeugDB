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
});
