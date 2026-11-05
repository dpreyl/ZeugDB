<script lang="ts">
  import { onMount } from 'svelte';
  import {
    loadGitConfig,
    saveGitConfig,
    cloneRepo,
    initRepo,
    getGitRepo,
    getSyncStatus,
    pushToRemote,
    syncPushWithLfs,
    pullToStores,
    commitChanges,
    type GitConfig
  } from '$lib/services/git.service';
  import { getDefaultGitConfigUrl } from '$lib/services/git-defaults';
  import { getFotoStore } from '$lib/stores/fotos.store.svelte';
  import { initFotoService } from '$lib/services/foto-init';
  import { loadGitFsToStores } from '$lib/services/git-store-loader';
  import {
    clearDiagnosticLogs,
    logDiagnostic,
    subscribeDiagnosticLogs,
    type DiagnosticEntry
  } from '$lib/services/diagnostics';

  const savedConfig = loadGitConfig();
  let gitUrl = $state(savedConfig?.url ?? getDefaultGitConfigUrl());
  let token = $state(savedConfig?.token ?? '');
  let username = $state(savedConfig?.username ?? 'admin');

  let saved = $state(false);
  let loading = $state(false);
  let progress = $state<string | null>(null);
  let error = $state<string | null>(null);
  let lastResult = $state<string | null>(null);
  let diagnosticEntries = $state<DiagnosticEntry[]>([]);
  let isOnline = $state(true);
  let status = $state<{
    initialized: boolean;
    remoteUrl: string | undefined;
    hasChanges: boolean;
  } | null>(null);

  // LightningFS/IndexedDB sind browsergebunden und dürfen nicht beim SSR starten.
  onMount(() => {
    const unsubscribe = subscribeDiagnosticLogs((entries) => {
      diagnosticEntries = entries;
    });
    const updateOnlineStatus = () => {
      isOnline = navigator.onLine;
    };
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    getSyncStatus().then((nextStatus) => {
      status = nextStatus;
      logDiagnostic('info', nextStatus.initialized
        ? `Repository-Status geladen; lokale Änderungen: ${nextStatus.hasChanges ? 'ja' : 'nein'}`
        : 'Repository ist noch nicht initialisiert');
    }).catch((err: unknown) => {
      logDiagnostic('warn', `Repository-Status konnte nicht geladen werden: ${errorMessage(err)}`);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  });

  function handleSave() {
    const config: GitConfig = {
      url: gitUrl,
      username,
      token
    };
    saveGitConfig(config);
    void getFotoStore().initLfs({
      repoUrl: config.url,
      username: config.username,
      token: config.token
    });
    logDiagnostic('info', 'Git-Verbindungseinstellungen gespeichert');
    saved = true;
    setTimeout(() => saved = false, 2000);
  }

  async function handleClone() {
    logDiagnostic('info', 'Repository-Klonen gestartet');
    loading = true;
    error = null;
    try {
      const config: GitConfig = { url: gitUrl, username, token };
      await cloneRepo(config, (p) => {
        error = null;
        // Fortschritt könnte man hier anzeigen
      });
      saveGitConfig(config);
      status = await getSyncStatus();
      logDiagnostic('info', 'Repository erfolgreich geklont');
    } catch (e: unknown) {
      reportError('Repository-Klonen fehlgeschlagen', e, 'Klon fehlgeschlagen');
    } finally {
      loading = false;
    }
  }

  async function handleInit() {
    logDiagnostic('info', 'Initialisierung eines neuen Repositorys gestartet');
    loading = true;
    error = null;
    progress = null;
    try {
      await initRepo(username || 'User', `${username || 'user'}@zeugdb.local`);
      status = await getSyncStatus();
      logDiagnostic('info', 'Neues Repository erfolgreich initialisiert');
    } catch (e: unknown) {
      reportError('Repository-Initialisierung fehlgeschlagen', e, 'Init fehlgeschlagen');
    } finally {
      loading = false;
    }
  }

  async function handleCommit() {
    logDiagnostic('info', 'Commit gestartet');
    loading = true;
    error = null;
    progress = 'Commite...';
    try {
      const msg = `ZeugDB Sync ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
      const sha = await commitChanges(msg, username || 'User', `${username || 'user'}@zeugdb.local`);
      lastResult = `Commit erfolgreich: ${sha.slice(0, 8)}`;
      status = await getSyncStatus();
      logDiagnostic('info', `Commit erfolgreich: ${sha.slice(0, 8)}`);
    } catch (e: unknown) {
      reportError('Commit fehlgeschlagen', e, 'Commit fehlgeschlagen');
    } finally {
      loading = false;
      progress = null;
    }
  }

  async function handlePush() {
    logDiagnostic('info', 'Push mit LFS gestartet');
    loading = true;
    error = null;
    progress = 'Sync starte...';
    try {
      const config: GitConfig = { url: gitUrl, username, token };
      // LFS-Binaries hochladen + Git push (offline-first)
      await syncPushWithLfs(config, 'main', (p) => { progress = p.message; });
      lastResult = 'Sync erfolgreich — LFS-Binaries und Git-Änderungen hochgeladen';
      status = await getSyncStatus();
      logDiagnostic('info', 'Push mit LFS erfolgreich abgeschlossen');
    } catch (e: unknown) {
      reportError('Push mit LFS fehlgeschlagen', e, 'Sync fehlgeschlagen');
    } finally {
      loading = false;
      progress = null;
    }
  }

  async function handlePull() {
    logDiagnostic('info', 'Pull gestartet');
    loading = true;
    error = null;
    progress = 'Ziehe...';
    try {
      const config: GitConfig = { url: gitUrl, username, token };
      await pullToStores(config, username || 'User', `${username || 'user'}@zeugdb.local`, (p) => { progress = p.message; });
      lastResult = 'Pull erfolgreich — Daten aktualisiert';
      status = await getSyncStatus();
      logDiagnostic('info', 'Pull erfolgreich abgeschlossen');
    } catch (e: unknown) {
      reportError('Pull fehlgeschlagen', e, 'Pull fehlgeschlagen');
    } finally {
      loading = false;
      progress = null;
    }
  }

  async function handleMigrateImages() {
    if (!window.confirm('Vorhandene Fotos in JPEG-Originale und Offline-Vorschauen umwandeln? Danach müssen die Änderungen committen und gepusht werden.')) {
      return;
    }
    logDiagnostic('info', 'Bildmigration gestartet');
    loading = true;
    error = null;
    progress = 'Prüfe und migriere Gerätebilder...';
    try {
      await initFotoService();
      const result = await getFotoStore().migrateExistingImages();
      await loadGitFsToStores(await getGitRepo());
      lastResult = `Bildmigration abgeschlossen: ${result.migrated} migriert, ${result.skipped} bereits aktuell`;
      status = await getSyncStatus();
      logDiagnostic('info', `Bildmigration abgeschlossen: ${result.migrated} migriert, ${result.skipped} übersprungen`);
    } catch (e: unknown) {
      reportError('Bildmigration fehlgeschlagen', e, 'Bildmigration fehlgeschlagen');
    } finally {
      loading = false;
      progress = null;
    }
  }

  function errorMessage(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }

  function reportError(context: string, value: unknown, fallback: string): void {
    error = value instanceof Error ? value.message : fallback;
    logDiagnostic('error', `${context}: ${errorMessage(value)}`);
  }
</script>

<div class="max-w-lg space-y-6">
  <div>
    <h2 class="text-xl font-semibold text-gray-900">Einstellungen</h2>
    <p class="text-sm text-gray-500">Git-Server-Verbindung konfigurieren</p>
  </div>

  {#if saved}
    <div class="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
      ✓ Einstellungen gespeichert
    </div>
  {/if}

  {#if error}
    <div class="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
      ✗ {error}
    </div>
  {/if}

  {#if lastResult}
    <div class="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
      ℹ {lastResult}
    </div>
  {/if}

  <div class="space-y-4">
    <div>
      <label for="git-url" class="block text-sm font-medium text-gray-700 mb-1">Git-Server URL</label>
      <input
        id="git-url"
        type="url"
        bind:value={gitUrl}
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="http://<LAN-IP>:8929/admin/ZeugDB"
      />
      <p class="mt-1 text-xs text-gray-500">
        Die App kann auf GitHub Pages liegen, die Daten bleiben in deinem Gitea-Repository.
        Trage bei GitHub Pages die LAN-Adresse oder einen im Heimnetz auflösbaren Hostnamen
        des Gitea-Servers ein. Bei wechselnder Laptop-IP empfiehlt sich eine DHCP-Reservierung
        im Router. Verwende denselben Hostnamen auch in Giteas `GITEA_ROOT_URL`, damit Git-LFS
        dieselbe Adresse zurückgibt. Chrome fragt beim ersten Zugriff ggf. nach der Berechtigung
        für das lokale Netzwerk.
      </p>
    </div>

    <div>
      <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
      <input
        id="username"
        type="text"
        bind:value={username}
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="dein-name"
      />
    </div>

    <div>
      <label for="token" class="block text-sm font-medium text-gray-700 mb-1">Personal Access Token</label>
      <input
        id="token"
        type="password"
        bind:value={token}
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Fine-Grained PAT"
      />
      <p class="mt-1 text-xs text-gray-500">
        Erstelle einen Fine-Grained PAT auf dem Git-Server mit Repo-Read/Write-Rechten.
      </p>
    </div>

    <button
      onclick={handleSave}
      class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
    >
      Speichern
    </button>
  </div>

  <div class="pt-4 border-t border-gray-200">
    <h3 class="text-sm font-medium text-gray-700 mb-2">Repo-Verwaltung</h3>
    <p class="mb-3 text-xs text-gray-500">
      Die einmalige Bildmigration komprimiert vorhandene Fotos und erstellt Offline-Vorschauen.
      Danach die Änderungen committen und zum Server pushen.
    </p>

    <div class="flex gap-2 flex-wrap">
      <button
        onclick={handleClone}
        disabled={loading}
        class="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Läuft...' : 'Repo klonen'}
      </button>
      <button
        onclick={handleInit}
        disabled={loading}
        class="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
      >
        Neues Repo erstellen
      </button>
      <button
        onclick={handleMigrateImages}
        disabled={loading || !status?.initialized}
        class="px-4 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 disabled:opacity-50"
      >
        Bilder migrieren
      </button>
    </div>
  </div>

  <div class="pt-4 border-t border-gray-200">
    <h3 class="text-sm font-medium text-gray-700 mb-2">Sync-Operationen</h3>

    {#if progress}
      <p class="text-xs text-gray-500 mb-2">{progress}</p>
    {/if}

    <div class="flex gap-2 flex-wrap">
      <button
        onclick={handleCommit}
        disabled={loading || !status?.initialized}
        class="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
      >
        Änderungen committen
      </button>
      <button
        onclick={handlePush}
        disabled={loading || !status?.initialized}
        class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        Push (zum Server)
      </button>
      <button
        onclick={handlePull}
        disabled={loading || !status?.initialized}
        class="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50"
      >
        Pull (vom Server)
      </button>
    </div>
  </div>

  <div class="pt-4 border-t border-gray-200">
    <h3 class="text-sm font-medium text-gray-700 mb-2">Sync-Status</h3>
    {#if status}
      <div class="text-sm space-y-1">
        <p><span class="font-medium">Initialisiert:</span> {status.initialized ? 'Ja' : 'Nein'}</p>
        <p><span class="font-medium">Remote:</span> {status.remoteUrl ?? '—'}</p>
        <p><span class="font-medium">Änderungen:</span> {status.hasChanges ? 'Ja' : 'Nein'}</p>
      </div>
    {:else}
      <p class="text-sm text-gray-500">Status wird geladen...</p>
    {/if}
  </div>

  <section class="pt-4 border-t border-gray-200" aria-labelledby="diagnostics-heading">
    <div class="mb-2 flex items-center justify-between gap-3">
      <h3 id="diagnostics-heading" class="text-sm font-medium text-gray-700">Diagnose und Protokoll</h3>
      <button
        onclick={clearDiagnosticLogs}
        disabled={diagnosticEntries.length === 0}
        class="text-xs text-gray-600 underline disabled:opacity-50"
      >
        Protokoll leeren
      </button>
    </div>
    <div class="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
      <p><span class="font-medium">Verbindung:</span> {isOnline ? 'Online' : 'Offline'}</p>
      <p><span class="font-medium">Aktueller Vorgang:</span> {progress ?? (loading ? 'Wird ausgeführt...' : 'Keiner')}</p>
      <p><span class="font-medium">Repository:</span>
        {status ? (status.initialized ? (status.hasChanges ? 'Initialisiert, lokale Änderungen vorhanden' : 'Initialisiert, sauber') : 'Nicht initialisiert') : 'Status unbekannt'}
      </p>
    </div>
    {#if diagnosticEntries.length}
      <ol
        aria-label="Diagnoseprotokoll"
        class="max-h-80 space-y-2 overflow-y-auto rounded-md border border-gray-200 bg-white p-3"
      >
        {#each [...diagnosticEntries].reverse() as entry}
          <li class="flex gap-2 text-xs">
            <span class="shrink-0 text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
            <span class="shrink-0 font-semibold {entry.level === 'error' ? 'text-red-700' : entry.level === 'warn' ? 'text-amber-700' : 'text-blue-700'}">
              {entry.level === 'error' ? 'FEHLER' : entry.level === 'warn' ? 'WARNUNG' : 'INFO'}
            </span>
            <span class="min-w-0 break-words text-gray-700">{entry.message}</span>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-500">
        Noch keine Meldungen. Warnungen und Fehler werden hier gespeichert.
      </p>
    {/if}
  </section>
</div>
