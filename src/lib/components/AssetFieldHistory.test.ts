import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGitRepo: vi.fn(),
  getAssetFieldHistory: vi.fn()
}));

vi.mock('$lib/services/git.service', () => ({
  getGitRepo: mocks.getGitRepo
}));

vi.mock('$lib/services/git-history', () => ({
  getAssetFieldHistory: mocks.getAssetFieldHistory
}));

import AssetFieldHistory from './AssetFieldHistory.svelte';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AssetFieldHistory', () => {
  it('loads field-specific commit author, date, and value changes on demand', async () => {
    mocks.getGitRepo.mockResolvedValue({});
    mocks.getAssetFieldHistory.mockResolvedValue([{
      commit: 'commit-1',
      message: 'DGUV-Prüfung gespeichert',
      author: 'Dana',
      email: 'dana@example.test',
      timestamp: 1_800_000_000,
      before: null,
      after: '2026-10-28'
    }]);

    render(AssetFieldHistory, {
      props: { assetId: 'asset-1', fields: ['bezeichnung', 'pruefung[0].Prüfdatum'] }
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Feldhistorie anzeigen' }));
    await fireEvent.change(screen.getByLabelText('Feld'), {
      target: { value: 'pruefung[0].Prüfdatum' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Verlauf laden' }));

    expect(await screen.findByText('Dana')).toBeTruthy();
    expect(screen.getByText('DGUV-Prüfung gespeichert')).toBeTruthy();
    expect(screen.getByText('Nachher: 2026-10-28')).toBeTruthy();
    expect(mocks.getAssetFieldHistory).toHaveBeenCalledWith(
      {},
      'asset-1',
      'pruefung[0].Prüfdatum'
    );
  });

  it('does not query Git until the history action is opened and requested', async () => {
    render(AssetFieldHistory, { props: { assetId: 'asset-1', fields: ['bezeichnung'] } });

    expect(mocks.getGitRepo).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Feldhistorie anzeigen' }));
    expect(mocks.getGitRepo).not.toHaveBeenCalled();
  });
});
