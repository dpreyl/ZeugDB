<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { clearFormDraft, readFormDraft, writeFormDraft } from '$lib/services/form-drafts';
  import type { Coord, Location, LocationArt } from '$lib/parser/types';
  import CoordinatePicker from '$lib/map/CoordinatePicker.svelte';
  import {
    coordinatesForLocation,
    createLocationId,
    getCurrentPosition,
    getSelectableParents,
    locationCoordinateFields,
    validateCoordinates,
    withCurrentPosition,
    type CoordinateInput
  } from './location-form.helpers';

  type Props = {
    location?: Location;
    locations?: Location[];
    onSave: (location: Location) => void;
    onCancel: () => void;
    disabled?: boolean;
    draftKey?: string;
  };

  let { location, locations = [], onSave, onCancel, disabled = false, draftKey }: Props = $props();
  const initialLocation = untrack(() => location);
  const initialDraftKey = untrack(() => draftKey);
  const formDraftKey = initialDraftKey ?? `location:${initialLocation?.id ?? 'new'}`;
  const initialArt: LocationArt = initialLocation?.art
    ?? (initialLocation?.polygon ? 'raum' : initialLocation?.route ? 'leitung' : 'punkt');
  let art = $state(initialArt);
  let name = $state(initialLocation?.name ?? '');
  let parentId = $state(initialLocation?.eltern ?? '');
  const locationId = $derived(initialLocation?.id ?? (name.trim() ? createLocationId(name, locations) : ''));
  const parentOptions = $derived(getSelectableParents(locations, initialLocation));
  const currentParentIsSelectable = $derived(parentOptions.some(option => option.id === parentId));
  const currentParentName = $derived(
    locations.find(candidate => candidate.id === parentId)?.name ?? parentId
  );
  const currentParentMissing = $derived(Boolean(parentId) && !currentParentIsSelectable);
  let coordinates = $state(coordinatesForLocation(initialLocation, initialArt));
  let validationMessage = $state('');
  let gpsMessage = $state('');
  let isLocating = $state(false);
  let activeMapCoordinateIndex = $state<number | null>(null);
  let restoringDraft = $state(true);
  let draftCompleted = false;

  onMount(() => {
    const draft = readFormDraft<{
      art: LocationArt;
      id?: string;
      name: string;
      parentId: string;
      coordinates: CoordinateInput[];
    }>(formDraftKey);
    if (draft) {
      art = draft.art;
      name = draft.name;
      parentId = draft.parentId;
      coordinates = draft.coordinates;
    }
    restoringDraft = false;
  });

  $effect(() => {
    if (restoringDraft || draftCompleted || disabled) return;
    writeFormDraft(formDraftKey, {
      art,
      name,
      parentId,
      coordinates: JSON.parse(JSON.stringify(coordinates))
    });
  });

  function cancel() {
    draftCompleted = true;
    clearFormDraft(formDraftKey);
    onCancel();
  }

  function changeArt(event: Event) {
    art = (event.currentTarget as HTMLSelectElement).value as LocationArt;
    coordinates = coordinatesForLocation(undefined, art);
    activeMapCoordinateIndex = null;
    validationMessage = '';
  }

  function updateCoordinate(index: number, field: keyof CoordinateInput, value: string) {
    coordinates = coordinates.map((coordinate, coordinateIndex) =>
      coordinateIndex === index ? { ...coordinate, [field]: value } : coordinate
    );
  }

  function addCoordinate() {
    coordinates = [...coordinates, { lat: '', lon: '' }];
  }

  function removeCoordinate(index: number) {
    coordinates = coordinates.filter((_, coordinateIndex) => coordinateIndex !== index);
    if (activeMapCoordinateIndex === index) activeMapCoordinateIndex = null;
    else if (activeMapCoordinateIndex !== null && activeMapCoordinateIndex > index) {
      activeMapCoordinateIndex -= 1;
    }
  }

  function coordinateForMap(index: number): Coord | null {
    const coordinate = coordinates[index];
    if (!coordinate?.lat.trim() || !coordinate.lon.trim()) return null;
    const lat = Number(coordinate.lat);
    const lon = Number(coordinate.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }
    return { lat, lon };
  }

  function applyMapCoordinate(coordinate: Coord) {
    if (activeMapCoordinateIndex === null) return;
    coordinates = coordinates.map((current, index) => index === activeMapCoordinateIndex
      ? { lat: coordinate.lat.toFixed(6), lon: coordinate.lon.toFixed(6) }
      : current);
    activeMapCoordinateIndex = null;
    validationMessage = '';
  }

  async function useCurrentPosition() {
    isLocating = true;
    gpsMessage = 'Standort wird ermittelt …';
    try {
      const currentPosition = await getCurrentPosition();
      coordinates = withCurrentPosition(art, coordinates, currentPosition);
      gpsMessage = 'Standort wurde übernommen.';
    } catch (error) {
      gpsMessage = error instanceof Error
        ? error.message
        : 'Der Standort konnte nicht ermittelt werden.';
    } finally {
      isLocating = false;
    }
  }

  function saveLocation(event: SubmitEvent) {
    event.preventDefault();
    if (disabled) return;
    if (!name.trim()) {
      validationMessage = 'Gib einen Namen für den Standort ein.';
      return;
    }

    const coordinatesError = validateCoordinates(art, coordinates);
    if (coordinatesError) {
      validationMessage = coordinatesError;
      return;
    }

    draftCompleted = true;
    clearFormDraft(formDraftKey);
    onSave({
      ...location,
      id: locationId || createLocationId(name, locations),
      name: name.trim(),
      eltern: parentId.trim() || undefined,
      art,
      ...locationCoordinateFields(art, coordinates)
    });
  }
