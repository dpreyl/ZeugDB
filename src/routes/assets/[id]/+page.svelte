<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { getTypesStore } from '$lib/stores/types.store.svelte';
  import { getComponentsStore } from '$lib/stores/components.store.svelte';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import AssetTypeFields from '$lib/components/AssetTypeFields.svelte';
  import AssetBlocks from '$lib/components/AssetBlocks.svelte';
  import AssetPhotoGallery from '$lib/components/AssetPhotoGallery.svelte';
  import { resolveAssetTypeFields } from '$lib/components/asset-type-fields';
  import { createBlockValues, resolveAssetTypeBlocks, type AssetBlockValues } from '$lib/components/asset-blocks.helpers';
  import {
    appendBlockImagePaths,
    getBlockImageFieldKey,
    getBlockImageFields,
    getBlockImagePaths,
    removeBlockImagePath
  } from '$lib/components/asset-block-image-fields';
  import { getFotoStore } from '$lib/stores/fotos.store.svelte';
  import { initFotoService } from '$lib/services/foto-init';
  import { persistStore } from '$lib/services/init';
  import { photoRoleField, setPhotoRolePath, type PhotoRole } from '$lib/components/asset-photo.helpers';
  import { appendImageFieldPaths, getImageFieldPaths, serializeImagePaths } from '$lib/components/asset-image-fields';
  import { clearFormDraft, readFormDraft, writeFormDraft } from '$lib/services/form-drafts';

  let { data }: { data: PageData } = $props();
  const assets = getAssetStore();
  const components = getComponentsStore();
  const locations = getLocationsStore();
  const types = getTypesStore();
  const editMode = getEditMode();
  let designation = $state('');
  let fieldValues = $state<Record<string, string>>({});
  let blockValues = $state<AssetBlockValues>({});
  let fotoError = $state('');
  let uploading = $state(false);
  let uploadingImageFields = $state<string[]>([]);
  let fotoUrls = $state<Record<string, string>>({});
  let restoringDraft = $state(true);
  let draftCompleted = false;
  const initialAssetId = untrack(() => data.id);
  const draftKey = `asset:edit:${initialAssetId}`;

  let fotos = $derived.by(() => {
    assets.fieldsVersion;
    return (assets.getField(data.id, 'fotos') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  });
  let fotoRollenzuordnung = $derived.by(() => {
    assets.fieldsVersion;
    return {
      typenschild: assets.getField(data.id, photoRoleField('typenschild')) || '',
      uebersicht: assets.getField(data.id, photoRoleField('uebersicht')) || ''
    };
  });

  const typeFields = $derived(resolveAssetTypeFields(data.type, types.all));
  const typeBlocks = $derived(resolveAssetTypeBlocks(data.type, types.all));
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

  $effect(() => {
    designation = String(data.bezeichnung ?? '');
    fieldValues = Object.fromEntries(
      typeFields.map(field => [field.name, String(data[field.name] ?? '')])
    );
    blockValues = createBlockValues(typeBlocks, data.blocks ?? {});
  });

  $effect(() => {
    if (restoringDraft || draftCompleted) return;
    writeFormDraft(draftKey, {
      designation,
      fieldValues: { ...fieldValues },
      blockValues: JSON.parse(JSON.stringify(blockValues))
    });
  });

  function updateField(name: string, value: string) {
    fieldValues[name] = value;
  }

  function handleSave(event: SubmitEvent) {
    event.preventDefault();
    if (!editMode.isEditing || !designation.trim()) return;
    const fd = new FormData(event.currentTarget as HTMLFormElement);
    const fields: Record<string, string> = {};
    for (const [key, value] of fd.entries()) {
      if (key !== 'type' && key !== 'location') fields[key] = value as string;
    }
    fields.fotos = assets.getField(data.id, 'fotos') ?? '';
    assets.updateAsset(data.id, {
      fields,
      blocks: blockValues,
      location: String(fd.get('location') ?? '') || null
    });
    draftCompleted = true;
    clearFormDraft(draftKey);
    persistStore();
    goto(`${base}/`);
  }

  function handleDelete() {
    if (!editMode.isEditing) return;
    if (!confirm('Asset ' + data.id + ' wirklich löschen?')) return;
    if (!assets.remove(data.id)) return;
    draftCompleted = true;
    clearFormDraft(draftKey);
    persistStore();
    goto(`${base}/`);
  }

  async function handleFotoUpload(event: Event, role: PhotoRole) {
    if (!editMode.isEditing) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    fotoError = '';
    uploading = true;

    try {
      await initFotoService();
      const fotoStore = getFotoStore();
      if (fotoStore.fehle) {
        fotoError = 'Foto-Service nicht verfügbar (kein Git-Repo initialisiert)';
        return;
      }
      const arrayBuffer = await file.arrayBuffer();
      const pfad = await fotoStore.uploadFoto(data.id, new Uint8Array(arrayBuffer), file.type);
      fotoUrls = {
        ...fotoUrls,
        [pfad]: URL.createObjectURL(new Blob([arrayBuffer], { type: file.type }))
      };
      // Foto-Referenz in Asset-Felder speichern
      const assetStore = getAssetStore();
      const liste = [...new Set([...fotos, pfad])];
      const fields = setPhotoRolePath(assetStore.getFields(data.id), role, pfad);
      assetStore.setFields(data.id, { ...fields, fotos: liste.join(',') });
      persistStore();
    } catch (err) {
      fotoError = err instanceof Error ? err.message : 'Upload fehlgeschlagen';
    } finally {
      uploading = false;
      input.value = '';
    }
  }

  async function handleFotoLoeschen(index: number) {
    if (!editMode.isEditing) return;
    const pfad = fotos[index];
    if (!pfad) return;
    try {
      const fotoStore = getFotoStore();
      await fotoStore.loescheFoto(pfad);
      const url = fotoUrls[pfad];
      if (url) URL.revokeObjectURL(url);
      const { [pfad]: _removedUrl, ...remainingUrls } = fotoUrls;
      fotoUrls = remainingUrls;
      const assetStore = getAssetStore();
      const neueListe = fotos.filter((_, i) => i !== index);
      const roleFields: Record<string, string> = {};
      if (fotoRollenzuordnung.typenschild === pfad) roleFields[photoRoleField('typenschild')] = '';
      if (fotoRollenzuordnung.uebersicht === pfad) roleFields[photoRoleField('uebersicht')] = '';
      const imageFields = Object.fromEntries(typeFields.flatMap(field => {
        if (field.art !== 'image' && field.art !== 'images') return [];
        const paths = getImageFieldPaths(assetStore.getField(data.id, field.name), field.art);
        if (!paths.includes(pfad)) return [];
        const remaining = paths.filter(path => path !== pfad);
        return [[field.name, field.art === 'images' ? serializeImagePaths(remaining) : '']];
      }));
      for (const field of typeFields) {
        if (field.art !== 'image' && field.art !== 'images') continue;
        const paths = getImageFieldPaths(fieldValues[field.name], field.art);
        if (!paths.includes(pfad)) continue;
        const remaining = paths.filter(path => path !== pfad);
        fieldValues[field.name] = field.art === 'images' ? serializeImagePaths(remaining) : '';
      }
      assetStore.setFields(data.id, { fotos: neueListe.join(','), ...roleFields, ...imageFields });
      blockValues = removeBlockImagePath(blockValues, components.all, pfad);
      persistStore();
    } catch (err) {
      fotoError = err instanceof Error ? err.message : 'Löschen fehlgeschlagen';
    }
  }

  async function handleTypeImageSelect(name: string, file: File) {
    await uploadTypeImages(name, [file]);
  }

  async function handleTypeImagesSelect(name: string, files: File[]) {
    await uploadTypeImages(name, files);
  }

  async function uploadTypeImages(name: string, files: File[]) {
    if (!editMode.isEditing || uploadingImageFields.includes(name)) return;
    fotoError = '';
    uploadingImageFields = [...uploadingImageFields, name];
    try {
      await initFotoService();
      const fotoStore = getFotoStore();
      if (fotoStore.fehle) throw new Error('Foto-Service nicht verfügbar (kein Git-Repo initialisiert)');
      const currentFields = getAssetStore().getFields(data.id);
      const paths: string[] = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const path = await fotoStore.uploadFoto(data.id, bytes, file.type);
        paths.push(path);
        fotoUrls = {
          ...fotoUrls,
          [path]: URL.createObjectURL(new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as BlobPart], { type: file.type }))
        };
      }
      const multiple = typeFields.find(field => field.name === name)?.art === 'images';
      const updatedFields = appendImageFieldPaths(currentFields, name, paths, multiple);
      fieldValues[name] = updatedFields[name];
      getAssetStore().setFields(data.id, updatedFields);
      persistStore();
    } catch (err) {
      fotoError = err instanceof Error ? err.message : 'Bild-Upload fehlgeschlagen';
    } finally {
      uploadingImageFields = uploadingImageFields.filter(field => field !== name);
    }
  }

  async function handleBlockImageSelect(blockId: string, instanceId: string, name: string, file: File) {
    await uploadBlockImages(blockId, instanceId, name, [file]);
  }

  async function handleBlockImagesSelect(blockId: string, instanceId: string, name: string, files: File[]) {
    await uploadBlockImages(blockId, instanceId, name, files);
  }

  async function uploadBlockImages(blockId: string, instanceId: string, name: string, files: File[]) {
    const key = getBlockImageFieldKey(blockId, instanceId, name);
    if (!editMode.isEditing || uploadingImageFields.includes(key)) return;
    fotoError = '';
    uploadingImageFields = [...uploadingImageFields, key];
    try {
      await initFotoService();
      const fotoStore = getFotoStore();
      if (fotoStore.fehle) throw new Error('Foto-Service nicht verfügbar (kein Git-Repo initialisiert)');
      const uploadedPaths: string[] = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const path = await fotoStore.uploadFoto(data.id, bytes, file.type);
        uploadedPaths.push(path);
        fotoUrls = {
          ...fotoUrls,
          [path]: URL.createObjectURL(new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as BlobPart], { type: file.type }))
        };
      }
      const field = components.all.find(component => component.id === blockId)?.fields.find(item => item.name === name);
      blockValues = appendBlockImagePaths(
        blockValues,
        blockId,
        instanceId,
        name,
        uploadedPaths,
        field?.art === 'images'
      );
      const currentFields = assets.getFields(data.id);
      const paths = [...new Set([
        ...(currentFields.fotos || '').split(',').map(path => path.trim()).filter(Boolean),
        ...uploadedPaths
      ])];
      assets.setFields(data.id, { ...currentFields, fotos: paths.join(',') });
      persistStore();
    } catch (err) {
      fotoError = err instanceof Error ? err.message : 'Bild-Upload fehlgeschlagen';
    } finally {
      uploadingImageFields = uploadingImageFields.filter(field => field !== key);
    }
  }

  onMount(() => {
    const draft = readFormDraft<{
      designation: string;
      fieldValues: Record<string, string>;
      blockValues: AssetBlockValues;
    }>(draftKey);
    if (draft) {
      designation = draft.designation;
      fieldValues = draft.fieldValues;
      blockValues = draft.blockValues;
    }
    restoringDraft = false;

    let cancelled = false;
    const loadPreviews = async () => {
      try {
        await initFotoService();
        const fotoStore = getFotoStore();
        if (fotoStore.fehle) return;
        const typeImagePaths = typeFields
          .filter(field => field.art === 'image' || field.art === 'images')
          .flatMap(field => getImageFieldPaths(String(data[field.name] ?? ''), field.art));
        const blockImagePaths = getBlockImagePaths(blockValues, components.all);
        for (const path of new Set([...fotos, ...typeImagePaths, ...blockImagePaths])) {
          try {
            const { data: raw, mimeType } = await fotoStore.ladeFoto(path);
            if (cancelled) return;
            const bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
            fotoUrls = {
              ...fotoUrls,
              [path]: URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }))
            };
          } catch {
            // Fehlende/offline nicht verfügbare Vorschauen bleiben als Dateiname sichtbar.
          }
        }
      } catch {
        // Fotos sind optional, falls das Git-Repo noch nicht initialisiert ist.
      }
    };

    void loadPreviews();
    return () => {
      cancelled = true;
      Object.values(fotoUrls).forEach(URL.revokeObjectURL);
    };
  });
