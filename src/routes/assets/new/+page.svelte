<script lang="ts">
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { getTypesStore } from '$lib/stores/types.store.svelte';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import AssetTypeFields from '$lib/components/AssetTypeFields.svelte';
  import { resolveAssetTypeFields } from '$lib/components/asset-type-fields';
  import { persistStore } from '$lib/services/init';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';

  let type = $state('');
  let fieldValues = $state<Record<string, string>>({});
  let location = $state('');

  const locations = getLocationsStore();
  const types = getTypesStore();
  const editMode = getEditMode();
  const typeFields = $derived(resolveAssetTypeFields(type, types.all));

  $effect(() => {
    if (!types.all.some(item => item.id === type) && types.all.length > 0) {
      type = types.all[0].id;
    }
  });

  function updateField(name: string, value: string) {
    fieldValues[name] = value;
  }

  function handleSave(event: SubmitEvent) {
    event.preventDefault();
    if (!editMode.isEditing || !type) return;
    const store = getAssetStore();
    const fields = Object.fromEntries(
      typeFields.map(field => [field.name, fieldValues[field.name] ?? ''])
    );

    const id = store.createAsset({
      type,
      location: location || null,
      fields
    });
    persistStore();
    goto(`${base}/assets/${id}`);
  }
</script>

<form onsubmit={handleSave} class="max-w-2xl space-y-6">
  <div class="flex items-center gap-3">
    <a href="{base}/" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</a>
    <h2 class="text-xl font-semibold text-gray-900">Neues Asset</h2>
  </div>

  <div class="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
    {#if !editMode.isEditing}
      <p class="text-sm text-gray-500" role="status">Zum Anlegen eines Assets den Schreibmodus aktivieren.</p>
    {/if}
    <fieldset disabled={!editMode.isEditing} class="m-0 min-w-0 space-y-4 border-0 p-0">
    <div>
      <label for="type" class="block text-sm font-medium text-gray-700 mb-1">Typ</label>
      <select id="type" bind:value={type} required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        {#each types.all as item (item.id)}
          <option value={item.id}>{item.name ?? item.id}</option>
        {/each}
      </select>
    </div>

    <AssetTypeFields fields={typeFields} values={fieldValues} editable={true} onValueChange={updateField} />

    <div>
      <label for="location" class="block text-sm font-medium text-gray-700 mb-1">Standort</label>
      <select id="location" bind:value={location} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        <option value="">Kein Standort</option>
        {#each locations.all as item (item.id)}
          <option value={item.id}>{item.name ?? item.id}</option>
        {/each}
      </select>
      <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">Standort mit GPS-Koordinaten anlegen oder auf der Karte anzeigen</a>
    </div>
    </fieldset>

    <div class="flex gap-3 pt-2">
      {#if editMode.isEditing}
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          Erzeugen
        </button>
      {/if}
      <button type="button" onclick={() => goto(`${base}/`)} class="px-4 py-2 text-gray-600 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
        Abbrechen
      </button>
    </div>
  </div>
</form>