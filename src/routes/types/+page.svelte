<script lang="ts">
  import { getTypesStore } from '$lib/stores/types.store.svelte';
  import type { TypeDefinition } from '$lib/parser/types';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import { persistStore } from '$lib/services/init';
  import TypeEditor from '$lib/components/TypeEditor.svelte';

  const store = getTypesStore();
  const editMode = getEditMode();
  let showForm = $state(false);
  let selectedId = $state<string | null>(null);
  const selectedType = $derived(store.all.find((type) => type.id === selectedId));
  let editingId = $state<string | null>(null);

  function resetForm() {
    showForm = false;
    editingId = null;
  }

  function startEdit(type: TypeDefinition) {
    if (!editMode.isEditing) return;
    selectedId = null;
    editingId = type.id;
    showForm = true;
  }

  function showDetails(type: TypeDefinition) {
    resetForm();
    selectedId = type.id;
  }

  function handleSave(type: TypeDefinition) {
    if (!editMode.isEditing) return;
    store.add(type);
    persistStore();
    resetForm();
  }

  function handleDelete(id: string) {
    if (!editMode.isEditing) return;
    store.remove(id);
    if (selectedId === id) selectedId = null;
    persistStore();
  }

  $effect(() => {
    if (!editMode.isEditing && showForm) resetForm();
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900">Typen</h2>
      <p class="text-sm text-gray-500">Asset-Typ-Definitionen verwalten</p>
    </div>
    {#if editMode.isEditing}
      <button
        onclick={() => { resetForm(); selectedId = null; showForm = true; }}
        class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
      >
        + Neuer Typ
      </button>
    {/if}
  </div>

  {#if editMode.isEditing && showForm}
    {#key editingId ?? 'new'}
      <TypeEditor
        type={editingId ? store.findById(editingId) ?? null : null}
        existingTypes={store.all}
        onSave={handleSave}
        onCancel={resetForm}
      />
    {/key}
  {/if}

  {#if store.all.length === 0}
    <p class="text-sm text-gray-500">Keine Typen definiert.</p>
  {:else}
    <div class="grid gap-4 md:grid-cols-2">
      {#each store.all as type (type.id)}
        <div class="p-4 border border-gray-200 rounded-lg">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-medium text-gray-900">{type.name ?? type.id}</h3>
              <p class="text-xs text-gray-500">{type.id}{type.extends ? ` (erbt ${type.extends})` : ''}</p>
            </div>
            <div class="flex flex-wrap justify-end gap-2">
              <button
                onclick={() => showDetails(type)}
                aria-label="Details ansehen: {type.name ?? type.id}"
                class="text-xs text-blue-600 hover:underline"
              >
                Details ansehen
              </button>
              {#if editMode.isEditing}
                <button onclick={() => startEdit(type)} class="text-xs text-blue-600 hover:underline">Bearbeiten</button>
                <button onclick={() => handleDelete(type.id)} class="text-xs text-red-600 hover:underline">Löschen</button>
              {/if}
            </div>
          </div>
          {#if type.kategorie}
            <span class="inline-block mt-2 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{type.kategorie}</span>
          {/if}
          <div class="mt-2 text-xs text-gray-500">
            {type.fields.length} Felder, {type.blocks.length} Blöcke
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if selectedType && !showForm}
    <section aria-labelledby="type-details-title" class="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 id="type-details-title" class="font-semibold text-gray-900">
            Details: {selectedType.name ?? selectedType.id}
          </h3>
          <p class="text-xs text-gray-500">Typdefinition · schreibgeschützte Ansicht</p>
        </div>
        {#if editMode.isEditing}
          <button onclick={() => startEdit(selectedType)} class="text-sm text-blue-600 hover:underline">
            Typ bearbeiten
          </button>
        {/if}
      </div>

      <dl class="grid gap-3 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">ID</dt>
          <dd class="mt-1 text-sm text-gray-900">{selectedType.id}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Kategorie</dt>
          <dd class="mt-1 text-sm text-gray-900">{selectedType.kategorie || '—'}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Erbt von</dt>
          <dd class="mt-1 text-sm text-gray-900">{selectedType.extends || '—'}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Symbol</dt>
          <dd class="mt-1 text-sm text-gray-900">{selectedType.icon || '—'}</dd>
        </div>
      </dl>

      <div>
        <h4 class="text-sm font-medium text-gray-800">Felder ({selectedType.fields.length})</h4>
        {#if selectedType.fields.length > 0}
          <ul class="mt-2 divide-y divide-gray-100 rounded border border-gray-100">
            {#each selectedType.fields as field (field.nr)}
              <li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3 text-sm">
                <div>
                  <span class="font-medium text-gray-900">{field.name}</span>
                  <span class="ml-2 text-gray-500">{field.art}</span>
                  {#if field.optionen}
                    <p class="mt-1 text-xs text-gray-500">Optionen: {field.optionen}</p>
                  {/if}
                </div>
                <span class="text-xs text-gray-600">
                  {field.pflicht ? 'Pflichtfeld' : 'Optional'}{field.sensitiv ? ' · Sensitiv' : ''}
                </span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="mt-1 text-sm text-gray-500">Keine Felder definiert.</p>
        {/if}
      </div>

      <div>
        <h4 class="text-sm font-medium text-gray-800">Blöcke ({selectedType.blocks.length})</h4>
        {#if selectedType.blocks.length > 0}
          <ul class="mt-2 divide-y divide-gray-100 rounded border border-gray-100">
            {#each selectedType.blocks as block (block.compId)}
              <li class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span class="font-medium text-gray-900">{block.compId}</span>
                <span class="text-gray-600">Minimum {block.min} · Maximum {block.max}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="mt-1 text-sm text-gray-500">Keine Blöcke definiert.</p>
        {/if}
      </div>
    </section>
  {/if}
</div>
