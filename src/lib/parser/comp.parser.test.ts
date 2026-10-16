import { describe, it, expect } from 'vitest';
import { parseComponent } from './comp.parser';

describe('parseComponent', () => {
  const portComp = [
    'name: Port',
    'feld: name, text, pflicht',
    'feld: kabel, asset_ref, optional'
  ].join('\n');

  it('parsed Komponente', () => {
    const result = parseComponent('port', portComp);
    expect(result.id).toBe('port');
    expect(result.name).toBe('Port');
    expect(result.fields).toEqual([
      { nr: 0, name: 'name', art: 'text', optionen: null, pflicht: true, sensitiv: false },
      { nr: 1, name: 'kabel', art: 'asset_ref', optionen: null, pflicht: false, sensitiv: false }
    ]);
  });
});

