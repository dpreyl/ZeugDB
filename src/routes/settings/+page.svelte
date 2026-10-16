<script lang="ts">
  let gitUrl = $state(localStorage.getItem('zeugdb:gitUrl') || 'http://192.168.178.21:8929/dpreyl/ZeugDB');
  let token = $state(localStorage.getItem('zeugdb:token') || '');
  let username = $state(localStorage.getItem('zeugdb:username') || '');
  let saved = $state(false);

  function handleSave() {
    localStorage.setItem('zeugdb:gitUrl', gitUrl);
    localStorage.setItem('zeugdb:token', token);
    localStorage.setItem('zeugdb:username', username);
    saved = true;
    setTimeout(() => saved = false, 2000);
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

  <div class="space-y-4">
    <div>
      <label for="git-url" class="block text-sm font-medium text-gray-700 mb-1">Git-Server URL</label>
      <input
        id="git-url"
        type="url"
        bind:value={gitUrl}
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="http://localhost:8929/user/repo"
      />
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
    <h3 class="text-sm font-medium text-gray-700 mb-2">Sync-Status</h3>
    <p class="text-sm text-gray-500">Noch nicht implementiert — kommt in der nächsten Iteration.</p>
  </div>
</div>