</script>

{#if disabled}
  <section aria-label="Standortdetails" class="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
    <h3 class="font-semibold text-gray-900">Standortdetails</h3>
    <dl class="grid gap-4 sm:grid-cols-2">
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">ID</dt>
        <dd class="mt-1 text-sm text-gray-900">{locationId || '—'}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Name</dt>
        <dd class="mt-1 text-sm text-gray-900">{name || '—'}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Eltern-ID</dt>
        <dd class="mt-1 text-sm text-gray-900">{parentId
          ? `${currentParentName}${locations.some(candidate => candidate.id === parentId) ? ` (${parentId})` : ' (nicht gefunden)'}`
          : '—'}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Standortart</dt>
        <dd class="mt-1 text-sm text-gray-900">{art === 'punkt' ? 'Punkt' : art === 'raum' ? 'Raum' : 'Leitung'}</dd>
      </div>
    </dl>
    <div>
      <h4 class="text-sm font-medium text-gray-700">
        {art === 'punkt' ? 'Koordinaten' : art === 'raum' ? 'Eckpunkte' : 'Wegpunkte'}
      </h4>
      {#if coordinates.length > 0}
        <ol class="mt-2 space-y-1">
          {#each coordinates as coordinate, index}
            <li class="text-sm text-gray-700">
              {index + 1}. Breitengrad {coordinate.lat || '—'}, Längengrad {coordinate.lon || '—'}
            </li>
          {/each}
        </ol>
      {:else}
        <p class="mt-1 text-sm text-gray-500">Keine Koordinaten hinterlegt.</p>
      {/if}
    </div>
  </section>
{:else}
<form onsubmit={saveLocation} class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
  <fieldset disabled={disabled} class="m-0 min-w-0 space-y-4 border-0 p-0">
  <div class="space-y-3">
    <label class="block space-y-1 text-sm font-medium text-gray-700">
      <span>Automatisch erzeugte ID</span>
      <input
        aria-label="Standort-ID"
        value={locationId}
        readonly
        placeholder="Wird aus dem Namen erzeugt"
        class="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-600"
      />
    </label>
    <label class="block space-y-1 text-sm font-medium text-gray-700">
      <span>Name</span>
      <input
        bind:value={name}
        required
        autocomplete="off"
        placeholder="z. B. Raum 101"
        class="w-full rounded border border-gray-300 px-3 py-2"
      />
    </label>
    <label class="block space-y-1 text-sm font-medium text-gray-700">
      <span>Übergeordneter Standort (optional)</span>
      <select
        aria-label="Übergeordneter Standort"
        bind:value={parentId}
        class="w-full rounded border border-gray-300 px-3 py-2"
      >
        <option value="">Kein übergeordneter Standort</option>
        {#if currentParentMissing}
          <option value={parentId}>Bisherige Zuordnung: {currentParentName} ({parentId})</option>
        {/if}
        {#each parentOptions as parent (parent.id)}
          <option value={parent.id}>
            {'　'.repeat(parent.depth)}{parent.name} ({parent.id})
          </option>
        {/each}
      </select>
    </label>
  </div>

  <label class="block space-y-1 text-sm font-medium text-gray-700">
    <span>Standortart</span>
    <select
      aria-label="Koordinatenart"
      value={art}
      onchange={changeArt}
      class="w-full rounded border border-gray-300 px-3 py-2"
    >
      <option value="punkt">Punkt</option>
      <option value="raum">Raum</option>
      <option value="leitung">Leitung</option>
    </select>
  </label>

  <fieldset class="space-y-3">
    <legend class="text-sm font-medium text-gray-700">
      {art === 'punkt' ? 'Koordinaten des Punkts' : art === 'raum' ? 'Eckpunkte des Raums' : 'Wegpunkte der Leitung'}
    </legend>
    {#each coordinates as coordinate, index}
      <div class="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label class="block space-y-1 text-xs text-gray-600">
          <span>Breitengrad {index + 1}</span>
          <input
            type="number"
            step="any"
            value={coordinate.lat}
            oninput={(event) => updateCoordinate(index, 'lat', event.currentTarget.value)}
            aria-label="Breitengrad {index + 1}"
            class="w-full rounded border border-gray-300 px-2 py-2 text-sm"
          />
        </label>
        <label class="block space-y-1 text-xs text-gray-600">
          <span>Längengrad {index + 1}</span>
          <input
            type="number"
            step="any"
            value={coordinate.lon}
            oninput={(event) => updateCoordinate(index, 'lon', event.currentTarget.value)}
            aria-label="Längengrad {index + 1}"
            class="w-full rounded border border-gray-300 px-2 py-2 text-sm"
          />
        </label>
        {#if art !== 'punkt' && !disabled}
          <button
            type="button"
            onclick={() => removeCoordinate(index)}
            class="rounded px-2 py-2 text-sm text-red-700 hover:bg-red-50"
            aria-label="Koordinate {index + 1} entfernen"
          >
            Entfernen
          </button>
        {/if}
      </div>
      <button
        type="button"
        aria-label="Koordinate {index + 1} auf Karte wählen"
        aria-expanded={activeMapCoordinateIndex === index}
        onclick={() => activeMapCoordinateIndex = activeMapCoordinateIndex === index ? null : index}
        class="text-left text-sm text-blue-700 hover:underline"
      >
        {activeMapCoordinateIndex === index ? 'Karte schließen' : 'Position auf Karte wählen'}
      </button>
      {#if activeMapCoordinateIndex === index}
        <CoordinatePicker coordinate={coordinateForMap(index)} onSelect={applyMapCoordinate} />
      {/if}
    {/each}
    {#if art !== 'punkt' && !disabled}
      <button
        type="button"
        onclick={addCoordinate}
        class="text-sm text-blue-700 hover:underline"
      >
        + Koordinate hinzufügen
      </button>
    {/if}
  </fieldset>

  {#if !disabled}
    <div class="space-y-2">
      <button
        type="button"
        onclick={useCurrentPosition}
        disabled={isLocating}
        class="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLocating ? 'Standort wird ermittelt …' : 'Aktuellen Standort verwenden'}
      </button>
      {#if gpsMessage}
        <p class="text-sm text-gray-700" role="status" aria-live="polite">{gpsMessage}</p>
      {/if}
    </div>
  {/if}

  {#if validationMessage}
    <p class="text-sm text-red-700" role="alert">{validationMessage}</p>
  {/if}

  {#if !disabled}
    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={cancel}
        class="rounded bg-gray-400 px-4 py-2 text-sm text-white hover:bg-gray-500"
      >
        Abbrechen
      </button>
      <button
        type="submit"
        class="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
      >
        Speichern
      </button>
    </div>
  {/if}
  </fieldset>
</form>
{/if}
