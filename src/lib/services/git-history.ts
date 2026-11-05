import * as git from 'isomorphic-git';
import { parseAsset } from '../parser/asset.parser';
import type { GitRepo } from '../git/repo';

export interface FieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  fields: FieldChange[];
}

export interface EditBranchChanges {
  branch: string;
  base: string;
  files: FileChange[];
}

export interface FieldHistoryEntry {
  commit: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
  before: string | null;
  after: string | null;
}

export async function archiveEditBranchHistory(repo: GitRepo, branch: string): Promise<void> {
  if (!branch.startsWith('edit/')) {
    throw new Error('Nur Edit-Branches können archiviert werden');
  }
  const historyBranch = `history/${branch.slice('edit/'.length)}`;
  await repo.archiveBranch(branch, historyBranch);
}

export async function getEditBranchChanges(
  repo: GitRepo,
  branch: string,
  base = 'main'
): Promise<EditBranchChanges> {
  const fs = repo.getFs();
  const [baseOid, branchOid] = await Promise.all([
    git.resolveRef({ fs, dir: '/', ref: base }),
    git.resolveRef({ fs, dir: '/', ref: branch })
  ]);
  const [baseFiles, branchFiles] = await Promise.all([
    git.listFiles({ fs, dir: '/', ref: base }),
    git.listFiles({ fs, dir: '/', ref: branch })
  ]);
  const allPaths = [...new Set([...baseFiles, ...branchFiles])].sort();
  const changes: FileChange[] = [];

  for (const path of allPaths) {
    const before = baseFiles.includes(path) ? await readAtCommit(fs, baseOid, path) : null;
    const after = branchFiles.includes(path) ? await readAtCommit(fs, branchOid, path) : null;
    if (before === after) continue;
    changes.push({
      path,
      status: before === null ? 'added' : after === null ? 'deleted' : 'modified',
      fields: diffFile(path, before, after)
    });
  }

  return { branch, base, files: changes };
}

export async function getAssetFieldHistory(
  repo: GitRepo,
  assetId: string,
  field: string
): Promise<FieldHistoryEntry[]> {
  const fs = repo.getFs();
  const path = `assets/${encodeURIComponent(assetId)}.asset`;
  const refs = await listHistoryRefs(fs);
  const commits = new Map<string, FieldHistoryEntry>();

  for (const ref of refs) {
    const entries = await git.log({
      fs,
      dir: '/',
      ref,
      filepath: path,
      includeChanges: true
    });
    for (const entry of entries) {
      const change = entry.commit.changes?.find(item => item[2] === path);
      if (!change || commits.has(entry.oid)) continue;
      const [newOid, oldOid] = change;
      const [beforeText, afterText] = await Promise.all([
        oldOid ? readBlob(fs, oldOid) : Promise.resolve(null),
        newOid ? readBlob(fs, newOid) : Promise.resolve(null)
      ]);
      const before = readAssetField(beforeText, field);
      const after = readAssetField(afterText, field);
      if (before === after) continue;
      commits.set(entry.oid, {
        commit: entry.oid,
        message: entry.commit.message.trim(),
        author: entry.commit.author.name,
        email: entry.commit.author.email,
        timestamp: entry.commit.author.timestamp,
        before,
        after
      });
    }
  }

  return [...commits.values()].sort((left, right) => right.timestamp - left.timestamp);
}

async function listHistoryRefs(fs: ReturnType<GitRepo['getFs']>): Promise<string[]> {
  const refs: string[] = [];
  for (const group of ['refs/heads', 'refs/remotes']) {
    try {
      for (const name of await git.listRefs({ fs, dir: '/', filepath: group })) {
        refs.push(`${group}/${name}`);
      }
    } catch (error) {
      if (!isMissingPath(error)) throw error;
    }
  }
  return refs;
}

async function readAtCommit(
  fs: ReturnType<GitRepo['getFs']>,
  oid: string,
  path: string
): Promise<string> {
  const { blob } = await git.readBlob({ fs, dir: '/', oid, filepath: path });
  return new TextDecoder().decode(blob);
}

async function readBlob(
  fs: ReturnType<GitRepo['getFs']>,
  oid: string
): Promise<string> {
  const { blob } = await git.readBlob({ fs, dir: '/', oid });
  return new TextDecoder().decode(blob);
}

function diffFile(path: string, before: string | null, after: string | null): FieldChange[] {
  if (path.startsWith('assets/') && path.endsWith('.asset')) {
    const oldFields = flattenAsset(before);
    const newFields = flattenAsset(after);
    const keys = [...new Set([...oldFields.keys(), ...newFields.keys()])].sort();
    return keys.flatMap(field => {
      const oldValue = oldFields.get(field) ?? null;
      const newValue = newFields.get(field) ?? null;
      return oldValue === newValue ? [] : [{ field, before: oldValue, after: newValue }];
    });
  }

  return diffLines(before, after);
}

function flattenAsset(content: string | null): Map<string, string> {
  if (content === null) return new Map();
  const parsed = parseAsset(content);
  const fields = new Map(Object.entries(parsed.direct));
  for (const [block, instances] of Object.entries(parsed.blocks)) {
    for (const [index, values] of Object.entries(instances)) {
      for (const [field, value] of Object.entries(values)) {
        fields.set(`${block}[${index}].${field}`, value);
      }
    }
  }
  return fields;
}

function readAssetField(content: string | null, field: string): string | null {
  return flattenAsset(content).get(field) ?? null;
}

function diffLines(before: string | null, after: string | null): FieldChange[] {
  const oldLines = before?.split(/\r?\n/).filter(Boolean) ?? [];
  const newLines = after?.split(/\r?\n/).filter(Boolean) ?? [];
  const remainingNew = countLines(newLines);
  const removed = oldLines.filter(line => !takeOne(remainingNew, line));
  const remainingOld = countLines(oldLines);
  const added = newLines.filter(line => !takeOne(remainingOld, line));
  const length = Math.max(removed.length, added.length);
  return Array.from({ length }, (_, index) => ({
    field: 'Dateiinhalt',
    before: removed[index] ?? null,
    after: added[index] ?? null
  }));
}

function countLines(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return counts;
}

function takeOne(counts: Map<string, number>, line: string): boolean {
  const count = counts.get(line) ?? 0;
  if (count === 0) return false;
  counts.set(line, count - 1);
  return true;
}

function isMissingPath(error: unknown): boolean {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT';
}
