import { describe, it, expect } from 'vitest';
import { parseComponent } from './comp.parser';

describe('parseComponent', () => {
  const portComp = [
    'name: Port',
    'feld: name, text, pflicht',
    'feld: kabel, asset_ref, hdmi-kabel|usb-c-kabel, optional'
  ].join('\n');

  it('parsed Komponente', () => {
    const result = parseComponent('port', portComp);
    expect(result.id).toBe('port');
    expect(result.name).toBe('Port');
    expect(result.fields).toEqual([
      { nr: 0, name: 'name', art: 'text', optionen: null, pflicht: true, sensitiv: false },
      { nr: 1, name: 'kabel', art: 'asset_ref', optionen: 'hdmi-kabel|usb-c-kabel', pflicht: false, sensitiv: false }
    ]);
  });

  it('parst einen einzelnen kompatiblen Asset-Typ als Referenzoption', () => {
    const result = parseComponent('port', 'feld: kabel, asset_ref, hdmi-kabel');

    expect(result.fields[0].optionen).toBe('hdmi-kabel');
  });
});

