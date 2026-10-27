<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getTypesStore } from '$lib/stores/types.store.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import { getFotoStore } from '$lib/stores/fotos.store.svelte';
  import { initFotoService } from '$lib/services/foto-init';
  import { persistStore } from '$lib/services/init';
  import { getLocationSelectOptions } from '$lib/locations/location-tree';
  import { sortByLabel } from '$lib/components/sort-options';
  import { photoRoleField, type PhotoRole } from '$lib/components/asset-photo.helpers';
  import type { AssetBlockValues } from '$lib/components/asset-blocks.helpers';
  import {
    getMeasurementsForProtectionClass,
    getNextInspectionIndex,
    searchInspectionCandidates
  } from '$lib/inspections/dguv.helpers';
  import { loadInspectionSession, saveInspectionSession } from '$lib/inspections/inspection-session';

  const assets = getAssetStore();
  const types = getTypesStore();
  const locations = getLocationsStore();
  const editMode = getEditMode();

  let examiner = $state('');
  let locationId = $state('');
  let searchQuery = $state('');
  let selectedAssetId = $state('');
  let creatingNew = $state(false);
  let designation = $state('');
  let typeId = $state('');
  let protectionClass = $state('');
  let measurementValues = $state<Record<string, string>>({});
  let result = $state('Bestanden');
  let defects = $state('');
  let overviewFile = $state<File | null>(null);
  let labelFile = $state<File | null>(null);
  let error = $state('');
  let success = $state('');
  let saving = $state(false);
  let inspectionDate = $state('');

  const locationOptions = $derived(getLocationSelectOptions(locations.all));
  const sortedTypes = $derived(sortByLabel(
    types.all.filter(type => type.id !== '_base'),
    type => type.name?.trim() || type.id
  ));
  const candidates = $derived.by(() => {
    assets.fieldsVersion;
    return assets.all.map(asset => {
      const fields = assets.getFields(asset.id);
      const typeName = types.all.find(type => type.id === asset.type)?.name ?? asset.type;
      const blockText = Object.values(assets.getBlocks(asset.id))
        .flatMap(instances => Object.values(instances).flatMap(values => Object.values(values)));
      return {
        id: asset.id,
        type: asset.type,
        typeName,
        designation: fields.bezeichnung?.trim() || 'Ohne Bezeichnung',
        location: asset.location ? locations.findById(asset.location)?.name ?? asset.location : 'Kein Standort',
        searchValues: [...Object.values(fields), ...blockText]
      };
    });
  });
  const matches = $derived(searchInspectionCandidates(candidates, searchQuery));
  const selectedAsset = $derived(selectedAssetId ? assets.findById(selectedAssetId) : undefined);
  const selectedFields = $derived.by(() => {
    assets.fieldsVersion;
    return selectedAsset ? assets.getFields(selectedAsset.id) : {};
  });
  const measurementFields = $derived(getMeasurementsForProtectionClass(protectionClass) ?? []);
  const photoRoles = $derived([
    {
      role: 'uebersicht' as const,
      label: 'Geräteübersichtsbild',
      path: selectedFields[photoRoleField('uebersicht')]
    },
    {
      role: 'typenschild' as const,
      label: 'Typenschildbild',
      path: selectedFields[photoRoleField('typenschild')]
    }
  ]);
  onMount(() => {
    const session = loadInspectionSession();
    examiner = session.examiner;
    locationId = locations.all.some(location => location.id === session.locationId)
      ? session.locationId
      : '';
    inspectionDate = getLocalDate();
  });

  function saveSession() {
    saveInspectionSession({ examiner, locationId });
  }

  function selectAsset(id: string) {
    const asset = assets.findById(id);
    if (!asset) return;
    selectedAssetId = id;
    creatingNew = false;
    designation = assets.getField(id, 'bezeichnung')?.trim() || '';
    typeId = asset.type;
    protectionClass = getFieldIgnoreCase(assets.getFields(id), 'Schutzklasse');
    measurementValues = {};
    result = 'Bestanden';
    defects = '';
    overviewFile = null;
    labelFile = null;
    error = '';
    success = '';
  }

  function startNewAsset() {
    selectedAssetId = '';
    creatingNew = true;
    designation = searchQuery.trim();
    typeId = '';
    protectionClass = '';
    measurementValues = {};
    result = 'Bestanden';
    defects = '';
    overviewFile = null;
    labelFile = null;
    error = '';
    success = '';
  }

  function resetForNextInspection() {
    searchQuery = '';
    selectedAssetId = '';
    creatingNew = false;
    designation = '';
    typeId = '';
    protectionClass = '';
    measurementValues = {};
    result = 'Bestanden';
    defects = '';
    overviewFile = null;
    labelFile = null;
    inspectionDate = getLocalDate();
  }

  function onProtectionClassChange(value: string) {
    protectionClass = value;
    measurementValues = {};
  }

  async function handleSave(event: SubmitEvent) {
    event.preventDefault();
    if (!editMode.isEditing || saving || !examiner.trim() || !locationId || !protectionClass) return;
    if (creatingNew && (!designation.trim() || !typeId)) return;
    if (!creatingNew && !selectedAsset) return;

    saving = true;
    error = '';
    success = '';
    try {
      const assetId = selectedAsset?.id ?? assets.reserveAssetId();
      const fields = selectedAsset ? assets.getFields(assetId) : {};
      fields.bezeichnung = designation.trim();
      const protectionClassKey = Object.keys(fields)
        .find(name => name.toLocaleLowerCase('de-DE') === 'schutzklasse') ?? 'Schutzklasse';
      fields[protectionClassKey] = protectionClass;

      const imagePaths: string[] = [];
      const imageInputs: [PhotoRole, File | null][] = [
        ['uebersicht', overviewFile],
        ['typenschild', labelFile]
      ];
      if (imageInputs.some(([, file]) => file)) {
        await initFotoService();
        const fotoStore = getFotoStore();
        if (fotoStore.fehle) throw new Error('Foto-Service nicht verfügbar (kein Git-Repo initialisiert)');
        for (const [role, file] of imageInputs) {
          if (!file) continue;
          const path = await fotoStore.uploadFoto(
            assetId,
            new Uint8Array(await file.arrayBuffer()),
            file.type
          );
          fields[photoRoleField(role)] = path;
          imagePaths.push(path);
        }
        fields.fotos = [...new Set([
          ...(fields.fotos ?? '').split(',').map(path => path.trim()).filter(Boolean),
          ...imagePaths
        ])].join(',');
      }

      const inspection: Record<string, string> = {
        Prüfdatum: inspectionDate,
        Prüfer: examiner.trim(),
        Prüfart: selectedAsset ? 'Wiederholungsprüfung' : 'Erstprüfung',
        Schutzklasse: protectionClass,
        Prüfergebnis: result,
        ...(defects.trim() ? { Mängel: defects.trim() } : {})
      };
      for (const measurement of measurementFields) {
        const value = String(measurementValues[measurement.name] ?? '');
        inspection[measurement.name] = value;
        if (measurement.legacyName) inspection[measurement.legacyName] = value;
      }

      if (selectedAsset) {
        const blocks = assets.getBlocks(assetId);
        const nextIndex = String(getNextInspectionIndex(blocks));
        blocks.pruefung = {
          ...(blocks.pruefung ?? {}),
          [nextIndex]: inspection
        };
        assets.updateAsset(assetId, { location: locationId, fields, blocks });
      } else {
        assets.createAsset({
          id: assetId,
          type: typeId,
          location: locationId,
          fields,
          blocks: { pruefung: { '0': inspection } }
        });
      }
      persistStore();
      saveSession();
      resetForNextInspection();
      success = 'Prüfung gespeichert. Prüfer und Raum bleiben für die nächste Prüfung übernommen.';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Prüfung konnte nicht gespeichert werden.';
    } finally {
      saving = false;
    }
  }

  function getFieldIgnoreCase(fields: Record<string, string>, target: string): string {
    const key = Object.keys(fields).find(name => name.toLocaleLowerCase('de-DE') === target.toLocaleLowerCase('de-DE'));
    return key ? fields[key] ?? '' : '';
  }

  function getLocalDate(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
</script>

<svelte:head>
  <title>DGUV-Prüfung | ZeugDB</title>
</svelte:head>

<section class="mx-auto max-w-3xl space-y-5">
  <div class="flex items-center gap-3">
    <a href="{base}/" class="text-sm text-gray-500 hover:text-gray-700">← Zurück zu Assets</a>
    <h2 class="text-xl font-semibold text-gray-900">DGUV-Prüfungsassistent</h2>
  </div>

  {#if !editMode.isEditing}
    <p class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
      Zum Erfassen einer Prüfung zuerst den Schreibmodus aktivieren.
    </p>
  {/if}

  <form onsubmit={handleSave} class="space-y-5">
    <fieldset disabled={!editMode.isEditing || saving} class="space-y-5 border-0 p-0">
      <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 class="mb-4 font-semibold text-gray-900">Prüfung vorbereiten</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm font-medium text-gray-700">
            Prüfer
            <input
              aria-label="Prüfer"
              required
              maxlength="160"
              bind:value={examiner}
              oninput={saveSession}
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm font-medium text-gray-700">
            Prüfungsraum
            <select
              aria-label="Prüfungsraum"
              required
              value={locationId}
              onchange={(event) => {
                locationId = event.currentTarget.value;
                saveSession();
              }}
              class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Raum auswählen</option>
              {#each locationOptions as option (option.id)}
                <option value={option.id}>{option.label}</option>
              {/each}
            </select>
          </label>
        </div>
        <p class="mt-3 text-xs text-gray-500">Prüfer und Raum werden für weitere Prüfungen auf diesem Gerät gemerkt.</p>
      </section>

      <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 class="font-semibold text-gray-900">Gerät finden</h3>
        <p class="mt-1 text-sm text-gray-600">Suche berücksichtigt alle Räume, da Geräte umgestellt werden können.</p>
        <label class="mt-3 block text-sm font-medium text-gray-700">
          Gerät oder Typ suchen
          <input
            aria-label="Gerät oder Typ suchen"
            type="search"
            bind:value={searchQuery}
            placeholder="Bezeichnung, Geräteart, Inventarnummer …"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {#if searchQuery.trim() && !selectedAsset && !creatingNew}
          {#if matches.length}
            <ul class="mt-3 max-h-56 space-y-2 overflow-auto" aria-label="Gefundene Geräte">
              {#each matches as candidate (candidate.id)}
                <li>
                  <button
                    type="button"
                    onclick={() => selectAsset(candidate.id)}
                    class="w-full rounded-md border border-gray-200 px-3 py-2 text-left hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span class="block font-medium text-gray-900">{candidate.designation}</span>
                    <span class="block text-xs text-gray-600">{candidate.typeName} · {candidate.location} · {candidate.id}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="mt-3 text-sm text-gray-600">Kein Gerät gefunden.</p>
          {/if}
          <button
            type="button"
            onclick={startNewAsset}
            class="mt-3 rounded-md border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Neues Gerät erfassen
          </button>
        {/if}

        {#if selectedAsset}
          <div class="mt-3 flex items-start justify-between gap-3 rounded-md bg-blue-50 p-3">
            <div>
              <p class="font-medium text-blue-900">{designation}</p>
              <p class="text-sm text-blue-800">
                {types.all.find(type => type.id === selectedAsset.type)?.name ?? selectedAsset.type}
                · Bisheriger Raum: {selectedAsset.location ? locations.findById(selectedAsset.location)?.name ?? selectedAsset.location : 'Kein Raum'}
              </p>
              <p class="mt-1 text-xs font-medium text-blue-800">Wiederholungsprüfung</p>
            </div>
            <button type="button" onclick={resetForNextInspection} class="text-sm text-blue-700 underline">Anderes Gerät</button>
          </div>
        {/if}

        {#if creatingNew}
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label class="block text-sm font-medium text-gray-700">
              Bezeichnung
              <input aria-label="Bezeichnung" required maxlength="160" bind:value={designation} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label class="block text-sm font-medium text-gray-700">
              Gerätetyp
              <select aria-label="Gerätetyp" required bind:value={typeId} class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="">Typ auswählen</option>
                {#each sortedTypes as type (type.id)}
                  <option value={type.id}>{type.name ?? type.id}</option>
                {/each}
              </select>
            </label>
          </div>
          <p class="mt-2 text-xs font-medium text-gray-600">Erstprüfung</p>
        {/if}
      </section>

      {#if selectedAsset || creatingNew}
        <section class="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 class="font-semibold text-gray-900">Gerätedaten und Prüfung</h3>
          {#if selectedAsset}
            <label class="block max-w-xs text-sm font-medium text-gray-700">
              Bezeichnung
              <input aria-label="Bezeichnung" required maxlength="160" bind:value={designation} class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
          {/if}
          <label class="block max-w-xs text-sm font-medium text-gray-700">
            Schutzklasse
            <select
              aria-label="Schutzklasse"
              required
              value={protectionClass}
              onchange={(event) => onProtectionClassChange(event.currentTarget.value)}
              class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Schutzklasse auswählen</option>
              <option value="I">SK I</option>
              <option value="II">SK II</option>
              {#if protectionClass && protectionClass !== 'I' && protectionClass !== 'II'}
                <option value={protectionClass}>SK {protectionClass} (Messwerte nicht unterstützt)</option>
              {/if}
            </select>
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            {#each photoRoles as { role, label, path: currentPath }}
              <label class="block rounded-md border border-gray-200 p-3 text-sm font-medium text-gray-700">
                {label} <span class="font-normal text-gray-500">(optional)</span>
                <span class="mt-1 block text-xs font-normal text-gray-500">
                  {currentPath ? 'Bild vorhanden' : 'Noch kein Bild hinterlegt'}
                </span>
                {#if currentPath}
                  <span class="block truncate text-xs font-normal text-gray-500">{currentPath.split('/').pop()}</span>
                {/if}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  capture="environment"
                  aria-label="{label} aufnehmen (optional)"
                  onchange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    if (role === 'uebersicht') overviewFile = file;
                    else labelFile = file;
                  }}
                  class="mt-2 block w-full text-xs text-gray-500"
                />
              </label>
            {/each}
          </div>

          {#if measurementFields.length}
            <fieldset class="space-y-3 border-t border-gray-100 pt-4">
              <legend class="font-medium text-gray-900">Messwerte für Schutzklasse {protectionClass}</legend>
              <div class="grid gap-3 sm:grid-cols-2">
                {#each measurementFields as measurement (measurement.name)}
                  <label class="block text-sm font-medium text-gray-700">
                    {measurement.label} ({measurement.unit})
                    <input
                      aria-label="{measurement.label} ({measurement.unit})"
                      type="number"
                      min="0"
                      step="any"
                      required
                      bind:value={measurementValues[measurement.name]}
                      class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                {/each}
              </div>
            </fieldset>
          {:else}
            <p class="text-sm text-red-700" role="alert">Für diese Schutzklasse sind in diesem Assistenten keine Messwerte definiert. Bitte SK I oder SK II auswählen.</p>
          {/if}

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm font-medium text-gray-700">
              Prüfdatum
              <input aria-label="Prüfdatum" type="date" readonly value={inspectionDate} class="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
            </label>
            <label class="block text-sm font-medium text-gray-700">
              Prüfergebnis
              <select aria-label="Prüfergebnis" bind:value={result} required class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="Bestanden">Bestanden</option>
                <option value="Nicht bestanden">Nicht bestanden</option>
              </select>
            </label>
          </div>
          {#if result === 'Nicht bestanden'}
            <label class="block text-sm font-medium text-gray-700">
              Festgestellte Mängel
              <textarea aria-label="Festgestellte Mängel" bind:value={defects} rows="3" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"></textarea>
            </label>
          {/if}
        </section>
      {/if}
    </fieldset>

    {#if error}
      <p class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>
    {/if}
    {#if success}
      <p class="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{success}</p>
    {/if}
    {#if selectedAsset || creatingNew}
      <div class="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || measurementFields.length === 0}
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Prüfung wird gespeichert…' : 'Prüfung speichern und nächste'}
        </button>
        <button type="button" onclick={() => goto(`${base}/`)} class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700">
          Beenden
        </button>
      </div>
    {/if}
  </form>
</section>
