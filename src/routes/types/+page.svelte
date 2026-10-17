<script lang="ts">
  import { getTypesStore } from '$lib/stores/types.store.svelte';
  import { parseType } from '$lib/parser/type.parser';
  import type { TypeDefinition } from '$lib/parser/types';
  import { persistStore } from '$lib/services/init';

  const store = getTypesStore();
  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let formName = $state('');
  let formExtends = $state('');
  let formKategorie = $state('');
  let formRawText = $state('');

  function resetForm() {
    showForm = false;
    editingId = null;
    formName = '';
    formExtends = '';
    formKategorie = '';
    formRawText = '';
  }

  function startEdit(type: TypeDefinition) {
    editingId = type.id;
    formName = type.name ?? '';
    formExtends = type.extends ?? '';
    formKategorie = type.kategorie ?? '';
    formRawText = generateRawText(type);
    showForm = true;
  }

  function generateRawText(type: TypeDefinition): string {
    const lines: string[] = [];
    if (type.extends) lines.push(`extends: ${type.extends}`);
    if (type.name) lines.push(`name: ${type.name}`);
    if (type.kategorie) lines.push(`kategorie: ${type.kategorie}`);
    if (type.icon) lines.push(`icon: ${type.icon}`);
    for (const f of type.fields) {
      let line = `feld: ${f.name}, ${f.art}`;
      if (f.optionen) line += `, ${f.optionen}`;
      line += f.pflicht ? ', pflicht' : ', optional';
      if (f.sensitiv) line += ', sensitiv';
      lines.push(line);
    }
    for (const b of type.blocks) {
      lines.push(`block: ${b.compId}, ${b.min}, ${b.max}`);
    }
    return lines.join('\n');
  }

  function handleSave() {
    const id = editingId ?? formName.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!id) return;
    const text = formExtends
      ? `extends: ${formExtends}\nname: ${formName}\nkategorie: ${formKategorie}\n${formRawText}`
      : `name: ${formName}\nkategorie: ${formKategorie}\n${formRawText}`;
    const parsed = parseType(id, text);
    store.add(parsed);
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
      <h2 class="text-xl font-semibold text-gray-900">Typen</h2>
      <p class="text-sm text-gray-500">Asset-Typ-Definitionen verwalten</p>
    </div>
    <button
      onclick={() => { resetForm(); showForm = true; }}
      class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
    >
      + Neuer Typ
    </button>
  </div>

  {#if showForm}
    <div class="p-4 border border-gray-200 rounded-lg space-y-4">
      <input
        bind:value={formName}
        placeholder="Name (z.B. Projektor)"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      />
      <input
        bind:value={formExtends}
        placeholder="Erbt von (z.B. _base)"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      />
      <input
        bind:value={formKategorie}
        placeholder="Kategorie (z.B. gerät)"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      />
      <textarea
        bind:value={formRawText}
        placeholder="Felder und Blöcke (eine pro Zeile)..."
        rows={6}
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
      ></textarea>
      <div class="flex gap-2">
        <button onclick={handleSave} class="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">
          Speichern
        </button>
        <button onclick={resetForm} class="px-4 py-2 bg-gray-400 text-white text-sm rounded-md hover:bg-gray-500">
          Abbrechen
        </button>
      </div>
    </div>
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
            <div class="flex gap-1">
              <button onclick={() => startEdit(type)} class="text-xs text-blue-600 hover:underline">Bearbeiten</button>
              <button onclick={() => handleDelete(type.id)} class="text-xs text-red-600 hover:underline">Löschen</button>
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
</div>