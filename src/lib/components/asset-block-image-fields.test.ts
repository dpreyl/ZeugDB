import { describe, expect, it } from 'vitest';
import type { ComponentDefinition } from '$lib/parser/types';
import {
  appendBlockImagePaths,
  getBlockImageFieldKey,
  getBlockImageFields,
  getBlockImagePaths,
  removeBlockImagePath
} from './asset-block-image-fields';

const components: ComponentDefinition[] = [{
  id: 'pruefung',
  name: 'Prüfung',
  fields: [
    { nr: 0, name: 'Typenschild', art: 'image', optionen: null, pflicht: false, sensitiv: false },
    { nr: 1, name: 'Mängelfotos', art: 'images', optionen: null, pflicht: false, sensitiv: false },
    { nr: 2, name: 'Messwert', art: 'decimal', optionen: null, pflicht: false, sensitiv: false }
  ]
}];

describe('asset-block-image-fields', () => {
  it('finds image fields on each component instance with stable draft keys', () => {
    const values = { pruefung: { '0': {}, '2': { Messwert: '1.25' } } };

    expect(getBlockImageFieldKey('pruefung', '2', 'Mängelfotos'))
      .toBe(JSON.stringify(['pruefung', '2', 'Mängelfotos']));
    expect(getBlockImageFields(values, components).map(({ blockId, instanceId, field }) => [
      blockId,
      instanceId,
      field.name
    ])).toEqual([
      ['pruefung', '0', 'Typenschild'],
      ['pruefung', '0', 'Mängelfotos'],
      ['pruefung', '2', 'Typenschild'],
      ['pruefung', '2', 'Mängelfotos']
    ]);
  });

  it('appends multiple image paths to one nested component field', () => {
    const current = { pruefung: { '0': { Mängelfotos: '["old.jpg"]' } } };

    expect(appendBlockImagePaths(current, 'pruefung', '0', 'Mängelfotos', ['new.jpg'], true))
      .toEqual({ pruefung: { '0': { Mängelfotos: '["old.jpg","new.jpg"]' } } });
  });

  it('replaces the path of a single-image component field', () => {
    const current = { pruefung: { '0': { Typenschild: 'old.jpg' } } };

    expect(appendBlockImagePaths(current, 'pruefung', '0', 'Typenschild', ['new.jpg'], false))
      .toEqual({ pruefung: { '0': { Typenschild: 'new.jpg' } } });
  });

  it('collects and removes nested image paths without changing other component values', () => {
    const current = {
      pruefung: {
        '0': { Typenschild: 'label.jpg', Mängelfotos: '["crack.jpg","detail.jpg"]', Messwert: '1.25' }
      }
    };
    expect(getBlockImagePaths(current, components)).toEqual(['label.jpg', 'crack.jpg', 'detail.jpg']);
    expect(removeBlockImagePath(current, components, 'crack.jpg')).toEqual({
      pruefung: {
        '0': { Typenschild: 'label.jpg', Mängelfotos: '["detail.jpg"]', Messwert: '1.25' }
      }
    });
  });
});
