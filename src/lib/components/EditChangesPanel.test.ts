import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGitRepo: vi.fn(),
  getEditBranchChanges: vi.fn()
}));

vi.mock('$lib/services/git.service', () => ({
  getGitRepo: mocks.getGitRepo
}));

vi.mock('$lib/services/git-history', () => ({
  getEditBranchChanges: mocks.getEditBranchChanges
}));

import EditChangesPanel from './EditChangesPanel.svelte';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EditChangesPanel', () => {
  it('loads and displays pending field changes from the local edit branch', async () => {
    mocks.getGitRepo.mockResolvedValue({});
    mocks.getEditBranchChanges.mockResolvedValue({
      branch: 'edit/test-session',
      base: 'main',
      files: [{
        path: 'assets/asset-1.asset',
        status: 'modified',
        fields: [{ field: 'bezeichnung', before: 'Alt', after: 'Neu' }]
      }]
    });

    render(EditChangesPanel, { props: { branch: 'edit/test-session', onClose: vi.fn() } });

    expect(await screen.findByText('bezeichnung')).toBeTruthy();
    expect(screen.getByText('Alt')).toBeTruthy();
    expect(screen.getByText('Neu')).toBeTruthy();
    expect(mocks.getEditBranchChanges).toHaveBeenCalledWith({}, 'edit/test-session');
  });

  it('shows an explicit empty state when no changes are pending', async () => {
    mocks.getGitRepo.mockResolvedValue({});
    mocks.getEditBranchChanges.mockResolvedValue({
      branch: 'edit/test-session',
      base: 'main',
      files: []
    });

    render(EditChangesPanel, { props: { branch: 'edit/test-session', onClose: vi.fn() } });

    expect(await screen.findByText('Keine offenen Änderungen.')).toBeTruthy();
  });
});
