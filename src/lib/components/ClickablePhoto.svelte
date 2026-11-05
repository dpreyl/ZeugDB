<script lang="ts">
  import { onDestroy } from 'svelte';

  type Props = {
    path: string;
    src: string;
    alt: string;
    imageClass: string;
    onOpen?: (path: string) => Promise<{ data: Uint8Array; mimeType: string }>;
  };

  let { path, src, alt, imageClass, onOpen }: Props = $props();
  let isOpen = $state(false);
  let imageUrl = $state<string | null>(null);
  let loading = $state(false);
  let error = $state('');
  let requestId = 0;

  async function openPhoto() {
    if (!onOpen) return;
    isOpen = true;
    loading = true;
    error = '';
    clearImageUrl();
    const currentRequest = ++requestId;
    try {
      const { data, mimeType } = await onOpen(path);
      if (currentRequest !== requestId) return;
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      imageUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    } catch (cause) {
      if (currentRequest === requestId) {
        error = cause instanceof Error ? cause.message : 'Foto konnte nicht geöffnet werden';
      }
    } finally {
      if (currentRequest === requestId) loading = false;
    }
  }

  function closePhoto() {
    requestId += 1;
    isOpen = false;
    loading = false;
    error = '';
    clearImageUrl();
  }

  function clearImageUrl() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
  }

  onDestroy(clearImageUrl);
</script>

<svelte:window onkeydown={(event) => {
  if (isOpen && event.key === 'Escape') closePhoto();
}} />

{#if onOpen}
  <button
    type="button"
    onclick={() => void openPhoto()}
    aria-label="Bild vergrößern: {alt}"
    class="block w-full cursor-zoom-in text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <img src={src} {alt} class={imageClass} />
  </button>
{:else}
  <img src={src} {alt} class={imageClass} />
{/if}

{#if isOpen}
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
    {#if loading}
      <p class="text-white" role="status">Foto wird geladen…</p>
    {:else if error}
      <p class="rounded bg-red-900/80 p-4 text-white" role="alert">{error}</p>
    {:else if imageUrl}
      <img src={imageUrl} alt="Foto in voller Größe" class="max-h-full max-w-full object-contain" />
    {/if}
  </div>
{/if}
