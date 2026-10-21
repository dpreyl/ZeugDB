import { describe, expect, it } from 'vitest';
import { parseComponent } from './comp.parser';
import { serializeComponent } from './comp.writer';

describe('serializeComponent', () => {
  it('schreibt Feldoptionen und Flags wieder in das .comp-Format', () => {
    const source = [
      'name: Port',
      'feld: name, text, pflicht',
      'feld: kabel, asset_ref, hdmi-kabel|usb-c-kabel, optional'
    ].join('\n');
    const component = parseComponent('port', source);

    expect(serializeComponent(component)).toBe(source + '\n');
  });

  it('schreibt leere Komponenten mit dem ID-Namen', () => {
    expect(serializeComponent({ id: 'port', name: 'Port', fields: [] })).toBe('name: Port\n');
  });
});
