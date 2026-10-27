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

  it('round-trips decimal and multiple-image component fields', () => {
    const source = [
      'name: Prüfung',
      'feld: ableitstrom, decimal, optional',
      'feld: maengelfotos, images, optional'
    ].join('\n');

    expect(serializeComponent(parseComponent('pruefung', source))).toBe(source + '\n');
  });
});
