<script lang="ts">
  import type { BlockDef, TypeDefinition } from '$lib/parser/types';
  import {
    buildTypeDefinition,
    createTypeDraft,
    previewTypeId,
    type TypeFieldDraft
  } from './type-form.helpers';

  type Props = {
    type: TypeDefinition | null;
    existingTypes: TypeDefinition[];
    onSave: (type: TypeDefinition) => void;
    onCancel: () => void;
  };

  let { type, existingTypes, onSave, onCancel }: Props = $props();
  let formName = $state('');
  let formExtends = $state('');
  let formKategorie = $state('');
  let formIcon = $state('');
  let fields = $state<TypeFieldDraft[]>([]);
  let blocks = $state<BlockDef[]>([]);
  let errors = $state<string[]>([]);

  $effect(() => {
    const initialDraft = createTypeDraft(type);
    formName = initialDraft.name;
    formExtends = initialDraft.extendsId;
    formKategorie = initialDraft.kategorie;
    formIcon = initialDraft.icon;
    fields = initialDraft.fields;
    blocks = initialDraft.blocks;
    errors = [];
  });

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Zahl' },
    { value: 'date', label: 'Datum' },
    { value: 'boolean', label: 'Ja/Nein' },
    { value: 'dropdown', label: 'Auswahlliste' },
    { value: 'uuid', label: 'UUID' },
    { value: 'asset_ref', label: 'Asset-Referenz' },
    { value: 'auswahl', label: 'Auswahl (alt)' }
  ];

  function addField() {
    fields.push({ name: '', art: 'text', optionen: [], pflicht: false, sensitiv: false });
  }

  function addBlock() {
    blocks.push({ compId: '', min: 0, max: 1 });
  }

  function save() {
    const result = buildTypeDefinition({
      id: type?.id ?? null,
      name: formName,
      extendsId: formExtends,
      kategorie: formKategorie,
      icon: formIcon,
      fields,
      blocks
    }, existingTypes);
    errors = result.errors;
    if (result.type) onSave(result.type);
  }
</script>

<form
  onsubmit={(event) => { event.preventDefault(); save(); }}
  class="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 space-y-6"
