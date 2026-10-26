import { getGitRepo, loadGitConfig } from './git.service';
import { getFotoStore } from '../stores/fotos.store.svelte';

/**
 * Initialisiert den Foto-Store mit dem Git-Repo und aktiviert LFS,
 * wenn eine Remote-Konfiguration vorliegt.
 *
 * LFS verwendet jetzt die eigene Implementierung mit IndexedDB-Persistenz
 * und direkter REST-API-Kommunikation. Kein isomorphic-git/http/web nötig.
 */
export async function initFotoService(): Promise<void> {
  const repo = await getGitRepo();
  const fotoStore = getFotoStore();
  await fotoStore.init(repo);

  // Falls Remote konfiguriert, LFS aktivieren
  const config = loadGitConfig();
  if (config) {
    await fotoStore.initLfs({
      repoUrl: config.url,
      username: config.username,
      token: config.token
    });
  }
}
