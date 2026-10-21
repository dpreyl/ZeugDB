import { GitRepo, type GitProgress } from '../git/repo';
import type { Database } from '../db';
import { syncAssetsToDb } from '../fs/repo-sync';
import { getAssetStore } from '../stores/assets.store.svelte';
import { getTypesStore } from '../stores/types.store.svelte';
import { getComponentsStore } from '../stores/components.store.svelte';
import { getLocationsStore } from '../stores/locations.store.svelte';
import { syncLocationsToGit } from './location-git-sync';
import { syncTypesToGit } from './type-git-sync';
import { syncComponentsToGit } from './component-git-sync';
import { loadGitFsToStores } from './git-store-loader';
import { persistStore, serializeAssetFile } from './init';
import { getEditMode } from '../stores/edit-mode.svelte';
import { getSyncMeta } from '../stores/sync-meta.svelte';

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
    if (typeof indexedDB === 'undefined') {
      throw new Error('Git-Repository kann nur im Browser verwendet werden');
    }
    _repo = new GitRepo('zeugdb-git');
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
 * Zieht Änderungen vom Remote und syncrt Assets in die DB.
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
 * Zieht Änderungen vom Remote und synchronisiert direkt die Stores
 * (ohne Datenbank-Instanz). Liest .asset, .type, .comp und .location Dateien
 * aus dem Git-FS und aktualisiert die Stores.
 */
