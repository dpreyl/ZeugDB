<script lang="ts">
  import type { PageData } from './$types';
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { persistStore } from '$lib/services/init';

  let { data }: { data: PageData } = $props();
  let saved = $state(false);
  let deleted = $state(false);

  const zustandOptionen = ['neu', 'einwandfrei', 'defekt', 'in_reparatur', 'verschrottet'];

  function handleSave(form: Event) {
    const fd = new FormData((form.target as HTMLFormElement));
    const fields: Record<string, string> = {};
    for (const [key, value] of fd.entries()) {
      if (key !== 'type') fields[key] = value as string;
    }
    const store = getAssetStore();
    store.updateAsset(data.id, { fields, location: fields['location'] || null });
    persistStore();
    saved = true;
    setTimeout(() => saved = false, 2000);
  }

  function handleDelete() {
    if (!confirm('Asset ' + data.id + ' wirklich löschen?')) return;
    const store = getAssetStore();
    store.remove(data.id);
    persistStore();
    deleted = true;
  }
</script>

<form class="max-w-2xl space-y-6" onsubmit={handleSave}>
  <div class="flex items-center gap-3">
    <a href="/" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</a>
    <h2 class="text-xl font-semibold text-gray-900">Asset {data.id}</h2>
  </div>

  {#if deleted}
    <div class="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800" role="status">
      Asset gelöscht. <a href="/" class="underline">Zurück zur Übersicht</a>
    </div>
  {:else if saved}
    <div class="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800" role="status">
      ✓ Gespeichert (noch nicht im Git-Repo)
    </div>
  {/if}

  <div class="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
    <div>
      <label for="type" class="block text-sm font-medium text-gray-700 mb-1">Typ</label>
      <input id="type" name="type" value={data.type} disabled class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="hersteller" class="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
        <input id="hersteller" name="hersteller" type="text" value={data.hersteller || ''} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
      <div>
        <label for="modell" class="block text-sm font-medium text-gray-700 mb-1">Modell</label>
        <input id="modell" name="modell" type="text" value={data.modell || ''} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="seriennummer" class="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
        <input id="seriennummer" name="seriennummer" type="text" value={data.seriennummer || ''} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
      <div>
        <label for="inventarnummer" class="block text-sm font-medium text-gray-700 mb-1">Inventarnummer</label>
        <input id="inventarnummer" name="inventarnummer" type="text" value={data.inventarnummer || ''} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
    </div>

    <div>
      <label for="zustand" class="block text-sm font-medium text-gray-700 mb-1">Zustand</label>
      <select id="zustand" name="zustand" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        {#each zustandOptionen as opt}
          <option value={opt} selected={opt === (data.zustand || 'einwandfrei')}>{opt}</option>
        {/each}
      </select>
    </div>

    <div>
      <label for="notizen" class="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
      <textarea id="notizen" name="notizen" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">{data.notizen || ''}</textarea>
    </div>

    <div class="flex gap-3 pt-2">
      <button type="submit" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
        Speichern
      </button>
      <button type="button" onclick={handleDelete} class="px-4 py-2 text-red-600 text-sm rounded-md border border-red-300 hover:bg-red-50">
        Löschen
      </button>
    </div>
  </div>
</form>