>
  <div class="flex items-start justify-between gap-3">
    <div>
      <h3 class="text-lg font-semibold text-gray-900">{type ? 'Typ bearbeiten' : 'Neuen Typ anlegen'}</h3>
      {#if !type}
        <p class="mt-1 text-xs text-gray-500">ID wird automatisch aus dem Namen erzeugt: {previewTypeId(formName) || '—'}</p>
      {:else}
        <p class="mt-1 text-xs text-gray-500">Typ-ID: {type.id}</p>
      {/if}
    </div>
    <button type="button" onclick={onCancel} class="text-sm text-gray-500 hover:text-gray-800">Schließen</button>
  </div>

  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block text-sm font-medium text-gray-700">
      Name
      <input
        bind:value={formName}
        required
        maxlength="80"
        placeholder="z. B. Projektor"
        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
    <label class="block text-sm font-medium text-gray-700">
      Kategorie
      <input
        bind:value={formKategorie}
        maxlength="60"
        placeholder="z. B. Gerät"
        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
    <label class="block text-sm font-medium text-gray-700">
      Basiert auf
      <select bind:value={formExtends} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">Keine Vererbung</option>
        {#each existingTypes.filter(item => item.id !== type?.id) as parent (parent.id)}
          <option value={parent.id}>{parent.name ?? parent.id}</option>
        {/each}
      </select>
    </label>
    <label class="block text-sm font-medium text-gray-700">
      Icon-Schlüssel <span class="font-normal text-gray-500">(optional)</span>
      <input
        bind:value={formIcon}
        maxlength="60"
        placeholder="z. B. projector"
        class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  </div>

  <section class="space-y-3" aria-labelledby="fields-heading">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h4 id="fields-heading" class="font-medium text-gray-900">Felder</h4>
        <p class="text-xs text-gray-500">Lege fest, welche Angaben zu Assets dieses Typs gehören.</p>
      </div>
      <button type="button" onclick={addField} class="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
        + Feld hinzufügen
      </button>
    </div>

    {#if fields.length === 0}
      <p class="rounded-md bg-gray-50 p-3 text-sm text-gray-500">Noch keine Felder angelegt.</p>
    {/if}

    {#each fields as field, index (index)}
      <fieldset class="space-y-3 rounded-md border border-gray-200 p-3">
        <legend class="sr-only">Feld {index + 1}</legend>
        <div class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label class="block text-sm font-medium text-gray-700">
            Feldname
            <input
              bind:value={field.name}
              maxlength="80"
              placeholder="z. B. Hersteller"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm font-medium text-gray-700">
            Eingabetyp
            <select bind:value={field.art} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {#if !fieldTypes.some(option => option.value === field.art)}
                <option value={field.art}>{field.art} (bisheriger Typ)</option>
              {/if}
              {#each fieldTypes as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button
            type="button"
            onclick={() => fields.splice(index, 1)}
            aria-label={`Feld ${field.name || index + 1} entfernen`}
            class="self-end rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Entfernen
          </button>
        </div>

        {#if field.art === 'dropdown' || field.art === 'auswahl'}
          <div class="space-y-2 rounded-md bg-gray-50 p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-gray-700">Auswahlwerte</span>
              <button
                type="button"
                onclick={() => field.optionen.push('')}
                class="text-sm text-blue-700 hover:underline"
              >
                + Wert hinzufügen
              </button>
            </div>
            {#each field.optionen as option, optionIndex (optionIndex)}
              <div class="flex gap-2">
                <input
                  bind:value={field.optionen[optionIndex]}
                  maxlength="80"
                  aria-label={`Auswahlwert ${optionIndex + 1}`}
                  placeholder="z. B. Einwandfrei"
                  class="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onclick={() => field.optionen.splice(optionIndex, 1)}
                  aria-label={`Auswahlwert ${optionIndex + 1} entfernen`}
                  class="rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  Entfernen
                </button>
              </div>
            {/each}
            {#if field.optionen.length === 0}
              <p class="text-xs text-gray-500">Füge mindestens einen Auswahlwert hinzu.</p>
            {/if}
          </div>
        {/if}

        <div class="flex flex-wrap gap-x-6 gap-y-2">
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" bind:checked={field.pflicht} class="rounded border-gray-300" />
            Pflichtfeld
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" bind:checked={field.sensitiv} class="rounded border-gray-300" />
            Sensible Daten
          </label>
        </div>
      </fieldset>
    {/each}
  </section>

  <section class="space-y-3" aria-labelledby="blocks-heading">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h4 id="blocks-heading" class="font-medium text-gray-900">Bausteine</h4>
        <p class="text-xs text-gray-500">Wiederholbare Gruppen wie Anschlüsse oder Ports.</p>
      </div>
      <button type="button" onclick={addBlock} class="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
        + Baustein hinzufügen
      </button>
    </div>

    {#each blocks as block, index (index)}
      <fieldset class="grid gap-3 rounded-md border border-gray-200 p-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
        <legend class="sr-only">Baustein {index + 1}</legend>
        <label class="block text-sm font-medium text-gray-700">
          Baustein-ID
          <input
            bind:value={block.compId}
            maxlength="80"
            placeholder="z. B. port"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-sm font-medium text-gray-700">
          Minimum
          <input type="number" min="0" step="1" bind:value={block.min} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm font-medium text-gray-700">
          Maximum
          <input type="number" min="0" step="1" bind:value={block.max} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <button type="button" onclick={() => blocks.splice(index, 1)} class="self-end rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50">
          Entfernen
        </button>
      </fieldset>
    {/each}
  </section>

  {#if errors.length > 0}
    <div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <ul class="list-inside list-disc space-y-1">
        {#each errors as error (error)}
          <li>{error}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
    <button type="submit" class="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">
      Speichern
    </button>
    <button type="button" onclick={onCancel} class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
      Abbrechen
    </button>
  </div>
</form>
