<script lang="ts">
  import { onMount } from 'svelte';
  import { getTypesStore } from '$lib/stores/types.store.svelte';
  import { getComponentsStore } from '$lib/stores/components.store.svelte';
  import type { ComponentDefinition, TypeDefinition } from '$lib/parser/types';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import { persistStore } from '$lib/services/init';
  import TypeEditor from '$lib/components/TypeEditor.svelte';
  import ComponentEditor from '$lib/components/ComponentEditor.svelte';
  import { clearFormDraft, readFormDraft, writeFormDraft } from '$lib/services/form-drafts';

  const store = getTypesStore();
  const components = getComponentsStore();
  const editMode = getEditMode();
  let showForm = $state(false);
  let showComponentForm = $state(false);
  let selectedId = $state<string | null>(null);
  const selectedType = $derived(store.all.find((type) => type.id === selectedId));
  let editingId = $state<string | null>(null);
  let editingComponentId = $state<string | null>(null);
  let activeDraft = $state<{ typeId: string | null } | null>(null);
  let restoredActiveDraft = $state(false);

  function resetForm() {
    showForm = false;
    showComponentForm = false;
    editingId = null;
    editingComponentId = null;
    clearFormDraft('type:active');
  }

  function startEdit(type: TypeDefinition) {
    if (!editMode.isEditing) return;
    resetForm();
    selectedId = null;
    editingId = type.id;
    showForm = true;
    writeFormDraft('type:active', { typeId: type.id });
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

  function startComponentEdit(componentId: string | null = null) {
    if (!editMode.isEditing) return;
    resetForm();
    editingComponentId = componentId;
    showComponentForm = true;
  }

  function handleComponentSave(component: ComponentDefinition) {
    if (!editMode.isEditing) return;
    components.add(component);
    persistStore();
    resetForm();
  }

  function handleDelete(id: string) {
    if (!editMode.isEditing) return;
    store.remove(id);
    if (selectedId === id) selectedId = null;
    persistStore();
  }

  onMount(() => {
    activeDraft = readFormDraft<{ typeId: string | null }>('type:active');
    restoredActiveDraft = true;
  });

  $effect(() => {
    if (!restoredActiveDraft || !editMode.isEditing || !activeDraft) return;
    const resumeId = activeDraft.typeId;
    if (resumeId && store.all.length === 0) return;
    if (resumeId && !store.all.some((type) => type.id === resumeId)) {
      clearFormDraft('type:active');
      activeDraft = null;
      return;
    }
    selectedId = null;
    editingId = resumeId;
    showForm = true;
    activeDraft = null;
  });

  $effect(() => {
    if (!editMode.isEditing && (showForm || showComponentForm)) {
      activeDraft = readFormDraft<{ typeId: string | null }>('type:active');
      showForm = false;
      showComponentForm = false;
      editingId = null;
      editingComponentId = null;
    }
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
        onclick={() => {
          resetForm();
          selectedId = null;
          showForm = true;
          writeFormDraft('type:active', { typeId: null });
        }}
        class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
      >
        + Neuer Typ
      </button>
    {/if}
  </div>

  <section aria-labelledby="components-heading" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 id="components-heading" class="font-semibold text-gray-900">Wiederverwendbare Komponenten</h3>
        <p class="mt-1 text-sm text-gray-500">Felder wie „Port“ werden hier definiert. Typen verweisen nur auf die Komponente und legen die Anzahl fest.</p>
      </div>
      {#if editMode.isEditing}
        <button onclick={() => startComponentEdit()} class="shrink-0 rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
          + Neue Komponente
        </button>
      {/if}
    </div>
    {#if components.all.length === 0}
      <p class="text-sm text-gray-500">Keine Komponenten definiert.</p>
    {:else}
      <ul class="divide-y divide-gray-100 rounded border border-gray-100">
        {#each components.all as component (component.id)}
          <li class="flex flex-wrap items-start justify-between gap-3 p-3">
            <div>
              <p class="text-sm font-medium text-gray-900">{component.name || component.id}</p>
              <p class="text-xs text-gray-500">{component.id} · {component.fields.length} Felder</p>
              {#if component.fields.length > 0}
                <p class="mt-1 text-xs text-gray-600">{component.fields.map(field => field.name).join(', ')}</p>
              {/if}
            </div>
            {#if editMode.isEditing}
              <button onclick={() => startComponentEdit(component.id)} aria-label="Komponente bearbeiten: {component.name || component.id}" class="text-xs text-blue-600 hover:underline">Bearbeiten</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if editMode.isEditing && showComponentForm}
    {#key editingComponentId ?? 'new-component'}
      <ComponentEditor
        component={editingComponentId ? components.all.find(component => component.id === editingComponentId) ?? null : null}
        onSave={handleComponentSave}
        onCancel={resetForm}
      />
    {/key}
  {/if}

  {#if editMode.isEditing && showForm}
    {#key editingId ?? 'new'}
      <TypeEditor
        type={editingId ? store.all.find(type => type.id === editingId) ?? null : null}
        existingTypes={store.all}
        existingComponents={components.all}
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
                <button onclick={() => startEdit(type)} aria-label="Typ bearbeiten: {type.name ?? type.id}" class="text-xs text-blue-600 hover:underline">Bearbeiten</button>
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
                <span class="font-medium text-gray-900">{components.all.find(component => component.id === block.compId)?.name ?? block.compId} <span class="font-normal text-gray-500">({block.compId})</span></span>
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