</script>

<form class="max-w-2xl space-y-6" onsubmit={handleSave}>
  <div class="flex items-center gap-3">
    <a href="{base}/" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</a>
    <h2 class="text-xl font-semibold text-gray-900">Asset {data.id}</h2>
  </div>

  <div class="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
    {#if !editMode.isEditing}
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-semibold text-gray-900">Assetdetails</h3>
        <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">Nur Ansicht</span>
      </div>
      <p class="text-sm text-gray-500" role="status">Zum Bearbeiten den Schreibmodus aktivieren.</p>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Bezeichnung</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{designation || 'Ohne Bezeichnung'}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Typ</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{data.type}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Standort</dt>
          <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {data.location ? locations.findById(data.location)?.name ?? data.location : '—'}
          </dd>
          {#if data.location}
            <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">Auf der Standortkarte ansehen</a>
          {/if}
        </div>
      </dl>
      <AssetTypeFields
        fields={typeFields}
        values={fieldValues}
        editable={false}
        assets={assetOptions}
        types={types.all}
        excludedAssetId={data.id}
        onValueChange={updateField}
        imageUrls={fotoUrls}
      />
      <AssetBlocks
        definitions={typeBlocks}
        components={components.all}
        values={blockValues}
        assets={assetOptions}
        types={types.all}
        editable={false}
        excludedAssetId={data.id}
        onValueChange={(values) => blockValues = values}
        imageUrls={fotoUrls}
      />
    {:else}
      <fieldset class="m-0 min-w-0 space-y-4 border-0 p-0">
        <div>
          <label for="bezeichnung" class="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
          <input id="bezeichnung" name="bezeichnung" bind:value={designation} required maxlength="160" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Typ</p>
          <p class="mt-1 text-sm text-gray-900">{data.type}</p>
          <p class="mt-1 text-xs text-gray-500">Der Asset-Typ kann nach dem Anlegen nicht geändert werden.</p>
        </div>

        <AssetTypeFields
          fields={typeFields}
          values={fieldValues}
          editable={true}
          assets={assetOptions}
          types={types.all}
          excludedAssetId={data.id}
          onValueChange={updateField}
          onImageSelect={handleTypeImageSelect}
          onImagesSelect={handleTypeImagesSelect}
          imageUrls={fotoUrls}
          uploadingImageFields={uploadingImageFields}
        />
        <AssetBlocks
          definitions={typeBlocks}
          components={components.all}
          values={blockValues}
          assets={assetOptions}
          types={types.all}
          editable={true}
          excludedAssetId={data.id}
          onValueChange={(values) => blockValues = values}
          onImageSelect={handleBlockImageSelect}
          onImagesSelect={handleBlockImagesSelect}
          imageUrls={fotoUrls}
          uploadingImageFields={uploadingImageFields}
        />

        <div>
          <label for="location" class="block text-sm font-medium text-gray-700 mb-1">Standort</label>
          <select id="location" name="location" value={data.location ?? ''} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Kein Standort</option>
            {#each locations.all as item}
              <option value={item.id}>{item.name ?? item.id}</option>
            {/each}
          </select>
          <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">Standort mit GPS-Koordinaten verwalten</a>
        </div>

      </fieldset>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          Speichern
        </button>
        <button type="button" onclick={handleDelete} class="px-4 py-2 text-red-600 text-sm rounded-md border border-red-300 hover:bg-red-50">
          Löschen
        </button>
      </div>
    {/if}
  </div>

  <AssetPhotoGallery
    fotos={fotos}
    fotoUrls={fotoUrls}
    fotoRollenzuordnung={fotoRollenzuordnung}
    editable={editMode.isEditing}
    uploading={uploading}
    error={fotoError}
    onFotoUpload={handleFotoUpload}
    onFotoDelete={handleFotoLoeschen}
  />
</form>
