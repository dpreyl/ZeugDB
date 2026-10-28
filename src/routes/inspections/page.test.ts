import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assets: {
    all: [] as Array<{ id: string; type: string; location: string | null }>,
    fields: {} as Record<string, Record<string, string>>,
    blocks: {} as Record<string, any>,
    getFields: vi.fn((id: string) => mocks.assets.fields[id] ?? {}),
    getField: vi.fn((id: string, name: string) => mocks.assets.fields[id]?.[name]),
    getBlocks: vi.fn((id: string) => mocks.assets.blocks[id] ?? {}),
    findById: vi.fn((id: string) => mocks.assets.all.find(asset => asset.id === id)),
    reserveAssetId: vi.fn(() => 'asset-reserved'),
    createAsset: vi.fn(),
    updateAsset: vi.fn()
  },
  types: {
    all: [{
      id: 'elektro',
      name: 'Elektrogerät',
      fields: [{ nr: 0, name: 'Schutzklasse', art: 'auswahl', optionen: 'I|II', pflicht: true, sensitiv: false }],
      blocks: [{ compId: 'pruefung', min: 0, max: 50 }]
    }]
  },
  locations: {
    all: [
      { id: 'room-current', name: 'Raum 2', art: 'raum' },
      { id: 'room-old', name: 'Raum 1', art: 'raum' }
    ],
    findById: vi.fn((id: string) => mocks.locations.all.find(location => location.id === id))
  },
  foto: {
    fehle: false,
    uploadFoto: vi.fn().mockResolvedValue('fotos/asset-1/photo.png')
  },
  persistStore: vi.fn(),
  goto: vi.fn()
}));

