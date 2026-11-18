import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitRepo } from '$lib/git/repo';

const gitMocks = vi.hoisted(() => ({
  listFiles: vi.fn(),
  listRefs: vi.fn(),
  log: vi.fn(),
  readBlob: vi.fn(),
  isDescendent: vi.fn(),
  resolveRef: vi.fn()
}));

vi.mock('isomorphic-git', () => gitMocks);

import {
  archiveEditBranchHistory,
  getAssetFieldHistory,
  getEditBranchChanges,
  getLatestEditSummary
} from './git-history';

function repo(): GitRepo {
  return { getFs: () => ({}) } as unknown as GitRepo;
}

describe('archiveEditBranchHistory', () => {
  it('keeps the per-save commits reachable under a local history ref', async () => {
    const archiveBranch = vi.fn().mockResolvedValue(undefined);
    const branchRepo = { archiveBranch } as unknown as GitRepo;

    await archiveEditBranchHistory(branchRepo, 'edit/user-session');

    expect(archiveBranch).toHaveBeenCalledWith('edit/user-session', 'history/user-session');
  });

  it('does not change refs when archiving fails', async () => {
    const archiveBranch = vi.fn().mockRejectedValue(new Error('Archive failed'));
    const branchRepo = { archiveBranch } as unknown as GitRepo;

    await expect(archiveEditBranchHistory(branchRepo, 'edit/user-session'))
      .rejects.toThrow('Archive failed');
  });

  it('rejects refs outside the edit namespace', async () => {
    const archiveBranch = vi.fn();

    await expect(archiveEditBranchHistory({ archiveBranch } as unknown as GitRepo, 'main'))
      .rejects.toThrow('Nur Edit-Branches können archiviert werden');
    expect(archiveBranch).not.toHaveBeenCalled();
  });
});

function blob(content: string) {
  return { blob: new TextEncoder().encode(content) };
}

describe('getEditBranchChanges', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reports added, modified, and deleted files with asset field values', async () => {
    gitMocks.resolveRef.mockImplementation(async ({ ref }: { ref: string }) =>
      ref === 'main' ? 'base-commit' : 'edit-commit'
    );
    gitMocks.listFiles.mockImplementation(async ({ ref }: { ref: string }) =>
      ref === 'main'
        ? ['assets/asset-1.asset', 'assets/asset-deleted.asset', 'locations/room.location']
        : ['assets/asset-1.asset', 'assets/asset-new.asset', 'locations/room.location']
    );
    gitMocks.readBlob.mockImplementation(async ({ oid, filepath }: { oid: string; filepath: string }) => {
      const files: Record<string, string> = {
        'base-commit:assets/asset-1.asset': 'id: asset-1\nbezeichnung: Alt\n',
        'edit-commit:assets/asset-1.asset': 'id: asset-1\nbezeichnung: Neu\n',
        'base-commit:assets/asset-deleted.asset': 'id: asset-deleted\nbezeichnung: Gelöscht\n',
        'edit-commit:assets/asset-new.asset': 'id: asset-new\nbezeichnung: Neu angelegt\n',
        'base-commit:locations/room.location': 'id: room\nname: Alt\n',
        'edit-commit:locations/room.location': 'id: room\nname: Neu\n'
      };
      return blob(files[`${oid}:${filepath}`]);
    });

    await expect(getEditBranchChanges(repo(), 'edit/test')).resolves.toEqual({
      branch: 'edit/test',
      base: 'main',
      files: [
        {
          path: 'assets/asset-1.asset',
          status: 'modified',
          fields: [{ field: 'bezeichnung', before: 'Alt', after: 'Neu' }]
        },
        {
          path: 'assets/asset-deleted.asset',
          status: 'deleted',
          fields: [
            { field: 'bezeichnung', before: 'Gelöscht', after: null },
            { field: 'id', before: 'asset-deleted', after: null }
          ]
        },
        {
          path: 'assets/asset-new.asset',
          status: 'added',
          fields: [
            { field: 'bezeichnung', before: null, after: 'Neu angelegt' },
            { field: 'id', before: null, after: 'asset-new' }
          ]
        },
        {
          path: 'locations/room.location',
          status: 'modified',
          fields: [{ field: 'Dateiinhalt', before: 'name: Alt', after: 'name: Neu' }]
        }
      ]
    });
  });
});

