import { fireEvent, render, screen } from '@testing-library/svelte';
import { vi } from 'vitest';
import { describe, expect, it } from 'vitest';
import AssetBlocks from './AssetBlocks.svelte';
import type { AssetBlockValues } from './asset-blocks.helpers';

const definitions = [{ compId: 'port', min: 1, max: 2 }];
const components = [{
  id: 'port',
  name: 'Port',
  fields: [
    { nr: 0, name: 'name', art: 'text', optionen: null, pflicht: true, sensitiv: false },
    { nr: 1, name: 'kabel', art: 'asset_ref', optionen: 'kabel', pflicht: false, sensitiv: false }
  ]
}];
const assets = [
  { id: 'cable-z', type: 'kabel', label: 'Zulu-Kabel · cable-z' },
  { id: 'cable-a', type: 'kabel', label: 'Alpha-Kabel · cable-a' },
  { id: 'projector-1', type: 'projektor', label: 'Projektor · projector-1' }
];

describe('AssetBlocks', () => {
  it('rendert Komponentefelder und zeigt nur kompatible Assets als Referenzoptionen', () => {
    render(AssetBlocks, {
      props: {
        definitions,
        components,
        values: { port: { '0': {} } },
        assets,
        types: [{ id: 'kabel', fields: [], blocks: [] }],
        editable: true,
        onValueChange: () => {}
      }
    });

    expect(screen.getByLabelText(/name/)).toBeTruthy();
    const reference = screen.getByLabelText('kabel') as HTMLSelectElement;
    expect([...reference.options].map(option => option.value)).toEqual(['', 'cable-a', 'cable-z']);
    expect([...reference.options].map(option => option.value)).not.toContain('projector-1');
  });

  it('fügt Instanzen hinzu und verhindert Entfernen unterhalb der Mindestanzahl', async () => {
    let values: AssetBlockValues = { port: { '0': {} } };
    render(AssetBlocks, {
      props: {
        definitions,
        components,
        values,
        editable: true,
        onValueChange: (next) => { values = next; }
      }
    });

    const remove = screen.getByRole('button', { name: 'Port 1 entfernen' }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: '+ Port hinzufügen' }));
    expect(values.port['1']).toEqual({});
  });

  it('setzt feste Werte beim Hinzufügen und zeigt diese nicht änderbar an', async () => {
    let values: AssetBlockValues = { port: { '0': { anschlusstyp: 'HDMI' } } };
    render(AssetBlocks, {
      props: {
        definitions: [{ compId: 'port', min: 1, max: 2, fixedFields: { anschlusstyp: 'HDMI' } }],
        components: [{
          id: 'port',
          name: 'Port',
          fields: [{ nr: 0, name: 'anschlusstyp', art: 'dropdown', optionen: 'HDMI|SDI|USB', pflicht: false, sensitiv: false }]
        }],
        values,
        editable: true,
        onValueChange: (next) => { values = next; }
      }
    });

    expect((screen.getByLabelText('anschlusstyp') as HTMLSelectElement).disabled).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: '+ Port hinzufügen' }));
    expect(values.port['1']).toEqual({ anschlusstyp: 'HDMI' });
  });

  it('zeigt gespeicherte Bausteinwerte lesbar im Nur-Ansicht-Modus', () => {
    render(AssetBlocks, {
      props: {
        definitions,
        components,
        values: { port: { '0': { name: 'HDMI OUT' } } },
        assets,
        editable: false,
        onValueChange: () => {}
      }
    });

    expect(screen.getByText('HDMI OUT')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /hinzufügen/i })).toBeNull();
  });

  it('rendert Kommazahlen und Mehrfachbilder in wiederverwendbaren Komponenten', async () => {
    const onImageSelect = vi.fn();
    const onImagesSelect = vi.fn();
    render(AssetBlocks, {
      props: {
        definitions,
        components: [{
          id: 'port',
          name: 'Port',
          fields: [
            { nr: 0, name: 'Ableitstrom', art: 'decimal', optionen: null, pflicht: false, sensitiv: false },
            { nr: 1, name: 'Typenschild', art: 'image', optionen: null, pflicht: false, sensitiv: false },
            { nr: 2, name: 'Mängelfotos', art: 'images', optionen: null, pflicht: false, sensitiv: false }
          ]
        }],
        values: { port: { '0': {} } },
        editable: true,
        onValueChange: () => {},
        onImageSelect,
        onImagesSelect
      }
    });

    const decimal = screen.getByLabelText('Ableitstrom') as HTMLInputElement;
    expect(decimal.type).toBe('number');
    expect(decimal.step).toBe('any');

    const singleInput = screen.getByLabelText('Bild für Port 1: Typenschild') as HTMLInputElement;
    const labelPhoto = new File(['label'], 'label.jpg', { type: 'image/jpeg' });
    await fireEvent.change(singleInput, { target: { files: [labelPhoto] } });
    expect(onImageSelect).toHaveBeenCalledWith('port', '0', 'Typenschild', labelPhoto);

    const input = screen.getByLabelText('Bilder für Port 1: Mängelfotos') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    const photos = [new File(['one'], 'one.jpg', { type: 'image/jpeg' })];
    await fireEvent.change(input, { target: { files: photos } });
    expect(onImagesSelect).toHaveBeenCalledWith('port', '0', 'Mängelfotos', photos);
  });

  it('zeigt gespeicherte Komponentenbilder im Nur-Ansicht-Modus als Vorschau', () => {
    render(AssetBlocks, {
      props: {
        definitions,
        components: [{
          id: 'port',
          name: 'Port',
          fields: [{
            nr: 0,
            name: 'Mängelfotos',
            art: 'images',
            optionen: null,
            pflicht: false,
            sensitiv: false
          }]
        }],
        values: { port: { '0': { Mängelfotos: '["fotos/a.jpg"]' } } },
        imageUrls: { 'fotos/a.jpg': 'blob:photo' },
        editable: false,
        onValueChange: () => {}
      }
    });

    expect((screen.getByRole('img', { name: 'Mängelfotos 1' }) as HTMLImageElement).src).toContain('blob:photo');
  });
});
