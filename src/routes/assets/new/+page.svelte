<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getComponentsStore } from '$lib/stores/components.store.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { getTypesStore } from '$lib/stores/types.store.svelte';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import AssetTypeFields from '$lib/components/AssetTypeFields.svelte';
  import AssetBlocks from '$lib/components/AssetBlocks.svelte';
  import { resolveAssetTypeFields } from '$lib/components/asset-type-fields';
  import { createBlockValues, resolveAssetTypeBlocks } from '$lib/components/asset-blocks.helpers';
  import type { AssetBlockValues } from '$lib/components/asset-blocks.helpers';
  import { getFotoStore } from '$lib/stores/fotos.store.svelte';
  import { initFotoService } from '$lib/services/foto-init';
  import { uploadImageFields } from '$lib/components/asset-image-fields';
  import { clearFormDraft, readFormDraft, writeFormDraft } from '$lib/services/form-drafts';
  import { formDraftFiles } from '$lib/services/form-draft-files';
  import { persistStore } from '$lib/services/init';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';

  let type = $state('');
  let designation = $state('');
  let fieldValues = $state<Record<string, string>>({});
  let blockValues = $state<AssetBlockValues>({});
  let location = $state('');
  let selectedImages = $state<Record<string, File>>({});
  let imagePreviews = $state<Record<string, string>>({});
  let saving = $state(false);
  let savingDraftFields = $state<string[]>([]);
  let imageError = $state('');
  let restoringDraft = $state(true);
  let draftCompleted = false;
  const pendingDraftWrites = new Map<string, Promise<void>>();

  const assets = getAssetStore();
  const components = getComponentsStore();
  const locations = getLocationsStore();
  const types = getTypesStore();
  const editMode = getEditMode();
  let draftAssetId = $state(assets.reserveAssetId());
  const typeFields = $derived(resolveAssetTypeFields(type, types.all));
  const typeBlocks = $derived(resolveAssetTypeBlocks(type, types.all));
  const assetOptions = $derived(assets.all.map(asset => {
    const assetType = types.all.find(item => item.id === asset.type);
    const fields = assets.getFields(asset.id);
    const details = [fields.hersteller, fields.modell].filter(Boolean).join(' ');
    return {
      id: asset.id,
      type: asset.type,
      label: [assetType?.name ?? asset.type, details, asset.id].filter(Boolean).join(' · ')
    };
  }));
  let blockTypeId = '';

  $effect(() => {
    if (!types.all.some(item => item.id === type) && types.all.length > 0) {
      type = types.all[0].id;
    }
    if (type !== blockTypeId) {
      blockTypeId = type;
      blockValues = createBlockValues(resolveAssetTypeBlocks(type, types.all));
    }
  });

  $effect(() => {
    if (restoringDraft || draftCompleted) return;
    writeFormDraft('asset:new', {
      id: draftAssetId,
      type,
      designation,
      fields: { ...fieldValues },
      blocks: JSON.parse(JSON.stringify(blockValues)),
      location
    });
  });

  onMount(async () => {
    const draft = readFormDraft<{
      id?: string;
      type?: string;
      designation?: string;
      fields?: Record<string, string>;
      blocks?: AssetBlockValues;
      location?: string;
    }>('asset:new');

    if (draft) {
      draftAssetId = draft.id || draftAssetId;
      type = draft.type || type;
      blockTypeId = draft.type || '';
      designation = draft.designation ?? '';
      fieldValues = draft.fields ?? {};
      blockValues = draft.blocks ?? {};
      location = draft.location ?? '';
    }

    try {
      selectedImages = await formDraftFiles.load('asset:new');
      imagePreviews = Object.fromEntries(Object.entries(selectedImages).map(([name, file]) => [
        name,
        URL.createObjectURL(file)
      ]));
    } catch {
      imageError = 'Gespeicherte Bildauswahl konnte nicht wiederhergestellt werden.';
    } finally {
      restoringDraft = false;
    }
  });

  function updateField(name: string, value: string) {
    fieldValues[name] = value;
  }

  async function handleImageSelect(name: string, file: File) {
    const oldPreview = imagePreviews[name];
    if (oldPreview) URL.revokeObjectURL(oldPreview);
    selectedImages[name] = file;
    imagePreviews = { ...imagePreviews, [name]: URL.createObjectURL(file) };
    savingDraftFields = [...savingDraftFields, name];
    imageError = '';
    const write = formDraftFiles.save('asset:new', name, file);
    pendingDraftWrites.set(name, write);
    try {
      await write;
    } catch {
      imageError = 'Bild konnte nicht lokal für die Wiederherstellung gespeichert werden.';
    } finally {
      pendingDraftWrites.delete(name);
      savingDraftFields = savingDraftFields.filter(field => field !== name);
    }
  }

  async function handleSave(event: SubmitEvent) {
    event.preventDefault();
    if (!editMode.isEditing || !type || !designation.trim() || saving) return;

    saving = true;
    imageError = '';
    try {
      await Promise.all(pendingDraftWrites.values());
      let fields = Object.fromEntries(
        typeFields.map(field => [field.name, fieldValues[field.name] ?? ''])
      );
      if (typeFields.some(field => field.art === 'image') && Object.keys(selectedImages).length > 0) {
        await initFotoService();
        const fotoStore = getFotoStore();
        if (fotoStore.fehle) throw new Error('Foto-Service nicht verfügbar (kein Git-Repo initialisiert)');
        fields = await uploadImageFields(
          draftAssetId,
          typeFields,
          selectedImages,
          fields,
          async (assetId, file) => {
            const bytes = new Uint8Array(await file.arrayBuffer());
            return fotoStore.uploadFoto(assetId, bytes, file.type);
          },
          (fieldName, path) => {
            fieldValues[fieldName] = path;
            const { [fieldName]: _uploaded, ...remaining } = selectedImages;
            selectedImages = remaining;
            void formDraftFiles.clear('asset:new', fieldName);
          }
        );
      }

      const imagePaths = typeFields
        .filter(field => field.art === 'image')
        .map(field => fields[field.name])
        .filter(Boolean);
      assets.createAsset({
        id: draftAssetId,
        type,
        location: location || null,
        fields: {
          bezeichnung: designation.trim(),
          ...fields,
          ...(imagePaths.length > 0 && { fotos: imagePaths.join(',') })
        },
        blocks: blockValues
      });
      persistStore();
      draftCompleted = true;
      clearFormDraft('asset:new');
      await formDraftFiles.clear('asset:new');
      goto(`${base}/`);
    } catch (err) {
      imageError = err instanceof Error ? err.message : 'Bild-Upload fehlgeschlagen';
    } finally {
      saving = false;
    }
  }

  async function cancelForm() {
    draftCompleted = true;
    clearFormDraft('asset:new');
    await formDraftFiles.clear('asset:new');
    goto(`${base}/`);
  }

  onDestroy(() => Object.values(imagePreviews).forEach(URL.revokeObjectURL));
