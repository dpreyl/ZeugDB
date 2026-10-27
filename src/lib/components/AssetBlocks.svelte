<script lang="ts">
  import type { BlockDef, ComponentDefinition, FieldType, TypeDefinition } from '$lib/parser/types';
  import {
    compatibleAssets,
    type AssetBlockValues,
    type AssetReferenceOption
  } from './asset-blocks.helpers';
  import { fieldOptions } from './asset-type-fields';
  import { getImageFieldPaths } from './asset-image-fields';
  import { getBlockImageFieldKey } from './asset-block-image-fields';
  import { sortByLabel } from './sort-options';

  type Props = {
    definitions: BlockDef[];
    components: ComponentDefinition[];
    values: AssetBlockValues;
    assets?: AssetReferenceOption[];
    types?: TypeDefinition[];
    editable: boolean;
    onValueChange: (values: AssetBlockValues) => void;
    onImageSelect?: (blockId: string, instanceId: string, fieldName: string, file: File) => void | Promise<void>;
    onImagesSelect?: (blockId: string, instanceId: string, fieldName: string, files: File[]) => void | Promise<void>;
    imageUrls?: Record<string, string>;
    imagePreviews?: Record<string, string | string[]>;
    uploadingImageFields?: string[];
    excludedAssetId?: string;
  };

  let {
    definitions,
    components,
    values,
    assets = [],
    types = [],
    editable,
    onValueChange,
    onImageSelect,
    onImagesSelect,
    imageUrls = {},
    imagePreviews = {},
    uploadingImageFields = [],
    excludedAssetId
  }: Props = $props();

  function instancesFor(blockId: string): [string, Record<string, string>][] {
    return Object.entries(values[blockId] ?? {}).sort(([left], [right]) => Number(left) - Number(right));
  }

  function componentFor(blockId: string): ComponentDefinition | undefined {
    return components.find(component => component.id === blockId);
  }

  function optionsFor(field: FieldType): AssetReferenceOption[] {
    return sortByLabel(compatibleAssets(field, assets, types, excludedAssetId), option => option.label);
  }

  function changeField(block: BlockDef, index: string, fieldName: string, value: string): void {
    if (block.fixedFields && Object.hasOwn(block.fixedFields, fieldName)) return;
    onValueChange({
      ...values,
      [block.compId]: {
        ...values[block.compId],
        [index]: {
          ...values[block.compId]?.[index],
          [fieldName]: value
        }
      }
    });
  }

  function addInstance(block: BlockDef): void {
    const instances = { ...values[block.compId] };
    let index = 0;
    while (instances[String(index)] !== undefined) index++;
    if (Object.keys(instances).length >= block.max) return;
    onValueChange({
      ...values,
      [block.compId]: {
        ...instances,
        [String(index)]: { ...block.fixedFields }
      }
    });
  }

  function removeInstance(block: BlockDef, index: string): void {
    const instances = { ...values[block.compId] };
    if (Object.keys(instances).length <= block.min) return;
    delete instances[index];
    onValueChange({ ...values, [block.compId]: instances });
  }

  function optionValues(field: FieldType): string[] {
    return field.art === 'boolean' ? ['true', 'false'] : fieldOptions(field);
  }

  function displayValue(field: FieldType, value: string): string {
    if (!value) return '—';
    if (field.art === 'boolean') return value === 'true' ? 'Ja' : value === 'false' ? 'Nein' : value;
    if (field.art === 'asset_ref') return assets.find(asset => asset.id === value)?.label ?? value;
    if (field.art === 'images') return `${getImageFieldPaths(value, field.art).length} Bilder`;
    return value;
  }

  function imagePreviewsFor(blockId: string, instanceId: string, field: FieldType, value: string): string[] {
    const key = getBlockImageFieldKey(blockId, instanceId, field.name);
    const preview = imagePreviews[key];
    if (Array.isArray(preview)) return preview;
    if (preview) return [preview];
    return getImageFieldPaths(value, field.art).map(path => imageUrls[path]).filter(Boolean);
  }
</script>

