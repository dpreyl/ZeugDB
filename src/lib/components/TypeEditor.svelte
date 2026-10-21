<script lang="ts">
  import type { BlockDef, ComponentDefinition, FieldType, TypeDefinition } from '$lib/parser/types';
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
    onSave: (type: TypeDefinition, components: ComponentDefinition[]) => void;
    onCancel: () => void;
  };

  type BlockDraft = BlockDef & { name: string; fields: TypeFieldDraft[] };
  let { type, existingTypes, existingComponents = [], onSave, onCancel }: Props = $props();
  let formName = $state('');
  let formExtends = $state('');
  let formKategorie = $state('');
  let formIcon = $state('');
  let fields = $state<TypeFieldDraft[]>([]);
  let blocks = $state<BlockDraft[]>([]);
  let errors = $state<string[]>([]);

  $effect(() => {
    const initialDraft = createTypeDraft(type);
    formName = initialDraft.name;
    formExtends = initialDraft.extendsId;
    formKategorie = initialDraft.kategorie;
    formIcon = initialDraft.icon;
    fields = initialDraft.fields;
    blocks = initialDraft.blocks.map(block => {
      const component = existingComponents.find(item => item.id === block.compId);
      return {
        ...block,
        name: component?.name ?? block.compId,
        fields: component?.fields.map(fieldToDraft) ?? []
      };
    });
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
    blocks.push({ compId: '', name: '', min: 0, max: 1, fields: [] });
  }

  function save() {
    const componentErrors = validateComponentDrafts(blocks);
    const result = buildTypeDefinition({
      id: type?.id ?? null,
      name: formName,
      extendsId: formExtends,
      kategorie: formKategorie,
      icon: formIcon,
      fields,
      blocks: blocks.map(({ compId, min, max }) => ({ compId, min, max }))
    }, existingTypes);
    errors = [...result.errors, ...componentErrors];
    if (result.type && errors.length === 0) {
      onSave(result.type, blocks.map(block => ({
        id: block.compId.trim(),
        name: block.name.trim() || block.compId.trim(),
        fields: block.fields.map((field, nr) => fieldToDefinition(field, nr))
      })));
    }
  }

  function addComponentField(block: BlockDraft) {
    block.fields.push({ name: '', art: 'text', optionen: [], pflicht: false, sensitiv: false });
  }

  function fieldToDraft(field: FieldType): TypeFieldDraft {
    return {
      name: field.name,
      art: field.art,
      optionen: field.optionen
        ? field.optionen.split(field.optionen.includes('|') ? '|' : ',').map(option => option.trim()).filter(Boolean)
        : [],
      pflicht: field.pflicht,
      sensitiv: field.sensitiv
    };
  }

  function fieldToDefinition(field: TypeFieldDraft, nr: number): FieldType {
    return {
      nr,
      name: field.name.trim(),
      art: field.art,
      optionen: field.art === 'dropdown' || field.art === 'auswahl' || field.art === 'asset_ref'
        ? field.optionen.map(option => option.trim()).join('|') || null
        : null,
      pflicht: field.pflicht,
      sensitiv: field.sensitiv
    };
  }

  function validateComponentDrafts(drafts: BlockDraft[]): string[] {
    const errors: string[] = [];
    for (const block of drafts) {
      const names = block.fields.map(field => field.name.trim().toLocaleLowerCase());
      if (names.some(name => !name)) errors.push(`Bitte gib für jedes Feld im Baustein ${block.compId || 'ohne ID'} einen Namen ein.`);
      if (new Set(names.filter(Boolean)).size !== names.filter(Boolean).length) {
        errors.push(`Feldnamen im Baustein ${block.compId || 'ohne ID'} müssen eindeutig sein.`);
      }
    }
    return errors;
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
        <p class="text-xs text-gray-500">Wiederholbare Gruppen wie Anschlüsse oder Ports, mit eigenen Feldern.</p>
      </div>
      <button type="button" onclick={addBlock} class="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
        + Baustein hinzufügen
      </button>
    </div>

    {#each blocks as block, index (index)}
      <fieldset class="space-y-4 rounded-md border border-gray-200 p-3">
        <legend class="sr-only">Baustein {index + 1}</legend>
        <div class="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_8rem_auto]">
          <label class="block text-sm font-medium text-gray-700">
            Baustein-ID
            <input bind:value={block.compId} maxlength="80" placeholder="z. B. port" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label class="block text-sm font-medium text-gray-700">
            Anzeigename
            <input bind:value={block.name} maxlength="80" placeholder="z. B. Port" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
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

        <div class="space-y-2 border-t border-gray-100 pt-3">
          <div class="flex items-center justify-between gap-3">
            <h5 class="text-sm font-medium text-gray-800">Felder für {block.name || block.compId || 'Baustein'}</h5>
            <button type="button" onclick={() => addComponentField(block)} class="text-sm text-blue-700 hover:underline">
              + Komponentenfeld
            </button>
          </div>
          {#each block.fields as field, fieldIndex (fieldIndex)}
            <fieldset class="grid gap-3 rounded-md bg-gray-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <legend class="sr-only">Komponentenfeld {fieldIndex + 1}</legend>
              <label class="block text-sm font-medium text-gray-700">
                Feldname
                <input bind:value={field.name} aria-label="Komponentenfeldname" maxlength="80" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label class="block text-sm font-medium text-gray-700">
                Eingabetyp
                <select bind:value={field.art} aria-label="Komponenten-Eingabetyp" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {#each fieldTypes as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <button type="button" onclick={() => block.fields.splice(fieldIndex, 1)} class="self-end rounded-md px-3 py-2 text-sm text-red-700">
                Entfernen
              </button>
              {#if field.art === 'asset_ref'}
                <div class="space-y-2 sm:col-span-2">
                  <p class="text-sm text-gray-700">Kompatible Asset-Typ-IDs</p>
                  {#each field.optionen as option, optionIndex (optionIndex)}
                    <input bind:value={field.optionen[optionIndex]} aria-label="Komponenten-Asset-Typ" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  {/each}
                  <button type="button" onclick={() => field.optionen.push('')} class="mt-1 text-xs text-blue-700">+ Typ-ID</button>
                </div>
              {/if}
              <label class="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" bind:checked={field.pflicht} />
                Pflichtfeld
              </label>
            </fieldset>
          {/each}
        </div>
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
