import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TypeEditor from './TypeEditor.svelte';
import type { TypeDefinition } from '$lib/parser/types';

describe('TypeEditor', () => {
  beforeEach(() => localStorage.clear());

  it('restores an unsaved type definition when the editor is recreated', async () => {
    render(TypeEditor, {
      props: { type: null, existingTypes: [], onSave: vi.fn(), onCancel: vi.fn() }
    });
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Projektor' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Feld hinzufügen' }));
    await fireEvent.input(screen.getByLabelText('Feldname'), { target: { value: 'Leistung' } });
    await waitFor(() => expect(localStorage.getItem('zeugdb:form-draft:type:new')).not.toBeNull());

    cleanup();
    render(TypeEditor, {
      props: { type: null, existingTypes: [], onSave: vi.fn(), onCancel: vi.fn() }
    });

    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Projektor'));
    expect((screen.getByLabelText('Feldname') as HTMLInputElement).value).toBe('Leistung');
  });

  it('sorts parent types by their visible names', () => {
    render(TypeEditor, {
      props: {
        type: null,
        existingTypes: [
          { id: 'zebra', name: 'Zebra', fields: [], blocks: [] },
          { id: 'type-10', name: 'Typ 10', fields: [], blocks: [] },
          { id: 'alpha', name: 'Alpha', fields: [], blocks: [] },
          { id: 'type-2', name: 'Typ 2', fields: [], blocks: [] }
        ] as TypeDefinition[],
        onSave: vi.fn(),
        onCancel: vi.fn()
      }
    });

    const parentSelect = screen.getByLabelText('Basiert auf') as HTMLSelectElement;
    expect([...parentSelect.options].map(option => option.textContent)).toEqual([
      'Keine Vererbung', 'Alpha', 'Typ 2', 'Typ 10', 'Zebra'
    ]);
  });

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

    expect(localStorage.getItem('zeugdb:form-draft:type:new')).toBeNull();
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
    });
  });

  it('offers an image field type for asset types', async () => {
    const onSave = vi.fn();
    render(TypeEditor, {
      props: { type: null, existingTypes: [], onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Kamera' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Feld hinzufügen' }));
    await fireEvent.input(screen.getByLabelText('Feldname'), { target: { value: 'Typenschild' } });
    await fireEvent.change(screen.getByLabelText('Eingabetyp'), { target: { value: 'image' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      fields: [expect.objectContaining({ name: 'Typenschild', art: 'image' })]
    }));
  });

  it('offers decimal number and multiple-image fields for asset types', async () => {
    const onSave = vi.fn();
    render(TypeEditor, {
      props: { type: null, existingTypes: [], onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Prüfgerät' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Feld hinzufügen' }));
    await fireEvent.input(screen.getByLabelText('Feldname'), { target: { value: 'Messwert' } });
    await fireEvent.change(screen.getByLabelText('Eingabetyp'), { target: { value: 'decimal' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Feld hinzufügen' }));
    await fireEvent.input(screen.getAllByLabelText('Feldname')[1], { target: { value: 'Mängelfotos' } });
    await fireEvent.change(screen.getAllByLabelText('Eingabetyp')[1], { target: { value: 'images' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      fields: [
        expect.objectContaining({ name: 'Messwert', art: 'decimal' }),
        expect.objectContaining({ name: 'Mängelfotos', art: 'images' })
      ]
    }));
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

  it('referenziert eine bestehende Komponente, ohne ihre Felder im Typ zu bearbeiten', async () => {
    const onSave = vi.fn();
    const port = {
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
    };
    render(TypeEditor, {
      props: { type: null, existingTypes: [], existingComponents: [port], onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Projektor' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Baustein hinzufügen' }));
    await fireEvent.change(screen.getByLabelText('Baustein-Komponente'), { target: { value: 'port' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(screen.queryByText('Felder für Port')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Komponentenfeld' })).toBeNull();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 'projektor',
      blocks: [{ compId: 'port', min: 0, max: 1 }]
    }));
    expect(onSave.mock.calls[0]).toHaveLength(1);
  });

  it('verlangt eine vorhandene Komponente für jeden Baustein', async () => {
    const onSave = vi.fn();
    render(TypeEditor, {
      props: { type: null, existingTypes: [], existingComponents: [], onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Projektor' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Baustein hinzufügen' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Bitte wähle eine vorhandene Komponente aus.');
  });

  it('legt einen festen Komponentenfeldwert am Typ statt an der Komponente fest', async () => {
    const onSave = vi.fn();
    const port = {
      id: 'port',
      name: 'Port',
      fields: [{
        nr: 0,
        name: 'anschlusstyp',
        art: 'dropdown',
        optionen: 'HDMI|SDI|USB',
        pflicht: false,
        sensitiv: false
      }]
    };
    render(TypeEditor, {
      props: { type: null, existingTypes: [], existingComponents: [port], onSave, onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'HDMI-Kabel' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Baustein hinzufügen' }));
    await fireEvent.change(screen.getByLabelText('Baustein-Komponente'), { target: { value: 'port' } });
    await fireEvent.change(screen.getByLabelText('Fester Wert für anschlusstyp'), { target: { value: 'HDMI' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      blocks: [{
        compId: 'port',
        min: 0,
        max: 1,
        fixedFields: { anschlusstyp: 'HDMI' }
      }]
    }));
  });

  it('weist feste Bildwerte zurück, weil Komponentenbilder pro Asset hochgeladen werden', async () => {
    const port = {
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
    };
    render(TypeEditor, {
      props: { type: null, existingTypes: [], existingComponents: [port], onSave: vi.fn(), onCancel: vi.fn() }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Projektor' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Baustein hinzufügen' }));
    await fireEvent.change(screen.getByLabelText('Baustein-Komponente'), { target: { value: 'port' } });

    expect(screen.getByText('Bilder werden pro Asset hochgeladen.')).toBeTruthy();
    expect(screen.queryByLabelText('Fester Wert für Mängelfotos')).toBeNull();
  });
});