{#each definitions as block (block.compId)}
  {@const component = componentFor(block.compId)}
  {@const instances = instancesFor(block.compId)}
  <section class="space-y-3" aria-label={component?.name ?? block.compId}>
    <div class="flex items-center justify-between gap-3">
      <div>
        <h3 class="font-medium text-gray-900">{component?.name ?? block.compId}</h3>
        <p class="text-xs text-gray-500">{instances.length} von {block.max} · mindestens {block.min}</p>
      </div>
      {#if editable}
        <button
          type="button"
          onclick={() => addInstance(block)}
          disabled={instances.length >= block.max}
          class="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + {component?.name ?? block.compId} hinzufügen
        </button>
      {/if}
    </div>

    {#if !component}
      <p class="rounded-md bg-amber-50 p-3 text-sm text-amber-800" role="status">
        Für den Baustein „{block.compId}“ fehlt die Komponentendefinition.
      </p>
    {:else if instances.length === 0}
      <p class="text-sm text-gray-500">Noch keine {component.name} eingetragen.</p>
    {/if}

    {#each instances as [index, instance] (index)}
      <fieldset class="space-y-3 rounded-md border border-gray-200 p-3">
        <legend class="px-1 text-xs font-medium text-gray-600">{component?.name ?? block.compId} {Number(index) + 1}</legend>
        {#if component}
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {#each component.fields as field (field.name)}
              {@const value = block.fixedFields?.[field.name] ?? instance[field.name] ?? ''}
              {@const fixed = block.fixedFields !== undefined && Object.hasOwn(block.fixedFields, field.name)}
              {#if editable}
                <label class="block text-sm font-medium text-gray-700">
                  {field.name}{#if field.pflicht}<span aria-hidden="true"> *</span>{/if}
                  {#if field.art === 'dropdown' || field.art === 'auswahl' || field.art === 'boolean' || field.art === 'asset_ref'}
                    <select
                      value={value}
                      onchange={(event) => changeField(block, index, field.name, event.currentTarget.value)}
                      required={field.pflicht}
                      disabled={fixed}
                      class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Bitte wählen</option>
                      {#if field.art === 'asset_ref'}
                        {#each optionsFor(field) as option (option.id)}
                          <option value={option.id}>{option.label}</option>
                        {/each}
                      {:else}
                        {#each optionValues(field) as option (option)}
                          <option value={option}>{field.art === 'boolean' ? (option === 'true' ? 'Ja' : 'Nein') : option}</option>
                        {/each}
                      {/if}
                    </select>
                  {:else if field.art === 'image' || field.art === 'images'}
                    {@const previews = imagePreviewsFor(block.compId, index, field, value)}
                    {@const imageKey = getBlockImageFieldKey(block.compId, index, field.name)}
                    {#if previews.length > 0}
                      <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {#each previews as preview, imageIndex (`${imageKey}-${imageIndex}`)}
                          <img src={preview} alt="{field.name} {imageIndex + 1}" class="h-24 w-full rounded-md border border-gray-200 bg-gray-50 object-contain" />
                        {/each}
                      </div>
                    {/if}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      capture="environment"
                      multiple={field.art === 'images'}
                      required={field.pflicht && getImageFieldPaths(value, field.art).length === 0 && previews.length === 0}
                      aria-label="{field.art === 'images' ? 'Bilder' : 'Bild'} für {component.name} {Number(index) + 1}: {field.name}"
                      disabled={uploadingImageFields.includes(imageKey) || fixed}
                      onchange={async (event) => {
                        const input = event.currentTarget;
                        const files = Array.from(input.files ?? []);
                        input.value = '';
                        if (field.art === 'images') {
                          if (files.length > 0) await onImagesSelect?.(block.compId, index, field.name, files);
                        } else if (files[0]) {
                          await onImageSelect?.(block.compId, index, field.name, files[0]);
                        }
                      }}
                      class="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                    />
                    {#if uploadingImageFields.includes(imageKey)}
                      <span class="mt-1 block text-xs text-gray-500" role="status">Bilder werden gespeichert…</span>
                    {:else if getImageFieldPaths(value, field.art).length > 0}
                      {@const imageCount = getImageFieldPaths(value, field.art).length}
                      <span class="mt-1 block text-xs text-gray-500">{imageCount} {imageCount === 1 ? 'Bild' : 'Bilder'} gespeichert</span>
                    {/if}
                  {:else}
                    <input
                      type={field.sensitiv ? 'password' : field.art === 'number' || field.art === 'decimal' ? 'number' : field.art === 'date' ? 'date' : 'text'}
                      step={field.art === 'decimal' ? 'any' : undefined}
                      value={value}
                      oninput={(event) => changeField(block, index, field.name, event.currentTarget.value)}
                      required={field.pflicht}
                      disabled={fixed}
                      class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  {/if}
                </label>
              {:else}
                <div>
                  <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">{field.name}</dt>
                  <dd class="mt-1 min-h-9 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {#if field.art === 'image' || field.art === 'images'}
                      {@const previews = imagePreviewsFor(block.compId, index, field, value)}
                      {#if previews.length > 0}
                        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {#each previews as preview, imageIndex (`${field.name}-${imageIndex}`)}
                            <img src={preview} alt="{field.name} {imageIndex + 1}" class="h-24 w-full rounded-md border border-gray-200 bg-white object-contain" />
                          {/each}
                        </div>
                      {:else}
                        {displayValue(field, value)}
                      {/if}
                    {:else}
                      {displayValue(field, value)}
                    {/if}
                  </dd>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
        {#if editable}
          <button
            type="button"
            onclick={() => removeInstance(block, index)}
            disabled={instances.length <= block.min}
            aria-label="{component?.name ?? block.compId} {Number(index) + 1} entfernen"
            class="rounded-md px-3 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Entfernen
          </button>
        {/if}
      </fieldset>
    {/each}
  </section>
{/each}
