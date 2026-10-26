<script lang="ts">
  import type { FieldType, TypeDefinition } from '$lib/parser/types';
  import { compatibleAssets, type AssetReferenceOption } from './asset-blocks.helpers';
  import { fieldOptions } from './asset-type-fields';

  type Props = {
    fields: FieldType[];
    values: Record<string, string>;
    editable: boolean;
    onValueChange: (name: string, value: string) => void;
    assets?: AssetReferenceOption[];
    types?: TypeDefinition[];
    excludedAssetId?: string;
    onImageSelect?: (name: string, file: File) => void | Promise<void>;
    imageUrls?: Record<string, string>;
    imagePreviews?: Record<string, string>;
    uploadingImageFields?: string[];
  };

  let {
    fields,
    values,
    editable,
    onValueChange,
    assets = [],
    types = [],
    excludedAssetId,
    onImageSelect,
    imageUrls = {},
    imagePreviews = {},
    uploadingImageFields = []
  }: Props = $props();

  function optionsFor(field: FieldType): string[] {
    return field.art === 'boolean' ? ['true', 'false'] : fieldOptions(field);
  }

  function displayValue(field: FieldType): string {
    const value = values[field.name] ?? '';
    if (!value) return '—';
    if (field.art === 'boolean') return value === 'true' ? 'Ja' : value === 'false' ? 'Nein' : value;
    if (field.art === 'asset_ref') return assets.find(asset => asset.id === value)?.label ?? value;
    return value;
  }

  function imageUrl(field: FieldType): string {
    const value = values[field.name] ?? '';
    return imagePreviews[field.name] ?? imageUrls[value] ?? '';
  }

</script>

{#if fields.length > 0}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {#each fields as field (field.name)}
      {#if editable}
        <label class="block text-sm font-medium text-gray-700">
          {field.name}{#if field.pflicht}<span aria-hidden="true"> *</span>{/if}
          {#if field.art === 'image'}
            {#if imageUrl(field)}
              <img src={imageUrl(field)} alt={field.name} class="mt-2 h-32 w-full rounded-md border border-gray-200 bg-gray-50 object-contain" />
            {/if}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              capture="environment"
              required={field.pflicht && !values[field.name] && !imagePreviews[field.name]}
              aria-label="Bild für {field.name}"
              disabled={uploadingImageFields.includes(field.name)}
              onchange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                input.value = '';
                if (file) await onImageSelect?.(field.name, file);
              }}
              class="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {#if uploadingImageFields.includes(field.name)}
              <span class="mt-1 block text-xs text-gray-500" role="status">Bild wird gespeichert…</span>
            {:else if values[field.name]}
              <span class="mt-1 block text-xs text-gray-500">Bild gespeichert</span>
            {/if}
          {:else if field.art === 'dropdown' || field.art === 'auswahl' || field.art === 'boolean' || field.art === 'asset_ref'}
            <select
              name={field.name}
              value={values[field.name] ?? ''}
              onchange={(event) => onValueChange(field.name, event.currentTarget.value)}
              required={field.pflicht}
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Bitte wählen</option>
              {#if field.art === 'asset_ref'}
                {#each compatibleAssets(field, assets, types, excludedAssetId) as option (option.id)}
                  <option value={option.id}>{option.label}</option>
                {/each}
              {:else}
                {#each optionsFor(field) as option (option)}
                  <option value={option}>{field.art === 'boolean' ? (option === 'true' ? 'Ja' : 'Nein') : option}</option>
                {/each}
              {/if}
            </select>
          {:else}
            <input
              name={field.name}
              type={field.sensitiv ? 'password' : field.art === 'number' || field.art === 'date' ? field.art : 'text'}
              value={values[field.name] ?? ''}
              oninput={(event) => onValueChange(field.name, event.currentTarget.value)}
              required={field.pflicht}
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          {/if}
        </label>
      {:else}
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">{field.name}</dt>
          <dd class="mt-1 min-h-9 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {#if field.art === 'image' && imageUrl(field)}
              <img src={imageUrl(field)} alt={field.name} class="max-h-40 rounded-md object-contain" />
            {:else}
              {displayValue(field)}
            {/if}
          </dd>
        </div>
      {/if}
    {/each}
  </div>
{/if}
