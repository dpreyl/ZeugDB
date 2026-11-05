import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

const recoveryMocks = vi.hoisted(() => ({
  scanLocalAssetHistory: vi.fn(),
  serializeRecoveryScan: vi.fn()
}));

vi.mock('$lib/services/git.service', () => ({
  loadGitConfig: () => null,
  saveGitConfig: vi.fn(),
  cloneRepo: vi.fn(),
  initRepo: vi.fn(),
  getGitRepo: vi.fn(),
  getSyncStatus: vi.fn().mockResolvedValue({
    initialized: true,
    remoteUrl: 'http://example.test/repo',
    hasChanges: false
  })
}));
vi.mock('$lib/services/asset-recovery', () => recoveryMocks);

describe('Einstellungen', () => {
  afterEach(() => cleanup());

  it('versteckt direkte Commit-, Push- und Pull-Aktionen zugunsten des geschützten Syncs', () => {
    render(Page);

    expect(screen.queryByRole('button', { name: 'Änderungen committen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Push (zum Server)' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pull (vom Server)' })).toBeNull();
    expect(screen.getByText(/Verwende für Änderungen ausschließlich den Sync-Knopf/)).toBeTruthy();
  });

  it('führt einen nur lesenden Wiederherstellungs-Scan aus und zeigt Fundstellen an', async () => {
    recoveryMocks.scanLocalAssetHistory.mockResolvedValue({
      versions: [{
        assetId: 'asset-1',
        path: 'assets/asset-1.asset',
        content: 'id: asset-1',
        commitOid: 'abc12345',
        message: 'Vor dem Verlust',
        date: '2026-11-05T16:00:00.000Z',
        source: 'refs/heads/main'
      }],
      refsScanned: ['refs/heads/main'],
      commitsScanned: 3,
      looseObjectsScanned: 8,
      truncated: false,
      warnings: []
    });
    render(Page);

    await fireEvent.click(await screen.findByRole('button', {
      name: 'Lokale Daten auf Wiederherstellung prüfen'
    }));

    expect(recoveryMocks.scanLocalAssetHistory).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText(/1 mögliche Asset-Version in 3 Commits gefunden/)).toBeTruthy());
    expect(screen.getByText(/asset-1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scan-Ergebnis als JSON herunterladen' })).toBeTruthy();
  });
});
