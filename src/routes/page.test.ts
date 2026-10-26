import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAssetStore, resetAssetStore } from '$lib/stores/assets.store.svelte';
import Page from './+page.svelte';

describe('Assets-Seite', () => {
  beforeEach(() => {
    resetAssetStore();
  });

  afterEach(() => {
    cleanup();
    resetAssetStore();
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
});