describe('getAssetFieldHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the selected field changes with the Git author and timestamp', async () => {
    gitMocks.listRefs.mockResolvedValue(['main', 'history/session']);
    const inspectionPath = 'assets/asset-1.asset';
    const changedCommit = {
      oid: 'inspection-commit',
      commit: {
        message: 'DGUV-Prüfung gespeichert',
        author: { name: 'Ada', email: 'ada@example.test', timestamp: 1_800_000_000 },
        changes: [['after-blob', 'before-blob', inspectionPath]]
      }
    };
    gitMocks.log.mockResolvedValue([changedCommit]);
    gitMocks.readBlob.mockImplementation(async ({ oid }: { oid: string }) => {
      const contents: Record<string, string> = {
        'before-blob': 'id: asset-1\nbezeichnung: Mischpult\n',
        'after-blob': 'id: asset-1\nbezeichnung: Mischpult\npruefung[0].Prüfdatum: 2026-10-28\n'
      };
      return blob(contents[oid]);
    });

    await expect(getAssetFieldHistory(repo(), 'asset-1', 'pruefung[0].Prüfdatum'))
      .resolves.toEqual([{
        commit: 'inspection-commit',
        message: 'DGUV-Prüfung gespeichert',
        author: 'Ada',
        email: 'ada@example.test',
        timestamp: 1_800_000_000,
        before: null,
        after: '2026-10-28'
      }]);
  });

  it('omits commits that changed a different field and de-duplicates shared commits', async () => {
    gitMocks.listRefs.mockResolvedValue(['main', 'history/session']);
    const otherFieldCommit = {
      oid: 'rename-commit',
      commit: {
        message: 'Asset umbenannt',
        author: { name: 'Ada', email: 'ada@example.test', timestamp: 1_800_000_001 },
        changes: [['rename-after', 'rename-before', 'assets/asset-1.asset']]
      }
    };
    gitMocks.log.mockResolvedValue([otherFieldCommit]);
    gitMocks.readBlob.mockImplementation(async ({ oid }: { oid: string }) => blob(
      oid === 'rename-before'
        ? 'id: asset-1\nbezeichnung: Alt\n'
        : 'id: asset-1\nbezeichnung: Neu\n'
    ));

    await expect(getAssetFieldHistory(repo(), 'asset-1', 'pruefung[0].Prüfdatum'))
      .resolves.toEqual([]);
    expect(gitMocks.log).toHaveBeenCalledTimes(4);
  });
});

describe('getLatestEditSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses the designation of the latest changed asset instead of its file name', async () => {
    gitMocks.resolveRef.mockImplementation(async ({ ref }: { ref: string }) =>
      ref === 'main' ? 'main-commit' : 'edit-commit'
    );
    gitMocks.log.mockResolvedValue([{
      oid: 'edit-commit',
      commit: {
        message: 'DGUV-Prüfung gespeichert: asset-307',
        changes: [['asset-after', 'asset-before', 'assets/asset-307.asset']]
      }
    }]);
    gitMocks.readBlob.mockResolvedValue(blob(
      'id: asset-307\nbezeichnung: 307 Wandlampe 2 rechts\nlocation: raum-2\n'
    ));

    await expect(getLatestEditSummary(repo(), 'edit/test'))
      .resolves.toEqual({
        label: '307 Wandlampe 2 rechts',
        locationId: 'raum-2'
      });
  });

  it('returns no summary when the edit branch has no commits beyond its base', async () => {
    gitMocks.resolveRef.mockResolvedValue('same-commit');

    await expect(getLatestEditSummary(repo(), 'edit/test')).resolves.toBeNull();
    expect(gitMocks.log).not.toHaveBeenCalled();
  });

  it('returns no summary when the edit branch is behind a moved base branch', async () => {
    gitMocks.resolveRef.mockImplementation(async ({ ref }: { ref: string }) =>
      ref === 'main' ? 'new-main' : 'old-main'
    );
    gitMocks.isDescendent.mockResolvedValue(true);

    await expect(getLatestEditSummary(repo(), 'edit/test')).resolves.toBeNull();
    expect(gitMocks.log).not.toHaveBeenCalled();
  });

  it('leaves the location out when the changed asset has no location', async () => {
    gitMocks.resolveRef.mockImplementation(async ({ ref }: { ref: string }) =>
      ref === 'main' ? 'main-commit' : 'edit-commit'
    );
    gitMocks.log.mockResolvedValue([{
      oid: 'edit-commit',
      commit: {
        message: 'Asset gespeichert',
        changes: [['asset-after', 'asset-before', 'assets/asset-307.asset']]
      }
    }]);
    gitMocks.readBlob.mockResolvedValue(blob('id: asset-307\nbezeichnung: Wandlampe\n'));

    await expect(getLatestEditSummary(repo(), 'edit/test'))
      .resolves.toEqual({ label: 'Wandlampe' });
  });

  it('falls back to the commit message when the latest change is not an asset', async () => {
    gitMocks.resolveRef.mockImplementation(async ({ ref }: { ref: string }) =>
      ref === 'main' ? 'main-commit' : 'edit-commit'
    );
    gitMocks.log.mockResolvedValue([{
      oid: 'edit-commit',
      commit: {
        message: 'Standort gespeichert: Saal 2',
        changes: [['location-after', 'location-before', 'locations/saal-2.location']]
      }
    }]);

    await expect(getLatestEditSummary(repo(), 'edit/test'))
      .resolves.toEqual({ label: 'Standort gespeichert: Saal 2' });
  });
});
