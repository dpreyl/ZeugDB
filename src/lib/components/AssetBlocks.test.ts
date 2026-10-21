import { fireEvent, render, screen } from '@testing-library/svelte';
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
  { id: 'cable-1', type: 'kabel', label: 'HDMI-Kabel · cable-1' },
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
    expect([...reference.options].map(option => option.value)).toContain('cable-1');
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
});
