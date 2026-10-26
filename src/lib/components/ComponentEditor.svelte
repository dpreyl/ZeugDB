<script lang="ts">
  import type { ComponentDefinition, FieldType } from '$lib/parser/types';
  import type { TypeFieldDraft } from './type-form.helpers';

  type Props = {
    component: ComponentDefinition | null;
    onSave: (component: ComponentDefinition) => void;
    onCancel: () => void;
  };

  let { component, onSave, onCancel }: Props = $props();
  let id = $state('');
  let name = $state('');
  let fields = $state<TypeFieldDraft[]>([]);
  let errors = $state<string[]>([]);

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

  $effect(() => {
    id = component?.id ?? '';
    name = component?.name ?? '';
    fields = component?.fields.map(field => ({
      name: field.name,
      art: field.art,
      optionen: field.optionen
        ? field.optionen.split(field.optionen.includes('|') ? '|' : ',').map(option => option.trim()).filter(Boolean)
        : [],
      pflicht: field.pflicht,
      sensitiv: field.sensitiv
    })) ?? [];
    errors = [];
  });

  function addField() {
    fields.push({ name: '', art: 'text', optionen: [], pflicht: false, sensitiv: false });
  }

  function save() {
    const componentId = id.trim();
    const fieldNames = fields.map(field => field.name.trim().toLocaleLowerCase());
    errors = [];
    if (!componentId) errors.push('Bitte gib eine Komponenten-ID ein.');
    if (!name.trim()) errors.push('Bitte gib einen Komponentennamen ein.');
    if (fieldNames.some(fieldName => !fieldName)) errors.push('Bitte gib für jedes Feld einen Namen ein.');
    if (new Set(fieldNames.filter(Boolean)).size !== fieldNames.filter(Boolean).length) {
      errors.push('Feldnamen müssen eindeutig sein.');
    }
    if (errors.length > 0) return;

    const definition: ComponentDefinition = {
      id: componentId,
      name: name.trim(),
      fields: fields.map((field, nr): FieldType => ({
        nr,
        name: field.name.trim(),
        art: field.art,
        optionen: ['dropdown', 'auswahl', 'asset_ref'].includes(field.art)
          ? field.optionen.map(option => option.trim()).filter(Boolean).join('|') || null
          : null,
        pflicht: field.pflicht,
        sensitiv: field.sensitiv
      }))
    };
    onSave(definition);
  }
</script>

<form
  onsubmit={(event) => { event.preventDefault(); save(); }}
  class="space-y-5 rounded-lg border border-gray-200 bg-white p-4 sm:p-6"
>
  <div class="flex items-start justify-between gap-3">
    <div>
      <h3 class="text-lg font-semibold text-gray-900">{component ? 'Komponente bearbeiten' : 'Neue Komponente anlegen'}</h3>
      <p class="mt-1 text-xs text-gray-500">Komponentenfelder werden einmal hier definiert und in Typen wiederverwendet.</p>
    </div>
    <button type="button" onclick={onCancel} class="text-sm text-gray-500 hover:text-gray-800">Schließen</button>
  </div>

  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block text-sm font-medium text-gray-700">
      Komponenten-ID
      <input bind:value={id} disabled={!!component} maxlength="80" placeholder="z. B. port" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" />
    </label>
    <label class="block text-sm font-medium text-gray-700">
      Anzeigename
      <input bind:value={name} maxlength="80" placeholder="z. B. Port" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
    </label>
  </div>

  <section class="space-y-3" aria-labelledby="component-fields-heading">
    <div class="flex items-center justify-between gap-3">
      <h4 id="component-fields-heading" class="font-medium text-gray-900">Komponentenfelder</h4>
      <button type="button" onclick={addField} class="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">+ Feld hinzufügen</button>
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
            <input bind:value={field.name} aria-label="Feldname" maxlength="80" placeholder="z. B. Anschlussart" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label class="block text-sm font-medium text-gray-700">
            Eingabetyp
            <select bind:value={field.art} aria-label="Eingabetyp" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {#if !fieldTypes.some(option => option.value === field.art)}
                <option value={field.art}>{field.art} (bisheriger Typ)</option>
              {/if}
              {#each fieldTypes as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button type="button" onclick={() => fields.splice(index, 1)} aria-label={`Feld ${field.name || index + 1} entfernen`} class="self-end rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50">Entfernen</button>
        </div>
        {#if field.art === 'dropdown' || field.art === 'auswahl' || field.art === 'asset_ref'}
          <div class="space-y-2 rounded-md bg-gray-50 p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-gray-700">{field.art === 'asset_ref' ? 'Kompatible Asset-Typ-IDs' : 'Auswahlwerte'}</span>
              <button type="button" onclick={() => field.optionen.push('')} class="text-sm text-blue-700 hover:underline">
                {field.art === 'asset_ref' ? '+ Kompatibler Typ' : '+ Wert hinzufügen'}
              </button>
            </div>
            {#each field.optionen as option, optionIndex (optionIndex)}
              <div class="flex gap-2">
                <input bind:value={field.optionen[optionIndex]} aria-label={field.art === 'asset_ref' ? `Kompatibler Typ ${optionIndex + 1}` : `Auswahlwert ${optionIndex + 1}`} maxlength="80" class="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                <button type="button" onclick={() => field.optionen.splice(optionIndex, 1)} aria-label={`Wert ${optionIndex + 1} entfernen`} class="rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50">Entfernen</button>
              </div>
            {/each}
          </div>
        {/if}
        <div class="flex flex-wrap gap-x-6 gap-y-2">
          <label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" bind:checked={field.pflicht} class="rounded border-gray-300" />Pflichtfeld</label>
          <label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" bind:checked={field.sensitiv} class="rounded border-gray-300" />Sensible Daten</label>
        </div>
      </fieldset>
    {/each}
  </section>

  {#if errors.length > 0}
    <div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <ul class="list-inside list-disc space-y-1">{#each errors as error (error)}<li>{error}</li>{/each}</ul>
    </div>
  {/if}
  <div class="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
    <button type="submit" class="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">Speichern</button>
    <button type="button" onclick={onCancel} class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Abbrechen</button>
  </div>
</form>
