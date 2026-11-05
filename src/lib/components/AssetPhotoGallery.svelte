<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { PhotoRole } from './asset-photo.helpers';

  type Props = {
    fotos: string[];
    fotoUrls: Record<string, string>;
    fotoRollenzuordnung: { typenschild: string; uebersicht: string };
    editable: boolean;
    uploading: boolean;
    error: string;
    onFotoUpload: (event: Event, role: PhotoRole) => void | Promise<void>;
    onFotoDelete: (index: number) => void | Promise<void>;
    onFotoOpen: (path: string) => Promise<{ data: Uint8Array; mimeType: string }>;
  };

  let {
    fotos,
    fotoUrls,
    fotoRollenzuordnung,
    editable,
    uploading,
    error,
    onFotoUpload,
    onFotoDelete,
    onFotoOpen
  }: Props = $props();

  let selectedPhoto = $state<string | null>(null);
  let detailPhotoUrl = $state<string | null>(null);
  let photoLoading = $state(false);
  let photoError = $state('');
  let openRequest = 0;

  async function openPhoto(path: string) {
    selectedPhoto = path;
    photoLoading = true;
    photoError = '';
    clearDetailPhotoUrl();
    const request = ++openRequest;
    try {
      const { data, mimeType } = await onFotoOpen(path);
      if (request !== openRequest) return;
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      detailPhotoUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    } catch (error) {
      if (request === openRequest) {
        photoError = error instanceof Error ? error.message : 'Foto konnte nicht geöffnet werden';
      }
    } finally {
      if (request === openRequest) photoLoading = false;
    }
  }

  function closePhoto() {
    openRequest += 1;
    selectedPhoto = null;
    photoLoading = false;
    photoError = '';
    clearDetailPhotoUrl();
  }

  function clearDetailPhotoUrl() {
    if (detailPhotoUrl) URL.revokeObjectURL(detailPhotoUrl);
    detailPhotoUrl = null;
  }

  onDestroy(clearDetailPhotoUrl);
</script>

<svelte:window onkeydown={(event) => {
  if (selectedPhoto && event.key === 'Escape') closePhoto();
}} />

<div class="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
  <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">Gerätefotos</h3>
  <p class="text-sm text-gray-600">
    Für die Geräteprüfung ein lesbares Foto des Typenschilds und ein Übersichtsbild zuordnen.
    Die Bilder werden im Git-LFS-Repository gespeichert.
  </p>

  {#if error}
    <div class="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800" role="alert">
      {error}
    </div>
  {/if}

  {#if editable}
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm font-medium text-gray-700">
        Typenschild
        <span class="mt-1 block text-xs font-normal text-gray-500">
          {fotoRollenzuordnung.typenschild ? 'Bild zugeordnet' : 'Noch kein Bild zugeordnet'}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          capture="environment"
          disabled={uploading}
          onchange={(event) => onFotoUpload(event, 'typenschild')}
          aria-label="Typenschild-Foto hochladen"
          class="mt-2 block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </label>
      <label class="block text-sm font-medium text-gray-700">
        Übersichtsbild
        <span class="mt-1 block text-xs font-normal text-gray-500">
          {fotoRollenzuordnung.uebersicht ? 'Bild zugeordnet' : 'Noch kein Bild zugeordnet'}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          capture="environment"
          disabled={uploading}
          onchange={(event) => onFotoUpload(event, 'uebersicht')}
          aria-label="Übersichtsbild hochladen"
          class="mt-2 block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </label>
    </div>
    <div class="flex items-center gap-3">
      {#if uploading}
        <span class="text-sm text-gray-500 animate-pulse" role="status">Foto wird gespeichert…</span>
      {/if}
    </div>
  {:else}
    <p class="text-sm text-gray-500">Zum Hinzufügen oder Löschen von Fotos den Schreibmodus aktivieren.</p>
  {/if}

  {#if fotos.length > 0}
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {#each fotos as pfad, index}
        <div class="relative group rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
          {#if fotoUrls[pfad]}
            <button
              type="button"
              onclick={() => void openPhoto(pfad)}
              aria-label="Foto {index + 1} vergrößern"
              class="block w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <img
                src={fotoUrls[pfad]}
                alt={fotoRollenzuordnung.typenschild === pfad ? 'Typenschild-Foto' : fotoRollenzuordnung.uebersicht === pfad ? 'Übersichtsbild' : `Zusatzfoto ${index + 1}`}
                class="h-28 w-full object-contain p-1"
              />
            </button>
          {:else}
            <div class="flex items-center justify-center h-28 text-xs text-gray-400 p-2">
              {pfad.split('/').pop()}
            </div>
          {/if}
          {#if editable}
            <button
              type="button"
              onclick={() => onFotoDelete(index)}
              class="absolute top-1 right-1 p-1 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 text-xs"
              title="Foto löschen"
              aria-label="Foto {index + 1} löschen"
            >
              ✕
            </button>
          {/if}
          <span class="pointer-events-none absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] bg-gray-800 bg-opacity-70 text-white rounded truncate max-w-[80%]">
            {fotoRollenzuordnung.typenschild === pfad
              ? 'Typenschild'
              : fotoRollenzuordnung.uebersicht === pfad
                ? 'Übersichtsbild'
                : pfad.split('/').pop()}
          </span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-gray-400 italic">Noch keine Fotos hochgeladen.</p>
  {/if}
</div>

{#if selectedPhoto}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Foto ansehen"
    tabindex="-1"
  >
    <button
      type="button"
      onclick={closePhoto}
      aria-label="Foto schließen"
      class="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-2 text-2xl text-white hover:bg-white/30"
    >
      ×
    </button>
    {#if photoLoading}
      <p class="text-white" role="status">Foto wird geladen…</p>
    {:else if photoError}
      <p class="rounded bg-red-900/80 p-4 text-white" role="alert">{photoError}</p>
    {:else if detailPhotoUrl}
      <img
        src={detailPhotoUrl}
        alt="Foto in voller Größe"
        class="max-h-full max-w-full object-contain"
      />
    {/if}
  </div>
{/if}
