<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { getTypesStore } from '$lib/stores/types.store.svelte';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import AssetTypeFields from '$lib/components/AssetTypeFields.svelte';
  import { resolveAssetTypeFields } from '$lib/components/asset-type-fields';
  import { persistStore } from '$lib/services/init';

  let { data }: { data: PageData } = $props();
  let saved = $state(false);
  let deleted = $state(false);
  let fieldValues = $state<Record<string, string>>({});

  const locations = getLocationsStore();
  const types = getTypesStore();
  const editMode = getEditMode();
  const typeFields = $derived(resolveAssetTypeFields(data.type, types.all));

  $effect(() => {
    fieldValues = Object.fromEntries(
      typeFields.map(field => [field.name, String(data[field.name] ?? '')])
    );
  });

  function updateField(name: string, value: string) {
    fieldValues[name] = value;
  }

  function handleSave(event: SubmitEvent) {
    event.preventDefault();
    if (!editMode.isEditing) return;
    const fd = new FormData(event.currentTarget as HTMLFormElement);
    const fields: Record<string, string> = {};
    for (const [key, value] of fd.entries()) {
      if (key !== 'type' && key !== 'location') fields[key] = value as string;
    }
    const store = getAssetStore();
    store.updateAsset(data.id, { fields, location: String(fd.get('location') ?? '') || null });
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
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Standort</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {data.location ? locations.findById(data.location)?.name ?? data.location : '—'}
          </dd>
          {#if data.location}
            <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">Auf der Standortkarte ansehen</a>
          {/if}
        </div>
      </dl>
      <AssetTypeFields fields={typeFields} values={fieldValues} editable={false} onValueChange={updateField} />
    {:else}
      <fieldset class="m-0 min-w-0 space-y-4 border-0 p-0">
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Typ</p>
          <p class="mt-1 text-sm text-gray-900">{data.type}</p>
          <p class="mt-1 text-xs text-gray-500">Der Asset-Typ kann nach dem Anlegen nicht geändert werden.</p>
        </div>

        <AssetTypeFields fields={typeFields} values={fieldValues} editable={true} onValueChange={updateField} />

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