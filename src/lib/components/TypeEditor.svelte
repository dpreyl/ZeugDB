<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { BlockDef, ComponentDefinition, FieldType, TypeDefinition } from '$lib/parser/types';
  import { clearFormDraft, readFormDraft, writeFormDraft } from '$lib/services/form-drafts';
  import {
    buildTypeDefinition,
    createTypeDraft,
    previewTypeId,
    type TypeFieldDraft
  } from './type-form.helpers';

  type Props = {
    type: TypeDefinition | null;
    existingTypes: TypeDefinition[];
    existingComponents?: ComponentDefinition[];
    onSave: (type: TypeDefinition) => void;
    onCancel: () => void;
  };

  type BlockDraft = BlockDef;
  let { type, existingTypes, existingComponents = [], onSave, onCancel }: Props = $props();
  const initialType = untrack(() => type);
  let formName = $state('');
  let formExtends = $state('');
  let formKategorie = $state('');
  let formIcon = $state('');
  let fields = $state<TypeFieldDraft[]>([]);
  let blocks = $state<BlockDraft[]>([]);
  let errors = $state<string[]>([]);
  let restoringDraft = $state(true);
  let draftCompleted = false;
  const draftKey = `type:${initialType?.id ?? 'new'}`;

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

  onMount(() => {
    const draft = readFormDraft<{
      name: string;
      extendsId: string;
      kategorie: string;
      icon: string;
      fields: TypeFieldDraft[];
      blocks: BlockDraft[];
    }>(draftKey);
    if (draft) {
      formName = draft.name;
      formExtends = draft.extendsId;
      formKategorie = draft.kategorie;
      formIcon = draft.icon;
      fields = draft.fields;
      blocks = draft.blocks;
    }
    restoringDraft = false;
  });

  $effect(() => {
    if (restoringDraft || draftCompleted) return;
    writeFormDraft(draftKey, {
      name: formName,
      extendsId: formExtends,
      kategorie: formKategorie,
      icon: formIcon,
      fields: JSON.parse(JSON.stringify(fields)),
      blocks: JSON.parse(JSON.stringify(blocks))
    });
  });

  function cancel() {
    draftCompleted = true;
    clearFormDraft(draftKey);
    onCancel();
  }

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Zahl' },
    { value: 'decimal', label: 'Kommazahl' },
    { value: 'date', label: 'Datum' },
    { value: 'boolean', label: 'Ja/Nein' },
    { value: 'dropdown', label: 'Auswahlliste' },
    { value: 'uuid', label: 'UUID' },
    { value: 'asset_ref', label: 'Asset-Referenz' },
    { value: 'image', label: 'Bild' },
    { value: 'images', label: 'Mehrere Bilder' },
    { value: 'auswahl', label: 'Auswahl (alt)' }
  ];

  function addField() {
    fields.push({ name: '', art: 'text', optionen: [], pflicht: false, sensitiv: false });
  }

  function addBlock() {
    blocks.push({ compId: '', min: 0, max: 1 });
  }

  function selectComponent(block: BlockDraft, compId: string) {
    block.compId = compId;
    block.fixedFields = undefined;
  }

  function setFixedField(block: BlockDraft, fieldName: string, value: string) {
    const fixedFields = { ...block.fixedFields };
    if (value) fixedFields[fieldName] = value;
    else delete fixedFields[fieldName];
    block.fixedFields = Object.keys(fixedFields).length > 0 ? fixedFields : undefined;
  }

  function optionsFor(field: FieldType): string[] {
    return field.optionen?.split(/[|,]/).map(option => option.trim()).filter(Boolean) ?? [];
  }

  function save() {
    const missingComponents = blocks.some(block =>
      !existingComponents.some(component => component.id === block.compId)
    );
    const result = buildTypeDefinition({
      id: type?.id ?? null,
      name: formName,
      extendsId: formExtends,
      kategorie: formKategorie,
      icon: formIcon,
      fields,
      blocks: blocks.map(block => ({
        compId: block.compId,
        min: block.min,
        max: block.max,
        ...(block.fixedFields && { fixedFields: { ...block.fixedFields } })
      }))
    }, existingTypes);
    errors = missingComponents
      ? [...result.errors.filter(error => error !== 'Bitte wähle für jeden Baustein eine Komponente aus.'), 'Bitte wähle eine vorhandene Komponente aus.']
      : result.errors;
    if (result.type && errors.length === 0) {
      draftCompleted = true;
      clearFormDraft(draftKey);
      onSave(result.type);
    }
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
    <button type="button" onclick={cancel} class="text-sm text-gray-500 hover:text-gray-800">Schließen</button>
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

        {#if field.art === 'dropdown' || field.art === 'auswahl' || field.art === 'asset_ref'}
          <div class="space-y-2 rounded-md bg-gray-50 p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-gray-700">{field.art === 'asset_ref' ? 'Kompatible Asset-Typ-IDs' : 'Auswahlwerte'}</span>
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
        <p class="text-xs text-gray-500">Verweise auf separat definierte Komponenten; hier werden nur Anzahl und Wiederholung festgelegt.</p>
      </div>
      <button type="button" onclick={addBlock} class="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
        + Baustein hinzufügen
      </button>
    </div>

    {#each blocks as block, index (index)}
      {@const component = existingComponents.find(item => item.id === block.compId)}
      <fieldset class="space-y-4 rounded-md border border-gray-200 p-3">
        <legend class="sr-only">Baustein {index + 1}</legend>
        <div class="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto]">
          <label class="block text-sm font-medium text-gray-700">
            Baustein-Komponente
            <select value={block.compId} onchange={(event) => selectComponent(block, event.currentTarget.value)} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Komponente wählen</option>
              {#if block.compId && !existingComponents.some(component => component.id === block.compId)}
                <option value={block.compId}>{block.compId} (nicht vorhanden)</option>
              {/if}
              {#each existingComponents as component (component.id)}
                <option value={component.id}>{component.name || component.id}</option>
              {/each}
            </select>
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
        </div>

        {#if component?.fields.length}
          <div class="space-y-3 border-t border-gray-100 pt-3">
            <div>
              <h5 class="text-sm font-medium text-gray-800">Typfeste Komponentenwerte</h5>
              <p class="text-xs text-gray-500">Leere Vorgaben bleiben beim Asset änderbar. Festgelegte Werte werden für jede Instanz dieses Typs übernommen und gesperrt.</p>
            </div>
            {#each component.fields as field (field.name)}
              <label class="block max-w-md text-sm font-medium text-gray-700">
                Fester Wert für {field.name}
                {#if field.art === 'dropdown' || field.art === 'auswahl'}
                  <select
                    aria-label={`Fester Wert für ${field.name}`}
                    value={block.fixedFields?.[field.name] ?? ''}
                    onchange={(event) => setFixedField(block, field.name, event.currentTarget.value)}
                    class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Bei Asset eingeben</option>
                    {#each optionsFor(field) as option (option)}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                {:else if field.art === 'boolean'}
                  <select
                    aria-label={`Fester Wert für ${field.name}`}
                    value={block.fixedFields?.[field.name] ?? ''}
                    onchange={(event) => setFixedField(block, field.name, event.currentTarget.value)}
                    class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Bei Asset eingeben</option>
                    <option value="true">Ja</option>
                    <option value="false">Nein</option>
                  </select>
                {:else if field.art === 'asset_ref'}
                  <span class="mt-1 block text-xs font-normal text-gray-500">Asset-Referenzen werden pro Asset gewählt.</span>
                {:else}
                  <input
                    aria-label={`Fester Wert für ${field.name}`}
                    type={field.art === 'number' || field.art === 'decimal' ? 'number' : field.art === 'date' ? 'date' : 'text'}
                    step={field.art === 'decimal' ? 'any' : undefined}
                    value={block.fixedFields?.[field.name] ?? ''}
                    oninput={(event) => setFixedField(block, field.name, event.currentTarget.value)}
                    placeholder="Bei Asset eingeben"
                    class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                {/if}
              </label>
            {/each}
          </div>
        {/if}

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
    <button type="button" onclick={cancel} class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
      Abbrechen
    </button>
  </div>
</form>