</script>

<form onsubmit={handleSave} class="max-w-2xl space-y-6">
  <div class="flex items-center gap-3">
    <a href="{base}/" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</a>
    <h2 class="text-xl font-semibold text-gray-900">Neues Asset</h2>
  </div>

  <div class="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
    {#if !editMode.isEditing}
      <p class="text-sm text-gray-500" role="status">Zum Anlegen eines Assets den Schreibmodus aktivieren.</p>
    {/if}
    <fieldset disabled={!editMode.isEditing} class="m-0 min-w-0 space-y-4 border-0 p-0">
    <div>
      <label for="bezeichnung" class="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
      <input id="bezeichnung" bind:value={designation} required maxlength="160" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
    </div>
    <div>
      <label for="type" class="block text-sm font-medium text-gray-700 mb-1">Typ</label>
      <select id="type" bind:value={type} required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        {#each types.all as item (item.id)}
          <option value={item.id}>{item.name ?? item.id}</option>
        {/each}
      </select>
    </div>

    <AssetTypeFields
      fields={typeFields}
      values={fieldValues}
      editable={true}
      assets={assetOptions}
      types={types.all}
      onValueChange={updateField}
      onImageSelect={handleImageSelect}
      imagePreviews={imagePreviews}
      uploadingImageFields={[...new Set([...savingDraftFields, ...(saving ? Object.keys(selectedImages) : [])])]}
    />

    <AssetBlocks
      definitions={typeBlocks}
      components={components.all}
      values={blockValues}
      assets={assetOptions}
      types={types.all}
      editable={true}
      onValueChange={(values) => blockValues = values}
    />

    <div>
      <label for="location" class="block text-sm font-medium text-gray-700 mb-1">Standort</label>
      <select id="location" bind:value={location} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        <option value="">Kein Standort</option>
        {#each locations.all as item (item.id)}
          <option value={item.id}>{item.name ?? item.id}</option>
        {/each}
      </select>
      <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">Standort mit GPS-Koordinaten anlegen oder auf der Karte anzeigen</a>
    </div>
    </fieldset>

    {#if imageError}
      <p class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{imageError}</p>
    {/if}

    <div class="flex gap-3 pt-2">
      {#if editMode.isEditing}
        <button type="submit" disabled={saving} class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Bilder werden gespeichert…' : 'Erzeugen'}
        </button>
      {/if}
      <button type="button" onclick={cancelForm} class="px-4 py-2 text-gray-600 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
        Abbrechen
      </button>
    </div>
  </div>
</form>