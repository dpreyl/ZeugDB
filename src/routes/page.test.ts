import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAssetStore, resetAssetStore } from '$lib/stores/assets.store.svelte';
import { getLocationsStore, resetLocationsStore } from '$lib/stores/locations.store.svelte';
import Page from './+page.svelte';

describe('Assets-Seite', () => {
  beforeEach(() => {
    resetAssetStore();
    resetLocationsStore();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    resetAssetStore();
    resetLocationsStore();
  });

  it('zeigt Assets an, die nach dem initialen Seiten-Load in den Store geladen werden', async () => {
    render(Page, { props: { data: { assets: [] } } as never });
    const id = getAssetStore().createAsset({ type: 'projektor' });

    await waitFor(() => expect(screen.getByText(id)).toBeTruthy());
  });

  it('zeigt die Asset-Bezeichnung statt der technischen ID als primären Eintrag', async () => {
    render(Page, { props: { data: { assets: [] } } as never });
    const id = getAssetStore().createAsset({ type: 'projektor' });
    getAssetStore().setFields(id, { bezeichnung: 'Konferenzprojektor' });

    await waitFor(() => expect(screen.getByText('Konferenzprojektor')).toBeTruthy());
    expect(screen.getByText('Konferenzprojektor').textContent).not.toContain(id);
  });

  it('filtert die Asset-Liste nach den ausgewählten Werten einer Spalte', async () => {
    const store = getAssetStore();
    store.createAsset({ type: 'projektor', fields: { bezeichnung: 'Projektor Saal 1' } });
    store.createAsset({ type: 'hdmi-kabel', fields: { bezeichnung: 'HDMI Kabel' } });
    render(Page, { props: { data: { assets: [] } } as never });

    await fireEvent.click(screen.getByRole('button', { name: 'Filter Typ' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'hdmi-kabel' }));

    expect(screen.getByText('Projektor Saal 1')).toBeTruthy();
    expect(screen.queryByText('HDMI Kabel')).toBeNull();
    expect(screen.getByText(/1 von 2 Einträgen/)).toBeTruthy();
  });

  it('zeigt lesbare Standortpfade und filtert Assets über den übergeordneten Standort', async () => {
    getLocationsStore().setAll([
      { id: 'house-1', name: 'Haus 1', art: 'raum' },
      { id: 'room-a', name: 'Raum A', eltern: 'house-1', art: 'raum' },
      { id: 'house-2', name: 'Haus 2', art: 'raum' },
      { id: 'room-b', name: 'Raum B', eltern: 'house-2', art: 'raum' }
    ]);
    const store = getAssetStore();
    store.createAsset({
      id: 'asset-a',
      type: 'projektor',
      location: 'room-a',
      fields: { bezeichnung: 'Projektor Haus 1' }
    });
    store.createAsset({
      id: 'asset-b',
      type: 'projektor',
      location: 'room-b',
      fields: { bezeichnung: 'Projektor Haus 2' }
    });
    render(Page, { props: { data: { assets: [] } } as never });

    expect(screen.getByText('Haus 1 › Raum A')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Filter Standort' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Haus 2' }));

    expect(screen.getByText('Projektor Haus 1')).toBeTruthy();
    expect(screen.queryByText('Projektor Haus 2')).toBeNull();
  });

  it('sucht Geräte anhand von Bezeichnung und gespeicherten Gerätedaten', async () => {
    const store = getAssetStore();
    store.createAsset({
      type: 'projektor',
      fields: { bezeichnung: 'Projektor Werkstatt', seriennummer: 'SN-8421' }
    });
    store.createAsset({
      type: 'monitor',
      fields: { bezeichnung: 'Monitor Büro', seriennummer: 'MN-105' }
    });
    render(Page, { props: { data: { assets: [] } } as never });

    await fireEvent.input(screen.getByRole('searchbox', { name: 'Assets suchen' }), {
      target: { value: 'sn-8421' }
    });

    expect(screen.getByText('Projektor Werkstatt')).toBeTruthy();
    expect(screen.queryByText('Monitor Büro')).toBeNull();
    expect(screen.getByText(/1 von 2 Einträgen/)).toBeTruthy();
  });

  it('stellt den Standortfilter nach dem Zurückkehren zur Liste wieder her', async () => {
    getLocationsStore().setAll([
      { id: 'house-1', name: 'Haus 1', art: 'raum' },
      { id: 'room-a', name: 'Raum A', eltern: 'house-1', art: 'raum' },
      { id: 'house-2', name: 'Haus 2', art: 'raum' },
      { id: 'room-b', name: 'Raum B', eltern: 'house-2', art: 'raum' }
    ]);
    const store = getAssetStore();
    store.createAsset({ id: 'asset-a', type: 'kamera', location: 'room-a', fields: { bezeichnung: 'Kamera Haus 1' } });
    store.createAsset({ id: 'asset-b', type: 'kamera', location: 'room-b', fields: { bezeichnung: 'Kamera Haus 2' } });

    const { unmount } = render(Page, { props: { data: { assets: [] } } as never });
    await fireEvent.click(screen.getByRole('button', { name: 'Filter Standort' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Haus 1' }));
    expect(screen.queryByText('Kamera Haus 1')).toBeNull();

    unmount();
    render(Page, { props: { data: { assets: [] } } as never });

    await waitFor(() => {
      expect(screen.getByText('Kamera Haus 2')).toBeTruthy();
    });
    expect(screen.queryByText('Kamera Haus 1')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Filter Standort' }));
    expect((screen.getByRole('checkbox', { name: 'Haus 1' }) as HTMLInputElement).checked).toBe(false);
  });
});
