<script lang="ts">
  import { onMount } from 'svelte';
  import {
    loadGitConfig,
    saveGitConfig,
    cloneRepo,
    initRepo,
    getSyncStatus,
    pushToRemote,
    syncPushWithLfs,
    pullToStores,
    commitChanges,
    type GitConfig
  } from '$lib/services/git.service';
  import { getDefaultGitConfigUrl } from '$lib/services/git-defaults';

  const savedConfig = loadGitConfig();
  let gitUrl = $state(savedConfig?.url ?? getDefaultGitConfigUrl());
  let token = $state(savedConfig?.token ?? '');
  let username = $state(savedConfig?.username ?? 'admin');

  let saved = $state(false);
  let loading = $state(false);
  let progress = $state<string | null>(null);
  let error = $state<string | null>(null);
  let lastResult = $state<string | null>(null);
  let status = $state<{
    initialized: boolean;
    remoteUrl: string | undefined;
    hasChanges: boolean;
  } | null>(null);

  // LightningFS/IndexedDB sind browsergebunden und dürfen nicht beim SSR starten.
  onMount(() => {
    getSyncStatus().then((nextStatus) => {
      status = nextStatus;
    }).catch(() => {
      // Der Status bleibt unbekannt, bis die Browser-Datenbank verfügbar ist.
    });
  });

  function handleSave() {
    const config: GitConfig = {
      url: gitUrl,
      username,
      token
    };
    saveGitConfig(config);
    saved = true;
    setTimeout(() => saved = false, 2000);
  }

  async function handleClone() {
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
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Klon fehlgeschlagen';
    } finally {
      loading = false;
    }
  }

  async function handleInit() {
    loading = true;
    error = null;
    progress = null;
    try {
      await initRepo(username || 'User', `${username || 'user'}@zeugdb.local`);
      status = await getSyncStatus();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Init fehlgeschlagen';
    } finally {
      loading = false;
    }
  }

  async function handleCommit() {
    loading = true;
    error = null;
    progress = 'Commite...';
    try {
      const msg = `ZeugDB Sync ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
      const sha = await commitChanges(msg, username || 'User', `${username || 'user'}@zeugdb.local`);
      lastResult = `Commit erfolgreich: ${sha.slice(0, 8)}`;
      status = await getSyncStatus();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Commit fehlgeschlagen';
    } finally {
      loading = false;
      progress = null;
    }
  }

  async function handlePush() {
    loading = true;
    error = null;
    progress = 'Sync starte...';
    try {
      const config: GitConfig = { url: gitUrl, username, token };
      // LFS-Binaries hochladen + Git push (offline-first)
      await syncPushWithLfs(config, 'main', (p) => { progress = p.message; });
      lastResult = 'Sync erfolgreich — LFS-Binaries und Git-Änderungen hochgeladen';
      status = await getSyncStatus();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Sync fehlgeschlagen';
    } finally {
      loading = false;
      progress = null;
    }
  }

  async function handlePull() {
    loading = true;
    error = null;
    progress = 'Ziehe...';
    try {
      const config: GitConfig = { url: gitUrl, username, token };
      await pullToStores(config, username || 'User', `${username || 'user'}@zeugdb.local`, (p) => { progress = p.message; });
      lastResult = 'Pull erfolgreich — Daten aktualisiert';
      status = await getSyncStatus();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Pull fehlgeschlagen';
    } finally {
      loading = false;
      progress = null;
    }
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
        Trage hier bei GitHub Pages die LAN-Adresse des Gitea-Servers ein, z. B.
        http://192.168.1.24:8929/admin/ZeugDB. Chrome fragt beim ersten Zugriff ggf. nach
        der Berechtigung für das lokale Netzwerk.
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
</div>