vi.mock('$lib/stores/assets.store.svelte', () => ({ getAssetStore: () => mocks.assets }));
vi.mock('$lib/stores/types.store.svelte', () => ({ getTypesStore: () => mocks.types }));
vi.mock('$lib/stores/locations.store.svelte', () => ({ getLocationsStore: () => mocks.locations }));
vi.mock('$lib/stores/fotos.store.svelte', () => ({ getFotoStore: () => mocks.foto }));
vi.mock('$lib/stores/edit-mode.svelte', () => ({ getEditMode: () => ({ isEditing: true }) }));
vi.mock('$lib/services/init', () => ({ persistStore: mocks.persistStore }));
vi.mock('$lib/services/foto-init', () => ({ initFotoService: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

import InspectionPage from './+page.svelte';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.assets.all = [];
  mocks.assets.fields = {};
  mocks.assets.blocks = {};
});

afterEach(() => cleanup());

describe('DGUV-Prüfungsassistent', () => {
  it('sucht zuerst im ausgewählten Raum, erlaubt alle Räume und speichert die Prüfung', async () => {
    mocks.assets.all = [
      { id: 'asset-current', type: 'elektro', location: 'room-current' },
      { id: 'asset-existing', type: 'elektro', location: 'room-old' }
    ];
    mocks.assets.fields['asset-current'] = {
      bezeichnung: 'Bohrmaschine',
      Hersteller: 'Bosch',
      Modell: 'GBH 18V',
      Schutzklasse: 'I'
    };
    mocks.assets.fields['asset-existing'] = {
      bezeichnung: 'Akkuschrauber',
      Schutzklasse: 'I',
      foto_typenschild: 'fotos/label.jpg',
      foto_uebersicht: ''
    };
    mocks.assets.blocks['asset-existing'] = {
      pruefung: { '0': { Prüfergebnis: 'Bestanden' } }
    };
    localStorage.setItem('zeugdb:dguv-session', JSON.stringify({
      examiner: 'Alex Prüfer',
      locationId: 'room-current'
    }));

    render(InspectionPage);
    await waitFor(() => expect((screen.getByLabelText('Prüfungsraum') as HTMLSelectElement).value).toBe('room-current'));
    await fireEvent.input(screen.getByLabelText('Gerät oder Typ suchen'), {
      target: { value: 'Elektrogerät' }
    });
    const currentAssetResult = screen.getByRole('button', { name: /Bohrmaschine/ });
    expect(currentAssetResult.textContent).toContain('Bosch');
    expect(currentAssetResult.textContent).toContain('GBH 18V');
    expect(currentAssetResult.textContent).not.toContain('asset-current');
    expect(screen.queryByRole('button', { name: /Akkuschrauber/ })).toBeNull();
    await fireEvent.click(screen.getByLabelText('Alle Räume durchsuchen'));
    expect(screen.getByRole('button', { name: /Akkuschrauber/ })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /Akkuschrauber/ }));

    expect(screen.getByText('Wiederholungsprüfung')).toBeTruthy();
    expect(screen.getByText('Bild vorhanden')).toBeTruthy();
    await fireEvent.change(screen.getByLabelText('Schutzklasse'), { target: { value: 'II' } });
    await fireEvent.input(screen.getByLabelText('Isolationswiderstand (MΩ)'), { target: { value: '2.5' } });
    await fireEvent.input(screen.getByLabelText('Ableitstrom IBERÜH (mA)'), { target: { value: '0.4' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Prüfung speichern und nächste' }));

    expect(mocks.assets.updateAsset).toHaveBeenCalledWith('asset-existing', expect.objectContaining({
      location: 'room-current',
      fields: expect.objectContaining({ Schutzklasse: 'II' }),
      blocks: {
        pruefung: {
          '0': { Prüfergebnis: 'Bestanden' },
          '1': expect.objectContaining({
            Prüfer: 'Alex Prüfer',
            Prüfart: 'Wiederholungsprüfung',
            Schutzklasse: 'II',
            'Isolationswiderstand (MOhm)': '2.5',
            'Ableitstrom IBERÜH (mA)': '0.4',
            'Prüfergebnis': 'Bestanden'
          })
        }
      }
    }));
  });

  it('legt ein neues Gerät mit Erstprüfung an und verlangt Messwerte abhängig von SK I', async () => {
    localStorage.setItem('zeugdb:dguv-session', JSON.stringify({
      examiner: 'Sam Prüfer',
      locationId: 'room-current'
    }));
    render(InspectionPage);
    await fireEvent.input(screen.getByLabelText('Gerät oder Typ suchen'), {
      target: { value: 'Neuer Winkelschleifer' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Neues Gerät erfassen' }));
    await fireEvent.input(screen.getByLabelText('Bezeichnung'), { target: { value: 'Winkelschleifer Werkstatt' } });
    await fireEvent.change(screen.getByLabelText('Gerätetyp'), { target: { value: 'elektro' } });
    await fireEvent.change(screen.getByLabelText('Schutzklasse'), { target: { value: 'I' } });
    await fireEvent.input(screen.getByLabelText('Schutzleiterwiderstand (Ω)'), { target: { value: '0.2' } });
    await fireEvent.input(screen.getByLabelText('Isolationswiderstand (MΩ)'), { target: { value: '2.1' } });
    await fireEvent.input(screen.getByLabelText('Ableitstrom IPE (mA)'), { target: { value: '0.3' } });
    expect((screen.getByLabelText('Prüfergebnis') as HTMLSelectElement).value).toBe('Bestanden');
    await fireEvent.change(screen.getByLabelText('Prüfergebnis'), { target: { value: 'Nicht bestanden' } });
    await fireEvent.input(screen.getByLabelText('Festgestellte Mängel'), {
      target: { value: 'Gehäuse beschädigt' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Prüfung speichern und nächste' }));

    await waitFor(() => expect(mocks.assets.createAsset).toHaveBeenCalled());
    expect(mocks.assets.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      type: 'elektro',
      location: 'room-current',
      fields: expect.objectContaining({
        bezeichnung: 'Winkelschleifer Werkstatt',
        Schutzklasse: 'I'
      }),
      blocks: {
        pruefung: {
          '0': expect.objectContaining({
            Prüfer: 'Sam Prüfer',
            Prüfart: 'Erstprüfung',
            Prüfergebnis: 'Nicht bestanden',
            Mängel: 'Gehäuse beschädigt',
            'Schutzleiterwiderstand (Ohm)': '0.2',
            'Isolationswiderstand (MOhm)': '2.1',
            'Ableitstrom IPE (mA)': '0.3'
          })
        }
      }
    }));
    expect(mocks.assets.updateAsset).not.toHaveBeenCalled();
  });
});
