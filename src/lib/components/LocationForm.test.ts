import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mapMocks = vi.hoisted(() => {
  const map = {
    setView: vi.fn(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 50.12345678, lng: 8.98765432 }))
  };
  map.setView.mockReturnValue(map);
  const layer = { addTo: vi.fn().mockReturnThis() };
  return { map, leaflet: { map: vi.fn(() => map), tileLayer: vi.fn(() => layer) } };
});

vi.mock('leaflet', () => ({ default: mapMocks.leaflet }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import LocationForm from './LocationForm.svelte';

describe('LocationForm', () => {
  beforeEach(() => localStorage.clear());

  it('restores unsaved location details and coordinates when the form is recreated', async () => {
    render(LocationForm, { props: { onSave: vi.fn(), onCancel: vi.fn() } });
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Werkstatt' } });
    await fireEvent.change(screen.getByLabelText('Koordinatenart'), { target: { value: 'raum' } });
    await fireEvent.input(screen.getByLabelText('Breitengrad 1'), { target: { value: '52.1' } });
    await waitFor(() => expect(localStorage.getItem('zeugdb:form-draft:location:new')).not.toBeNull());

    cleanup();
    render(LocationForm, { props: { onSave: vi.fn(), onCancel: vi.fn() } });

    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Werkstatt'));
    expect((screen.getByLabelText('Automatisch erzeugte ID') as HTMLInputElement).value)
      .toBe('werkstatt');
    expect((screen.getByLabelText('Breitengrad 1') as HTMLInputElement).value).toBe('52.1');
  });

  it('generates an ID from the name, saves without coordinates, and rejects partial coordinates', async () => {
    const onSave = vi.fn();
    render(LocationForm, { props: { onSave, onCancel: vi.fn() } });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Eingang' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith({
      id: 'eingang',
      name: 'Eingang',
      art: 'punkt',
      lat: undefined,
      lon: undefined,
      polygon: undefined,
      route: undefined
    });
    onSave.mockClear();

    await fireEvent.input(screen.getByLabelText('Breitengrad 1'), { target: { value: '52' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Gib gültige Koordinaten ein.');

    await fireEvent.input(screen.getByLabelText('Längengrad 1'), { target: { value: '13.4' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(localStorage.getItem('zeugdb:form-draft:location:new')).toBeNull();
    expect(onSave).toHaveBeenCalledWith({
      id: 'eingang',
      name: 'Eingang',
      art: 'punkt',
      lat: 52,
      lon: 13.4,
      polygon: undefined,
      route: undefined
    });
  });

  it('saves a room before its coordinates have been surveyed', async () => {
    const onSave = vi.fn();
    render(LocationForm, { props: { onSave, onCancel: vi.fn() } });
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Raum 101' } });
    await fireEvent.change(screen.getByLabelText('Koordinatenart'), { target: { value: 'raum' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith({
      id: 'raum-101',
      name: 'Raum 101',
      art: 'raum',
      lat: undefined,
      lon: undefined,
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

    expect((screen.getByLabelText('Standort-ID') as HTMLInputElement).value).toBe('raum-1');
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

  it('selects the parent from existing locations and generates a unique ID', async () => {
    const onSave = vi.fn();
    render(LocationForm, {
      props: {
        locations: [
          { id: 'campus', name: 'Campus' },
          { id: 'eingang', name: 'Eingang' }
        ],
        onSave,
        onCancel: vi.fn()
      }
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Eingang' } });
    expect((screen.getByLabelText('Automatisch erzeugte ID') as HTMLInputElement).value)
      .toBe('eingang-2');
    await fireEvent.change(screen.getByLabelText('Übergeordneter Standort'), {
      target: { value: 'campus' }
    });
    await fireEvent.input(screen.getByLabelText('Breitengrad 1'), { target: { value: '52' } });
    await fireEvent.input(screen.getByLabelText('Längengrad 1'), { target: { value: '13' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 'eingang-2',
      eltern: 'campus'
    }));
  });
  it('disables every field and blocks saving in read-only mode', async () => {
    const onSave = vi.fn();
    render(LocationForm, {
      props: {
        location: {
          id: 'raum-1',
          name: 'Werkstatt',
          art: 'raum',
          polygon: [{ lat: 52, lon: 13 }, { lat: 52.1, lon: 13 }, { lat: 52.1, lon: 13.1 }]
        },
        onSave,
        onCancel: vi.fn(),
        disabled: true
      }
    });

    expect(screen.getByRole('region', { name: 'Standortdetails' })).toBeTruthy();
    expect(screen.getByText('Werkstatt')).toBeTruthy();
    expect(screen.getByText('1. Breitengrad 52, Längengrad 13')).toBeTruthy();
    expect(screen.queryByLabelText('Automatisch erzeugte ID')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aktuellen Standort verwenden' })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sets the selected room corner from the precise map center', async () => {
    render(LocationForm, { props: { onSave: vi.fn(), onCancel: vi.fn() } });
    await fireEvent.change(screen.getByLabelText('Koordinatenart'), {
      target: { value: 'raum' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Koordinate 3 auf Karte wählen' }));

    const applyPosition = await screen.findByRole('button', { name: 'Position übernehmen' });
    await waitFor(() => expect((applyPosition as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(applyPosition);

    expect((screen.getByLabelText('Breitengrad 1') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Längengrad 2') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Breitengrad 3') as HTMLInputElement).value).toBe('50.123457');
    expect((screen.getByLabelText('Längengrad 3') as HTMLInputElement).value).toBe('8.987654');
  });

  it('offers map selection for a cable waypoint as well as a point', async () => {
    render(LocationForm, { props: { onSave: vi.fn(), onCancel: vi.fn() } });
    await fireEvent.click(screen.getByRole('button', { name: 'Koordinate 1 auf Karte wählen' }));
    const applyPoint = await screen.findByRole('button', { name: 'Position übernehmen' });
    await waitFor(() => expect((applyPoint as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(applyPoint);
    expect((screen.getByLabelText('Breitengrad 1') as HTMLInputElement).value).toBe('50.123457');

    await fireEvent.change(screen.getByLabelText('Koordinatenart'), {
      target: { value: 'leitung' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Koordinate 2 auf Karte wählen' }));
    const applyWaypoint = await screen.findByRole('button', { name: 'Position übernehmen' });
    await waitFor(() => expect((applyWaypoint as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(applyWaypoint);
    expect((screen.getByLabelText('Breitengrad 2') as HTMLInputElement).value).toBe('50.123457');
    expect((screen.getByLabelText('Längengrad 2') as HTMLInputElement).value).toBe('8.987654');
  });
});
