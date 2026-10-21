import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TypeEditor from './TypeEditor.svelte';
import type { TypeDefinition } from '$lib/parser/types';

describe('TypeEditor', () => {
  it('creates fields and dropdown options using form controls', async () => {
    const onSave = vi.fn();
    render(TypeEditor, {
      props: { type: null, existingTypes: [], onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Projektor' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Feld hinzufügen' }));
    await fireEvent.input(screen.getByLabelText('Feldname'), { target: { value: 'Zustand' } });
    await fireEvent.change(screen.getByLabelText('Eingabetyp'), { target: { value: 'dropdown' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Wert hinzufügen' }));
    await fireEvent.input(screen.getByLabelText('Auswahlwert 1'), { target: { value: 'Einwandfrei' } });
    await fireEvent.click(screen.getByLabelText('Pflichtfeld'));
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith({
      id: 'projektor',
      name: 'Projektor',
      fields: [{
        nr: 0,
        name: 'Zustand',
        art: 'dropdown',
        optionen: 'Einwandfrei',
        pflicht: true,
        sensitiv: false
      }],
      blocks: []
    }, []);
  });

  it('loads an existing type and displays validation errors instead of saving invalid fields', async () => {
    const onSave = vi.fn();
    const type: TypeDefinition = {
      id: 'geraet',
      name: 'Gerät',
      fields: [{
        nr: 0,
        name: 'Zustand',
        art: 'auswahl',
        optionen: 'neu,defekt',
        pflicht: false,
        sensitiv: false
      }],
      blocks: []
    };
    render(TypeEditor, { props: { type, existingTypes: [type], onSave, onCancel: vi.fn() } });

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Gerät');
    expect((screen.getByLabelText('Auswahlwert 1') as HTMLInputElement).value).toBe('neu');
    expect((screen.getByLabelText('Auswahlwert 2') as HTMLInputElement).value).toBe('defekt');

    await fireEvent.input(screen.getByLabelText('Feldname'), { target: { value: '' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Bitte gib für jedes Feld einen Namen ein.');
  });

  it('definiert Felder für einen Block und speichert die Komponente mit dem Typ', async () => {
    const onSave = vi.fn();
    render(TypeEditor, {
      props: { type: null, existingTypes: [], existingComponents: [], onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Projektor' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Baustein hinzufügen' }));
    await fireEvent.input(screen.getByPlaceholderText('z. B. port'), { target: { value: 'port' } });
    await fireEvent.input(screen.getByPlaceholderText('z. B. Port'), { target: { value: 'Port' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Komponentenfeld' }));
    await fireEvent.input(screen.getByLabelText('Komponentenfeldname'), { target: { value: 'kabel' } });
    await fireEvent.change(screen.getByLabelText('Komponenten-Eingabetyp'), { target: { value: 'asset_ref' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Typ-ID' }));
    await fireEvent.input(screen.getByLabelText('Komponenten-Asset-Typ'), { target: { value: 'hdmi-kabel' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'projektor', blocks: [{ compId: 'port', min: 0, max: 1 }] }),
      [{
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
      }]
    );
  });
});
