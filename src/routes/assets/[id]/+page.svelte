<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import { persistStore } from '$lib/services/init';

  let { data }: { data: PageData } = $props();
  let saved = $state(false);
  let deleted = $state(false);

  const zustandOptionen = ['neu', 'einwandfrei', 'defekt', 'in_reparatur', 'verschrottet'];
  const locations = getLocationsStore();
  const editMode = getEditMode();

  function handleSave(event: SubmitEvent) {
    event.preventDefault();
    if (!editMode.isEditing) return;
    const fd = new FormData(event.currentTarget as HTMLFormElement);
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
    if (!editMode.isEditing) return;
    if (!confirm('Asset ' + data.id + ' wirklich löschen?')) return;
    const store = getAssetStore();
    store.remove(data.id);
    persistStore();
    deleted = true;
  }
</script>

<form class="max-w-2xl space-y-6" onsubmit={handleSave}>
  <div class="flex items-center gap-3">
    <a href="{base}/" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</a>
    <h2 class="text-xl font-semibold text-gray-900">Asset {data.id}</h2>
  </div>

  {#if deleted}
    <div class="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800" role="status">
      Asset gelöscht. <a href="{base}/" class="underline">Zurück zur Übersicht</a>
    </div>
  {:else if saved}
    <div class="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800" role="status">
      ✓ Gespeichert (noch nicht im Git-Repo)
    </div>
  {/if}

  <div class="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
    {#if !editMode.isEditing}
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-semibold text-gray-900">Assetdetails</h3>
        <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">Nur Ansicht</span>
      </div>
      <p class="text-sm text-gray-500" role="status">Zum Bearbeiten den Schreibmodus aktivieren.</p>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Typ</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{data.type}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Hersteller</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{data.hersteller || '—'}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Modell</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{data.modell || '—'}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Seriennummer</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{data.seriennummer || '—'}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Inventarnummer</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{data.inventarnummer || '—'}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Standort</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {data.location ? locations.findById(data.location)?.name ?? data.location : '—'}
          </dd>
          {#if data.location}
            <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">Auf der Standortkarte ansehen</a>
          {/if}
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Zustand</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{data.zustand || 'einwandfrei'}</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Notizen</dt>
          <dd class="mt-1 min-h-10 whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{data.notizen || '—'}</dd>
        </div>
      </dl>
    {:else}
      <fieldset class="m-0 min-w-0 space-y-4 border-0 p-0">
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Typ</p>
          <p class="mt-1 text-sm text-gray-900">{data.type}</p>
          <p class="mt-1 text-xs text-gray-500">Der Asset-Typ kann nach dem Anlegen nicht geändert werden.</p>
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
          <label for="location" class="block text-sm font-medium text-gray-700 mb-1">Standort</label>
          <select id="location" name="location" value={data.location ?? ''} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Kein Standort</option>
            {#each locations.all as item}
              <option value={item.id}>{item.name ?? item.id}</option>
            {/each}
          </select>
          <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">Standort mit GPS-Koordinaten verwalten</a>
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
      </fieldset>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          Speichern
        </button>
        <button type="button" onclick={handleDelete} class="px-4 py-2 text-red-600 text-sm rounded-md border border-red-300 hover:bg-red-50">
          Löschen
        </button>
      </div>
    {/if}
  </div>
</form>