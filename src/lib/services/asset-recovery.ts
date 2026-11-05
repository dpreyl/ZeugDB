import * as git from 'isomorphic-git';
import type { GitRepo } from '../git/repo';
import { getAssetStore } from '../stores/assets.store.svelte';
import { serializeAssetFile } from './init';

const MAX_COMMITS_PER_REF = 250;
const MAX_LOOSE_OBJECTS = 10_000;

export interface RecoveredAssetVersion {
  assetId: string;
  path: string;
  content: string;
  commitOid: string | null;
  message: string;
  date: string | null;
  source: string;
}

export interface AssetRecoveryScan {
  versions: RecoveredAssetVersion[];
  refsScanned: string[];
  commitsScanned: number;
  looseObjectsScanned: number;
  truncated: boolean;
  warnings: string[];
}

interface CommitCandidate {
  oid: string;
  message: string;
  timestamp: number | null;
  source: string;
  changes?: Array<Array<string | null>>;
}

/**
 * Searches local Git refs, commit history, dangling loose commits, and the
 * working tree for asset versions that differ from the current app store.
 * The scan only reads data; it never changes refs, files, or application stores.
 */
export async function scanLocalAssetHistory(repo: GitRepo): Promise<AssetRecoveryScan> {
  const fs = repo.getFs();
  const refs = await listRecoveryRefs(fs);
  const warnings: string[] = [];
  const versions = new Map<string, RecoveredAssetVersion>();
  const currentAssets = new Map(
    getAssetStore().all.flatMap(row => {
      const asset = getAssetStore().findFull(row.id);
      return asset ? [[`assets/${encodeURIComponent(row.id)}.asset`, serializeAssetFile(asset)] as const] : [];
    })
  );
  const scannedCommits = new Set<string>();
  let truncated = false;

  for (const ref of refs) {
    let commits: Awaited<ReturnType<typeof git.log>>;
    try {
      commits = await git.log({
        fs,
        dir: '/',
        ref,
        depth: MAX_COMMITS_PER_REF,
        includeChanges: true
      });
    } catch (error) {
      warnings.push(`Historie für ${ref} konnte nicht gelesen werden: ${errorMessage(error)}`);
      continue;
    }
    if (commits.length === MAX_COMMITS_PER_REF) truncated = true;
    for (const entry of commits) {
      const candidate = commitCandidate(entry.oid, entry.commit, ref);
      if (scannedCommits.has(candidate.oid)) continue;
      scannedCommits.add(candidate.oid);
      await collectCommitAssets(fs, candidate, currentAssets, versions, warnings);
    }
  }

  const loose = await findLooseCommits(repo, fs, warnings);
  const looseObjectsScanned = loose.scanned;
  truncated ||= loose.truncated;
  for (const candidate of loose.commits) {
    if (scannedCommits.has(candidate.oid)) continue;
    scannedCommits.add(candidate.oid);
    await collectCommitAssets(fs, candidate, currentAssets, versions, warnings);
  }

  await collectWorkingTreeAssets(repo, currentAssets, versions, warnings);

  const sortedVersions = [...versions.values()].sort((left, right) =>
    (right.date ?? '').localeCompare(left.date ?? '')
  );
  return {
    versions: sortedVersions,
    refsScanned: refs,
    commitsScanned: scannedCommits.size,
    looseObjectsScanned,
    truncated,
    warnings
  };
}

export function serializeRecoveryScan(scan: AssetRecoveryScan): string {
  return JSON.stringify(scan, null, 2);
}

async function listRecoveryRefs(fs: ReturnType<GitRepo['getFs']>): Promise<string[]> {
  const groups = ['refs/heads', 'refs/remotes', 'refs/tags'];
  const refs = new Set<string>();
  for (const group of groups) {
    try {
      for (const name of await git.listRefs({ fs, dir: '/', filepath: group })) {
        refs.add(`${group}/${name}`);
      }
    } catch {
      // Missing ref groups are normal for a new or partially initialized repo.
    }
  }
  return [...refs].sort();
}

