<script lang="ts">
  import { untrack } from 'svelte';
  import type { Location, LocationArt } from '$lib/parser/types';
  import {
    coordinatesForLocation,
    getCurrentPosition,
    locationCoordinateFields,
    validateCoordinates,
    withCurrentPosition,
    type CoordinateInput
  } from './location-form.helpers';

  type Props = {
    location?: Location;
    onSave: (location: Location) => void;
    onCancel: () => void;
  };

  let { location, onSave, onCancel }: Props = $props();
  const initialLocation = untrack(() => location);
  const initialArt: LocationArt = initialLocation?.art
    ?? (initialLocation?.polygon ? 'raum' : initialLocation?.route ? 'leitung' : 'punkt');
  let art = $state(initialArt);
  let id = $state(initialLocation?.id ?? '');
  let name = $state(initialLocation?.name ?? '');
  let parentId = $state(initialLocation?.eltern ?? '');
  let coordinates = $state(coordinatesForLocation(initialLocation, initialArt));
  let validationMessage = $state('');
  let gpsMessage = $state('');
  let isLocating = $state(false);

  function changeArt(event: Event) {
    art = (event.currentTarget as HTMLSelectElement).value as LocationArt;
    coordinates = coordinatesForLocation(undefined, art);
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
    if (!id.trim() || !name.trim()) {
      validationMessage = 'Gib eine ID und einen Namen für den Standort ein.';
      return;
    }

    const coordinatesError = validateCoordinates(art, coordinates);
    if (coordinatesError) {
      validationMessage = coordinatesError;
      return;
    }

    onSave({
      ...location,
      id: id.trim(),
      name: name.trim(),
      eltern: parentId.trim() || undefined,
      art,
      ...locationCoordinateFields(art, coordinates)
    });
  }
</script>

<form onsubmit={saveLocation} class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
  <div class="space-y-3">
    <label class="block space-y-1 text-sm font-medium text-gray-700">
      <span>ID</span>
      <input
        bind:value={id}
        required
        disabled={Boolean(initialLocation?.id)}
        autocomplete="off"
        placeholder="z. B. raum-101"
        class="w-full rounded border border-gray-300 px-3 py-2"
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
      <span>Eltern-ID (optional)</span>
      <input
        bind:value={parentId}
        autocomplete="off"
        placeholder="ID des übergeordneten Standorts"
        class="w-full rounded border border-gray-300 px-3 py-2"
      />
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
        {#if art !== 'punkt'}
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
    {/each}
    {#if art !== 'punkt'}
      <button
        type="button"
        onclick={addCoordinate}
        class="text-sm text-blue-700 hover:underline"
      >
        + Koordinate hinzufügen
      </button>
    {/if}
  </fieldset>

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

  {#if validationMessage}
    <p class="text-sm text-red-700" role="alert">{validationMessage}</p>
  {/if}

  <div class="flex justify-end gap-2">
    <button
      type="button"
      onclick={onCancel}
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
</form>
