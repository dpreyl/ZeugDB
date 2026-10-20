import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import LocationForm from './LocationForm.svelte';

describe('LocationForm', () => {
  it('requires location identity and valid coordinates before saving', async () => {
    const onSave = vi.fn();
    render(LocationForm, { props: { onSave, onCancel: vi.fn() } });

    await fireEvent.input(screen.getByLabelText('ID'), { target: { value: 'punkt-1' } });
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Eingang' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Gib gültige Koordinaten ein.');

    await fireEvent.input(screen.getByLabelText('Breitengrad 1'), { target: { value: '0' } });
    await fireEvent.input(screen.getByLabelText('Längengrad 1'), { target: { value: '13.4' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith({
      id: 'punkt-1',
      name: 'Eingang',
      art: 'punkt',
      lat: 0,
      lon: 13.4,
      polygon: undefined,
      route: undefined
    });
  });

  it('initializes an edit from its location and exposes the room minimum', async () => {
    const onSave = vi.fn();
    render(LocationForm, {
      props: {
        location: {
          id: 'raum-1',
          name: 'Werkstatt',
          art: 'raum',
          polygon: [
            { lat: 52, lon: 13 },
            { lat: 52.1, lon: 13 },
            { lat: 52.1, lon: 13.1 }
          ]
        },
        onSave,
        onCancel: vi.fn()
      }
    });

    expect((screen.getByLabelText('ID') as HTMLInputElement).value).toBe('raum-1');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Werkstatt');
    expect(screen.getByLabelText('Koordinatenart').textContent).toContain('Raum');
    expect(screen.getAllByLabelText(/Breitengrad/)).toHaveLength(3);

    await fireEvent.click(screen.getByRole('button', { name: 'Koordinate 1 entfernen' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      'Ein Raum benötigt mindestens 3 Koordinaten.'
    );
  });
});
