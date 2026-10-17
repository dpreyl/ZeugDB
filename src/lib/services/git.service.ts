import { GitRepo, type GitProgress, openGitDb } from '../git/repo';
import { syncAssetsToDb } from '../fs/repo-sync';
import { getAssetStore } from '../stores/assets.store.svelte';
import { persistStore } from './init';
import type { Database } from '../db';

/**
 * Persistierte Git-Konfiguration.
 */
export interface GitConfig {
  url: string;
  username: string;
  token: string;
}

const CONFIG_KEY = 'zeugdb:gitConfig';

let _repo: GitRepo | null = null;

/**
 * Gibt die Singleton-GitRepo-Instanz zurück (lazily initialisiert).
 */
export async function getGitRepo(): Promise<GitRepo> {
  if (!_repo) {
    const db = await openGitDb();
    _repo = new GitRepo(db);
  }
  return _repo;
}

/**
 * Reset für Tests.
 */
export function resetGitRepo(): void {
  _repo = null;
}

/**
 * Liest die gespeicherte Git-Konfiguration.
 */
export function loadGitConfig(): GitConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GitConfig;
  } catch {
    return null;
  }
}

/**
 * Speichert die Git-Konfiguration.
 */
export function saveGitConfig(config: GitConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Initialisiert ein neues lokales Git-Repo.
 */
export async function initRepo(authorName: string, authorEmail: string): Promise<void> {
  const repo = await getGitRepo();
  await repo.init({ authorName, authorEmail });
}

/**
 * Klont ein Remote-Repo und synchronisiert die Assets lokal.
 */
export async function cloneRepo(
  config: GitConfig,
  onprogress?: (progress: GitProgress) => void
): Promise<void> {
  const repo = await getGitRepo();
  await repo.clone({
    url: config.url,
    auth: { username: config.username, token: config.token },
    onprogress
  });
  saveGitConfig(config);
}

/**
 * Pusht lokale Änderungen zum Remote.
 */
export async function pushToRemote(
  config: GitConfig,
  branch?: string,
  onprogress?: (progress: GitProgress) => void
): Promise<string[]> {
  const repo = await getGitRepo();
  return repo.push({
    auth: { username: config.username, token: config.token },
    branch,
    onprogress
  });
}

/**
 * Zieht Änderungen vom Remote und syncrt Assets in den Store.
 */
export async function pullFromRemote(
  config: GitConfig,
  authorName: string,
  authorEmail: string,
  db: Database,
  onprogress?: (progress: GitProgress) => void
): Promise<void> {
  const repo = await getGitRepo();
  await repo.pull({
    auth: { username: config.username, token: config.token },
    author: { name: authorName, email: authorEmail },
    onprogress
  });
  // Nach dem Pull die Assets aus dem FS in die DB syncen
  await syncAssetsToDb(db, repo);
  // Store aktualisieren
  const store = getAssetStore();
  store.clear();
  persistStore();
}

/**
 * Commitet aktuelle Änderungen.
 */
export async function commitChanges(
  message: string,
  authorName: string,
  authorEmail: string,
  files?: string[]
): Promise<string> {
  const repo = await getGitRepo();
  return repo.commit({ message, authorName, authorEmail, files });
}

/**
 * Prüft, ob ein Repo initialisiert ist.
 */
export async function isRepoInitialized(): Promise<boolean> {
  const repo = await getGitRepo();
  return repo.isInitialized();
}

/**
 * Gibt den aktuellen Sync-Status zurück.
 */
export async function getSyncStatus(): Promise<{
  initialized: boolean;
  remoteUrl: string | undefined;
  hasChanges: boolean;
}> {
  const repo = await getGitRepo();
  const initialized = await repo.isInitialized();
  const remoteUrl = initialized ? await repo.getRemoteUrl() : undefined;
  const changes = initialized ? await repo.status() : [];
  return {
    initialized,
    remoteUrl,
    hasChanges: changes.length > 0
  };
}