export async function pullToStores(
  config: GitConfig,
  authorName: string,
  authorEmail: string,
  onprogress?: (progress: GitProgress) => void
): Promise<void> {
  const repo = await getGitRepo();
  await repo.pull({
    auth: { username: config.username, token: config.token },
    author: { name: authorName, email: authorEmail },
    onprogress
  });
  // Nach dem Pull die Dateien aus dem Git-FS in die Stores laden
  await loadGitFsToStores(repo);
  getSyncMeta().update(new Date(), 'pull');
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

/**
 * Erzeugt einen Edit-Branch und wechselt dorthin.
 */
export async function createEditBranch(
  username: string,
  email: string,
  branchName: string
): Promise<void> {
  const repo = await getGitRepo();
  await repo.createBranch(branchName);
  await repo.checkoutBranch(branchName);
}

/**
 * Serialisiert alle Assets als .asset-Dateien im Git-FS
 * und erstellt einen Commit.
 */
export async function commitAllToGit(
  message: string,
  authorName: string,
  authorEmail: string
): Promise<string | null> {
  const repo = await getGitRepo();
  const assets = getAssetStore();
  const locations = getLocationsStore();
  const changedFiles: string[] = [];

  for (const row of assets.all) {
    const asset = assets.findFull(row.id);
    if (asset) {
      const content = serializeAssetFile(asset);
      const path = `assets/${row.id}.asset`;
      if (await readFileOrNull(repo, path) !== content) {
        await repo.writeFile(path, content);
        changedFiles.push(path);
      }
    }
  }

  const locationChanges = await syncLocationsToGit(repo, locations.all);
  changedFiles.push(...locationChanges.changedFiles);

  const typeChanges = await syncTypesToGit(repo, getTypesStore().all);
  changedFiles.push(...typeChanges.changedFiles);
  const componentChanges = await syncComponentsToGit(repo, getComponentsStore().all);
  changedFiles.push(...componentChanges.changedFiles);
  const deletedFiles = [
    ...locationChanges.deletedFiles,
    ...typeChanges.deletedFiles,
    ...componentChanges.deletedFiles
  ];

  if (changedFiles.length === 0 && deletedFiles.length === 0) return null;
  return repo.commit({
    message,
    authorName,
    authorEmail,
    files: changedFiles,
    deletedFiles
  });
}

async function readFileOrNull(repo: GitRepo, path: string): Promise<string | null> {
  try {
    return await repo.readFile(path);
  } catch {
    return null;
  }
}

/**
 * Vollständiger Sync-Workflow:
 * 1. Fetch vom Remote
 * 2. Zu main wechseln und mit origin/main aktualisieren
 * 3. Squash-Merge des Edit-Branches
 * 4. Push nach origin/main
 * 5. Edit-Branch löschen
 * 6. Stores aus Git-FS neu laden
 * 7. Edit-Modus beenden
 */
export async function syncEditBranch(
  config: GitConfig,
  authorName: string,
  authorEmail: string,
  onprogress?: (progress: GitProgress) => void
): Promise<void> {
  const repo = await getGitRepo();
  const editMode = getEditMode();
  const branch = editMode.branch;
  if (!branch) throw new Error('Kein Edit-Branch aktiv');

  onprogress?.({ message: 'Speichere Standort- und Asset-Änderungen...' });
  await commitAllToGit(
    `Daten-Sync ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    authorName,
    authorEmail
  );

  onprogress?.({ message: 'Hole Änderungen vom Server...' });

  // 1. Fetch
  await repo.fetchFromRemote({ auth: { username: config.username, token: config.token } });

  // 2. Zu main wechseln
  onprogress?.({ message: 'Wechsle zu main...' });
  await repo.checkoutBranch('main');

  // Lokales main auf den Stand des Remotes bringen, bevor der Edit-Branch
  // integriert wird. Andernfalls kann der Sync ein veraltetes main pushen.
  onprogress?.({ message: 'Aktualisiere main vom Server...' });
  try {
    await repo.mergeBranch({
      branch: 'origin/main',
      authorName,
      authorEmail
    });
  } catch (err: any) {
    throw new Error(`Konnte main nicht aktualisieren: ${err.message || 'Unbekannter Fehler'}`);
  }

  // 3. Squash-Merge
  onprogress?.({ message: `Merge ${branch} → main (squash)...` });
  try {
    await repo.mergeBranch({
      branch,
      authorName,
      authorEmail,
      squash: true,
      message: `Squash merge: ${branch}`
    });
  } catch (err: any) {
    throw new Error(`Merge-Konflikt: ${err.message || 'Unbekannter Fehler'}`);
  }

  // 4. Push nach origin/main
  onprogress?.({ message: 'Schiebe Änderungen zum Server...' });
  await repo.push({
    auth: { username: config.username, token: config.token },
    branch: 'main',
    onprogress
  });

  // 5. Edit-Branch löschen
  onprogress?.({ message: 'Räume Edit-Branch auf...' });
  try {
    await repo.deleteBranch(branch);
  } catch {
    // Ignorieren
  }

  // 6. Stores aus Git-FS neu laden
  onprogress?.({ message: 'Lade Daten aus Git-Repo...' });
  await loadGitFsToStores(repo);

  // 7. Edit-Modus beenden
  editMode.finishEdit();

  // Sync-Timestamp aktualisieren
  getSyncMeta().update(new Date(), 'sync');
}

/**
 * Verwirft Änderungen: Wechselt zurück zu main und löscht Edit-Branch.
 */
export async function discardEditBranch(): Promise<void> {
  const repo = await getGitRepo();
  const editMode = getEditMode();
  const branch = editMode.branch;

  if (branch) {
    await repo.checkoutBranch('main');
    try {
      await repo.deleteBranch(branch);
    } catch {
      // Ignorieren
    }
  }

  await loadGitFsToStores(repo);
  editMode.discard();
}

/**
 * Fetcht Änderungen vom Remote und zieht sie in den aktuellen Branch.
 * Im Edit-Modus: Holt in den Edit-Branch (kein Merge von main).
 * Im Read-Only-Modus: Holt in main.
 * Aktualisiert die Stores und den Sync-Timestamp.
 */
export async function fetchRemote(
  config: GitConfig,
  authorName: string,
  authorEmail: string,
  onprogress?: (progress: GitProgress) => void
): Promise<void> {
  const repo = await getGitRepo();
  const editMode = getEditMode();
  const currentBranch = editMode.isEditing ? editMode.branch : 'main';

  onprogress?.({ message: 'Hole Änderungen vom Server...' });

  // 1. Fetch — aktualisiert Remote-refs ohne lokale Änderungen
  await repo.fetchFromRemote({
    auth: { username: config.username, token: config.token }
  });

  // 2. Pull in den aktuellen Branch (merge remote/main into current)
  onprogress?.({ message: 'Integriere Änderungen...' });
  if (editMode.isEditing && currentBranch) {
    // Im Edit-Branch: merge origin/main ein
    try {
      await repo.mergeBranch({
        branch: 'origin/main',
        authorName,
        authorEmail
      });
    } catch (err: any) {
      throw new Error(`Merge-Konflikt: ${err.message || 'Unbekannter Fehler'}`);
    }
  } else {
    // Read-only gehört immer zu main, auch nach einem Reload mit altem HEAD.
    await repo.checkoutBranch('main');
    await repo.pull({
      auth: { username: config.username, token: config.token },
      branch: 'main',
      author: { name: authorName, email: authorEmail },
      onprogress
    });
  }

  // 3. Stores aktualisieren
  onprogress?.({ message: 'Lade Daten aus Git-Repo...' });
  await loadGitFsToStores(repo);

  // 4. Sync-Timestamp setzen
  getSyncMeta().update(new Date(), 'pull');
}
