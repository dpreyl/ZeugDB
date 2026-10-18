import { GitRepo, type GitProgress, openGitDb } from '../git/repo';
import type { Database } from '../db';
import { syncAssetsToDb } from '../fs/repo-sync';
import { getAssetStore } from '../stores/assets.store.svelte';
import { getTypesStore } from '../stores/types.store.svelte';
import { getLocationsStore } from '../stores/locations.store.svelte';
import { parseAsset } from '../parser/asset.parser';
import { parseType } from '../parser/type.parser';
import { parseLocation } from '../parser/location.parser';
import { persistStore } from './init';

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
 * (ohne Datenbank-Instanz). Liest .asset, .type und .location Dateien
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
  await syncGitFsToStores(repo);
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
 * Liest alle Dateien aus dem Git-FS und lädt sie in die Stores.
 * Wird nach einem Pull ohne DB aufgerufen.
 */
async function syncGitFsToStores(repo: GitRepo): Promise<void> {
  const assetStore = getAssetStore();
  const typesStore = getTypesStore();
  const locationsStore = getLocationsStore();

  // Assets laden
  const assetRows: { row: import('../db').AssetRow; fields: Record<string, string> }[] = [];
  try {
    const assetFiles = await repo.readdir('assets');
    for (const file of assetFiles) {
      if (!file.endsWith('.asset')) continue;
      const content = await repo.readFile(`assets/${file}`);
      const { direct } = parseAsset(content);
      const row: import('../db').AssetRow = {
        id: direct['id'] ?? file.replace('.asset', ''),
        type: direct['type'] ?? '',
        location: direct['location'] ?? null,
        erstellt: direct['erstellt'] ?? null,
        geaendert: direct['geaendert'] ?? null
      };
      const fields: Record<string, string> = {};
      const rowKeys = new Set(['id', 'type', 'location', 'erstellt', 'geaendert']);
      for (const [k, v] of Object.entries(direct)) {
        if (!rowKeys.has(k)) fields[k] = v;
      }
      assetRows.push({ row, fields });
    }
  } catch {
    // Verzeichnis nicht vorhanden
  }
  assetStore.setAll(assetRows.map(a => a.row));
  for (const { row, fields } of assetRows) {
    if (Object.keys(fields).length > 0) {
      assetStore.setFields(row.id, fields);
    }
  }

  // Typen laden
  typesStore.clear();
  try {
    const typeFiles = await repo.readdir('types');
    for (const file of typeFiles) {
      if (!file.endsWith('.type')) continue;
      const id = file.replace('.type', '');
      const content = await repo.readFile(`types/${file}`);
      const parsed = parseType(id, content);
      typesStore.add(parsed);
    }
  } catch {
    // Verzeichnis nicht vorhanden
  }

  // Standorte laden
  locationsStore.clear();
  try {
    const locFiles = await repo.readdir('locations');
    for (const file of locFiles) {
      if (!file.endsWith('.location')) continue;
      const content = await repo.readFile(`locations/${file}`);
      const parsed = parseLocation(content);
      locationsStore.add(parsed);
    }
  } catch {
    // Verzeichnis nicht vorhanden
  }

  persistStore();
}
