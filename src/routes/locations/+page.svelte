<script lang="ts">
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import type { Location } from '$lib/parser/types';
  import { persistStore } from '$lib/services/init';

  const store = getLocationsStore();
  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let formId = $state('');
  let formName = $state('');
  let formEltern = $state('');
  let formLat = $state('');
  let formLon = $state('');

  function resetForm() {
    showForm = false;
    editingId = null;
    formId = '';
    formName = '';
    formEltern = '';
    formLat = '';
    formLon = '';
  }

  function startEdit(loc: Location) {
    editingId = loc.id ?? null;
    formId = loc.id ?? '';
    formName = loc.name ?? '';
    formEltern = loc.eltern ?? '';
    formLat = loc.lat?.toString() ?? '';
    formLon = loc.lon?.toString() ?? '';
    showForm = true;
  }

  function handleSave() {
    if (!formId || !formName) return;
    const loc: Location = {
      id: formId,
      name: formName,
      eltern: formEltern || undefined,
      lat: formLat ? parseFloat(formLat) : undefined,
      lon: formLon ? parseFloat(formLon) : undefined
    };
    store.add(loc);
    persistStore();
    resetForm();
  }

  function handleDelete(id: string) {
    store.remove(id);
    persistStore();
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900">Standorte</h2>
      <p class="text-sm text-gray-500">Standort-Hierarchie verwalten</p>
    </div>
    <button
      onclick={() => { resetForm(); showForm = true; }}
      class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
    >
      + Neuer Standort
    </button>
  </div>

  {#if showForm}
    <div class="p-4 border border-gray-200 rounded-lg space-y-4">
      <input bind:value={formId} placeholder="ID (z.B. raum-101)" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      <input bind:value={formName} placeholder="Name (z.B. Raum 101)" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      <input bind:value={formEltern} placeholder="Eltern-ID (optional)" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      <div class="grid grid-cols-2 gap-4">
        <input type="number" step="any" bind:value={formLat} placeholder="Breitengrad" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input type="number" step="any" bind:value={formLon} placeholder="Längengrad" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>
      <div class="flex gap-2">
        <button onclick={handleSave} class="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">Speichern</button>
        <button onclick={resetForm} class="px-4 py-2 bg-gray-400 text-white text-sm rounded-md hover:bg-gray-500">Abbrechen</button>
      </div>
    </div>
  {/if}

  {#if store.all.length === 0}
    <p class="text-sm text-gray-500">Keine Standorte definiert.</p>
  {:else}
    <div class="space-y-2">
      {#each store.getRoots() as root}
        <div class="p-3 border border-gray-200 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-medium text-gray-900">{root.name ?? root.id}</span>
              <span class="text-xs text-gray-500 ml-2">{root.id}</span>
            </div>
            <div class="flex gap-1">
              <button onclick={() => startEdit(root)} class="text-xs text-blue-600 hover:underline">Bearbeiten</button>
              <button onclick={() => handleDelete(root.id!)} class="text-xs text-red-600 hover:underline">Löschen</button>
            </div>
          </div>
          {#if store.getChildren(root.id!).length > 0}
            <div class="mt-2 ml-4 space-y-1 border-l-2 border-gray-200 pl-3">
              {#each store.getChildren(root.id!) as child}
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-700">{child.name ?? child.id}<span class="text-xs text-gray-500 ml-1">{child.id}</span></span>
                  <div class="flex gap-1">
                    <button onclick={() => startEdit(child)} class="text-xs text-blue-600 hover:underline">Bearbeiten</button>
                    <button onclick={() => handleDelete(child.id!)} class="text-xs text-red-600 hover:underline">Löschen</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
      {#each store.all.filter(l => l.eltern && !store.findById(l.eltern!)) as orphan}
        <div class="p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-medium text-gray-900">{orphan.name ?? orphan.id}</span>
              <span class="text-xs text-yellow-600 ml-2">(Eltern nicht gefunden)</span>
            </div>
            <div class="flex gap-1">
              <button onclick={() => startEdit(orphan)} class="text-xs text-blue-600 hover:underline">Bearbeiten</button>
              <button onclick={() => handleDelete(orphan.id!)} class="text-xs text-red-600 hover:underline">Löschen</button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>