async function collectCommitAssets(
  fs: ReturnType<GitRepo['getFs']>,
  commit: CommitCandidate,
  currentAssets: Map<string, string>,
  versions: Map<string, RecoveredAssetVersion>,
  warnings: string[]
): Promise<void> {
  if (commit.changes) {
    for (const change of commit.changes) {
      const [newOid, oldOid, path] = change;
      if (!path?.startsWith('assets/') || !path.endsWith('.asset')) continue;
      for (const blobOid of new Set([newOid, oldOid].filter((oid): oid is string => oid !== null))) {
        try {
          const { blob } = await git.readBlob({ fs, dir: '/', oid: blobOid });
          addVersion(path, new TextDecoder().decode(blob), commit, currentAssets, versions);
        } catch (error) {
          warnings.push(`Asset-Datei ${path} in Commit ${commit.oid.slice(0, 8)} konnte nicht gelesen werden: ${errorMessage(error)}`);
        }
      }
    }
    return;
  }

  let paths: string[];
  try {
    paths = await git.listFiles({ fs, dir: '/', ref: commit.oid });
  } catch (error) {
    warnings.push(`Dateiliste in Commit ${commit.oid.slice(0, 8)} konnte nicht gelesen werden: ${errorMessage(error)}`);
    return;
  }

  for (const path of paths.filter(file => file.startsWith('assets/') && file.endsWith('.asset'))) {
    try {
      const { blob } = await git.readBlob({ fs, dir: '/', oid: commit.oid, filepath: path });
      const content = new TextDecoder().decode(blob);
      addVersion(path, content, commit, currentAssets, versions);
    } catch (error) {
      warnings.push(`Asset-Datei ${path} in Commit ${commit.oid.slice(0, 8)} konnte nicht gelesen werden: ${errorMessage(error)}`);
    }
  }
}

async function collectWorkingTreeAssets(
  repo: GitRepo,
  currentAssets: Map<string, string>,
  versions: Map<string, RecoveredAssetVersion>,
  warnings: string[]
): Promise<void> {
  let files: string[];
  try {
    files = (await repo.readdir('assets')).filter(file => file.endsWith('.asset'));
  } catch (error) {
    if (isMissingPath(error)) return;
    warnings.push(`Lokale Asset-Dateien konnten nicht aufgelistet werden: ${errorMessage(error)}`);
    return;
  }

  for (const file of files) {
    const path = `assets/${file}`;
    try {
      const content = await repo.readFile(path);
      addVersion(path, content, {
        oid: '',
        message: 'Nicht committete Datei im lokalen Arbeitsverzeichnis',
        timestamp: null,
        source: 'Lokales Arbeitsverzeichnis'
      }, currentAssets, versions, null);
    } catch (error) {
      warnings.push(`Lokale Asset-Datei ${path} konnte nicht gelesen werden: ${errorMessage(error)}`);
    }
  }
}

function addVersion(
  path: string,
  content: string,
  commit: CommitCandidate,
  currentAssets: Map<string, string>,
  versions: Map<string, RecoveredAssetVersion>,
  commitOid: string | null = commit.oid
): void {
  if (currentAssets.get(path) === content) return;
  const key = `${path}\u0000${content}`;
  if (versions.has(key)) return;
  versions.set(key, {
    assetId: assetIdFromPath(path),
    path,
    content,
    commitOid,
    message: commit.message,
    date: commit.timestamp === null ? null : new Date(commit.timestamp * 1000).toISOString(),
    source: commit.source
  });
}

async function findLooseCommits(
  repo: GitRepo,
  fs: ReturnType<GitRepo['getFs']>,
  warnings: string[]
): Promise<{ commits: CommitCandidate[]; scanned: number; truncated: boolean }> {
  const commits: CommitCandidate[] = [];
  let scanned = 0;
  let truncated = false;
  let prefixes: string[];
  try {
    prefixes = (await repo.readdir('.git/objects')).filter(prefix => /^[a-f0-9]{2}$/i.test(prefix));
  } catch (error) {
    if (isMissingPath(error)) return { commits, scanned, truncated };
    warnings.push(`Lokale Git-Objekte konnten nicht aufgelistet werden: ${errorMessage(error)}`);
    return { commits, scanned, truncated };
  }

  for (const prefix of prefixes) {
    let objectNames: string[];
    try {
      objectNames = await repo.readdir(`.git/objects/${prefix}`);
    } catch {
      continue;
    }
    for (const objectName of objectNames) {
      if (!/^[a-f0-9]{38}$/i.test(objectName)) continue;
      if (scanned >= MAX_LOOSE_OBJECTS) {
        truncated = true;
        return { commits, scanned, truncated };
      }
      scanned += 1;
      const oid = `${prefix}${objectName}`;
      try {
        const object = await git.readObject({ fs, dir: '/', oid, format: 'parsed' });
        if (object.type !== 'commit' || object.format !== 'parsed') continue;
        commits.push(commitCandidate(oid, object.object, 'Nicht mehr referenzierter lokaler Commit'));
      } catch {
        // Ignore corrupt or unsupported loose objects and keep scanning.
      }
    }
  }
  return { commits, scanned, truncated };
}

function commitCandidate(
  oid: string,
  commit: {
    message: string;
    author: { timestamp: number };
    changes?: Array<Array<string | null>>;
  },
  source: string
): CommitCandidate {
  return {
    oid,
    message: commit.message.trim(),
    timestamp: Number.isFinite(commit.author?.timestamp) ? commit.author.timestamp : null,
    source,
    changes: commit.changes
  };
}

function assetIdFromPath(path: string): string {
  const name = path.slice('assets/'.length, -'.asset'.length);
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function isMissingPath(error: unknown): boolean {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
