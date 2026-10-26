<script lang="ts">
  import { onMount } from 'svelte';
  import LocationForm from '$lib/components/LocationForm.svelte';
  import Karte from '$lib/map/Karte.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import type { Location } from '$lib/parser/types';
  import { persistStore } from '$lib/services/init';
  import { flattenLocationTree } from '$lib/locations/location-tree';
  import { clearFormDraft, readFormDraft, writeFormDraft } from '$lib/services/form-drafts';

  const store = getLocationsStore();
  const assets = getAssetStore();
  const editMode = getEditMode();
  const locationRows = $derived.by(() => flattenLocationTree(store.all));
  const assetLabels = $derived.by(() => {
    const labels: Record<string, string[]> = {};
    for (const row of assets.all) {
      if (!row.location) continue;
      const asset = assets.findFull(row.id);
      const name = [asset?.hersteller, asset?.modell].filter(Boolean).join(' ') || row.type;
      (labels[row.location] ??= []).push(`${name} (${row.id})`);
    }
    return labels;
  });
  let showForm = $state(false);
  let editingLocation = $state<Location | undefined>();
  let activeDraft = $state<{ locationId: string | null } | null>(null);
  let restoredActiveDraft = $state(false);
  let selectedId = $state<string | null>(null);
  const selectedLocation = $derived(store.all.find((location) => location.id === selectedId));

  onMount(() => {
    activeDraft = readFormDraft<{ locationId: string | null }>('location:active');
    restoredActiveDraft = true;
  });

  $effect(() => {
    if (!restoredActiveDraft || !editMode.isEditing || !activeDraft) return;
    const resumeId = activeDraft.locationId;
    if (resumeId && store.all.length === 0) return;
    const location = resumeId ? store.all.find((item) => item.id === resumeId) : undefined;
    if (resumeId && !location) {
      clearFormDraft('location:active');
      activeDraft = null;
      return;
    }
    editingLocation = location;
    selectedId = null;
    showForm = true;
    activeDraft = null;
  });

  $effect(() => {
    if (!editMode.isEditing && showForm) {
      activeDraft = readFormDraft<{ locationId: string | null }>('location:active');
      showForm = false;
      editingLocation = undefined;
    }
  });

  function resetForm() {
    showForm = false;
    editingLocation = undefined;
    clearFormDraft('location:active');
  }

  function startEdit(location: Location) {
    if (!editMode.isEditing) return;
    editingLocation = location;
    showForm = true;
    writeFormDraft('location:active', { locationId: location.id ?? null });
  }

  function selectLocation(location: Location) {
    selectedId = location.id ?? null;
    editingLocation = undefined;
    showForm = false;
    clearFormDraft('location:active');
  }

  function saveLocation(location: Location) {
    if (!editMode.isEditing) return;
    store.add(location);
    persistStore();
    selectedId = location.id ?? null;
    resetForm();
  }

  function handleDelete(id: string) {
    if (!editMode.isEditing) return;
    store.remove(id);
    if (selectedId === id) selectedId = null;
    persistStore();
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900">Standorte</h2>
      <p class="text-sm text-gray-500">Punkte, Raumumrisse und Leitungsverläufe verwalten</p>
    </div>
    {#if editMode.isEditing}
      <button
        onclick={() => {
          selectedId = null;
          editingLocation = undefined;
          showForm = true;
          writeFormDraft('location:active', { locationId: null });
        }}
        class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
      >
        + Neuer Standort
      </button>
    {/if}
  </div>

  {#if showForm || selectedLocation}
    {#key editingLocation?.id ?? selectedLocation?.id ?? 'new'}
      <LocationForm
        location={editingLocation ?? selectedLocation}
        locations={store.all}
        disabled={!editMode.isEditing || !showForm}
        onSave={saveLocation}
        onCancel={resetForm}
        draftKey={`location:${editingLocation?.id ?? 'new'}`}
      />
    {/key}
  {/if}

  {#if store.all.length === 0}
    <p class="text-sm text-gray-500">Keine Standorte definiert.</p>
  {:else}
    <div class="space-y-2">
      {#each locationRows as row (row.location.id)}
        <div
          class="p-3 border border-gray-200 rounded-lg"
          style={`margin-left: ${Math.min(row.depth, 8) * 1.25}rem`}
        >
          <div class="flex items-center justify-between">
            <button class="text-left" onclick={() => selectLocation(row.location)}>
              <span class="font-medium text-gray-900">{row.location.name ?? row.location.id}</span>
              <span class="text-xs text-gray-500 ml-2">{row.location.id}</span>
              <span class="ml-2 text-xs text-gray-500">{row.location.art ?? 'punkt'}</span>
              {#if row.hasMissingParent}
                <span class="ml-2 text-xs text-yellow-700">(Eltern nicht gefunden)</span>
              {/if}
            </button>
            {#if editMode.isEditing}
              <div class="flex gap-2">
                <button onclick={() => startEdit(row.location)} class="text-xs text-blue-600 hover:underline">Bearbeiten</button>
                <button onclick={() => row.location.id && handleDelete(row.location.id)} class="text-xs text-red-600 hover:underline">Löschen</button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <section aria-labelledby="map-title" class="space-y-2">
    <h3 id="map-title" class="text-lg font-semibold text-gray-900">Standorte auf der Karte</h3>
    <Karte locations={store.all} {assetLabels} {selectedId} onLocationSelect={(id) => selectedId = id} />
  </section>
</div>
