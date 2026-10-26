import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ComponentEditor from './ComponentEditor.svelte';

describe('ComponentEditor', () => {
  it('creates a standalone component with its own fields', async () => {
    const onSave = vi.fn();
    render(ComponentEditor, {
      props: { component: null, onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Komponenten-ID'), { target: { value: 'port' } });
    await fireEvent.input(screen.getByLabelText('Anzeigename'), { target: { value: 'Port' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Feld hinzufügen' }));
    await fireEvent.input(screen.getByLabelText('Feldname'), { target: { value: 'kabel' } });
    await fireEvent.change(screen.getByLabelText('Eingabetyp'), { target: { value: 'asset_ref' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Kompatibler Typ' }));
    await fireEvent.input(screen.getByLabelText('Kompatibler Typ 1'), { target: { value: 'hdmi-kabel' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith({
      id: 'port',
      name: 'Port',
      fields: [{
        nr: 0,
        name: 'kabel',
        art: 'asset_ref',
        optionen: 'hdmi-kabel',
        pflicht: false,
        sensitiv: false
      }]
    });
  });

  it('does not save a component without an ID or field names', async () => {
    const onSave = vi.fn();
    render(ComponentEditor, {
      props: { component: null, onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Anzeigename'), { target: { value: 'Port' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Feld hinzufügen' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Bitte gib eine Komponenten-ID ein.');
  });
});
