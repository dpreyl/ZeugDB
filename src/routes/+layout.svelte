<script lang="ts">
  import { base } from '$app/paths';
  import '../app.css';
  import { initializeStore } from '$lib/services/init';
  import { initFotoService } from '$lib/services/foto-init';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import {
    loadGitConfig,
    createEditBranch,
    syncEditBranch,
    discardEditBranch,
    fetchRemote
  } from '$lib/services/git.service';
  import { getSyncMeta } from '$lib/stores/sync-meta.svelte';

  let { children }: { children?: any } = $props();

  initializeStore();
  // Foto-Store lazily initialisieren (Git-Repo + LFS falls konfiguriert)
  initFotoService().catch(() => {
    // Foto-Service optional — ignorieren wenn Git nicht initialisiert
  });

  const editMode = getEditMode();
  const syncMeta = getSyncMeta();

  let loading = $state(false);
  let progress = $state<string | null>(null);
  let error = $state<string | null>(null);

  // Der Offline-Service-Worker darf in Entwicklung keine veralteten Vite-Module cachen.
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then(async registrations => {
        await Promise.all(registrations.map(registration => registration.unregister()));
        if (registrations.length && navigator.serviceWorker.controller) {
          window.location.reload();
        }
      }).catch(err => console.warn('[SW] Dev-Registrierung konnte nicht entfernt werden:', err));
    }
  }

  async function handleEnterEditMode() {
    loading = true;
    error = null;
    progress = 'Erstelle Edit-Branch...';
    try {
      const config = loadGitConfig();
      const username = config?.username || 'user';
      const email = `${username}@zeugdb.local`;
      editMode.enterEditMode(username, email);
      await createEditBranch(username, email, editMode.branch!);
      progress = 'Edit-Modus aktiv';
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Edit-Modus fehlgeschlagen';
      editMode.discard();
    } finally {
      loading = false;
      setTimeout(() => (progress = null), 2000);
    }
  }

  async function handleSync() {
    loading = true;
    error = null;
    progress = 'Synchronisiere...';
    try {
      const config = loadGitConfig();
      if (!config) throw new Error('Git-Verbindung nicht konfiguriert');
      const username = editMode.username || 'user';
      const email = `${username}@zeugdb.local`;
      await syncEditBranch(config, username, email, (p) => {
        progress = p.message;
      });
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Sync fehlgeschlagen';
    } finally {
      loading = false;
    }
  }

  async function handleDiscard() {
    if (!confirm('Alle lokalen Änderungen verwerfen?')) return;
    loading = true;
    error = null;
    progress = 'Änderungen werden verworfen...';
    try {
      await discardEditBranch();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Verwerfen fehlgeschlagen';
    } finally {
      loading = false;
      progress = null;
    }
  }

  async function handleFetchRemote() {
    loading = true;
    error = null;
    progress = 'Hole Änderungen...';
    try {
      const config = loadGitConfig();
      if (!config) throw new Error('Git-Verbindung nicht konfiguriert');
      const username = editMode.username || config.username || 'user';
      const email = `${username}@zeugdb.local`;
      await fetchRemote(config, username, email, (p) => {
        progress = p.message;
      });
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Holen fehlgeschlagen';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-900">ZeugDB</h1>
      <nav class="flex gap-4 text-sm">
        <a href="{base}/" class="text-gray-600 hover:text-gray-900">Assets</a>
        <a href="{base}/inspections" class="text-gray-600 hover:text-gray-900">DGUV-Prüfung</a>
        <a href="{base}/types" class="text-gray-600 hover:text-gray-900">Typen</a>
        <a href="{base}/locations" class="text-gray-600 hover:text-gray-900">Standorte</a>
        <a href="{base}/settings" class="text-gray-600 hover:text-gray-900">Einstellungen</a>
      </nav>
    </div>

    <!-- Edit-Mode Status-Leiste -->
    {#if editMode.isEditing}
      <div class="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between bg-amber-50 border-t border-amber-200">
        <div class="flex items-center gap-3 text-sm">
          <span class="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span class="text-amber-800 font-medium">Edit-Modus</span>
          <span class="text-amber-600">— Branch: {editMode.branch}</span>
        </div>
        <div class="flex gap-2">
          <button
            onclick={handleFetchRemote}
            disabled={loading}
            class="px-3 py-1 text-sm border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50"
          >
            {loading ? progress ?? 'Holt...' : 'Holen'}
          </button>
          <button
            onclick={handleDiscard}
            disabled={loading}
            class="px-3 py-1 text-sm border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Verwerfen
          </button>
          <button
            onclick={handleSync}
            disabled={loading}
            class="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? progress ?? 'Synchronisiere...' : 'Sync'}
          </button>
        </div>
      </div>
    {:else}
      <div class="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between border-t border-gray-100">
        <div class="flex items-center gap-3 text-sm">
          <span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
          <span class="text-gray-500">Read-Only</span>
          {#if syncMeta.getFormattedTimestamp()}
            <span class="text-gray-400 text-xs">(Zuletzt synchronisiert: {syncMeta.getFormattedTimestamp()})</span>
          {/if}
        </div>
        <div class="flex gap-2">
          <button
            onclick={handleFetchRemote}
            disabled={loading}
            class="px-3 py-1 text-sm border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50"
          >
            {loading ? progress ?? 'Holt...' : 'Holen'}
          </button>
          <button
            onclick={handleEnterEditMode}
            disabled={loading}
            class="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? progress ?? 'Lädt...' : 'Bearbeiten'}
          </button>
        </div>
      </div>
    {/if}

    <!-- Fehler-Meldung -->
    {#if error}
      <div class="max-w-6xl mx-auto px-4 py-2">
        <div class="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          ✗ {error}
          <button onclick={() => error = null} class="ml-2 underline">schließen</button>
        </div>
      </div>
    {/if}
  </header>

  <main class="max-w-6xl mx-auto px-4 py-6">
    {@render children?.()}
  </main>
</div>
