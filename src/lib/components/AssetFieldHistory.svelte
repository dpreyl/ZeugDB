<script lang="ts">
  import { getGitRepo } from '$lib/services/git.service';
  import { getAssetFieldHistory, type FieldHistoryEntry } from '$lib/services/git-history';

  type Props = {
    assetId: string;
    fields: string[];
  };

  let { assetId, fields }: Props = $props();
  let open = $state(false);
  let field = $state('');
  let entries = $state<FieldHistoryEntry[]>([]);
  let loading = $state(false);
  let loaded = $state(false);
  let error = $state('');

  async function loadHistory() {
    if (!field || loading) return;
    loading = true;
    loaded = false;
    error = '';
    try {
      entries = await getAssetFieldHistory(await getGitRepo(), assetId, field);
      loaded = true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Feldverlauf konnte nicht gelesen werden.';
    } finally {
      loading = false;
    }
  }
</script>

<section class="rounded-lg border border-gray-200 bg-white p-4">
  <button
    type="button"
    aria-expanded={open}
    onclick={() => open = !open}
    class="text-sm font-medium text-blue-700 underline"
  >
    Feldhistorie anzeigen
  </button>
  {#if open}
    <p class="mt-2 text-xs text-gray-500">
      Wird bei Bedarf aus dem lokalen Git-Verlauf geladen. Nach einem Sync bleiben die einzelnen
      Geräte-Commits nur auf diesem Gerät verfügbar.
    </p>
    <div class="mt-3 flex flex-col gap-2 sm:flex-row">
      <label class="flex-1 text-sm font-medium text-gray-700">
        Feld
        <select
          aria-label="Feld"
          bind:value={field}
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Feld auswählen</option>
          {#each fields as item (item)}
            <option value={item}>{item}</option>
          {/each}
        </select>
      </label>
      <button
        type="button"
        onclick={loadHistory}
        disabled={!field || loading}
        class="self-end rounded-md border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        {loading ? 'Lädt…' : 'Verlauf laden'}
      </button>
    </div>

    {#if error}
      <p role="alert" class="mt-3 text-sm text-red-700">{error}</p>
    {:else if loaded && entries.length === 0}
      <p class="mt-3 text-sm text-gray-600">Für dieses Feld wurden keine lokalen Änderungen gefunden.</p>
    {:else if loaded}
      <ol class="mt-3 space-y-3">
        {#each entries as entry (entry.commit)}
          <li class="rounded border border-gray-200 p-3 text-sm">
            <p class="font-medium text-gray-900">{entry.author} <span class="font-normal text-gray-500">({entry.email})</span></p>
            <p class="mt-1 text-xs text-gray-500">{new Date(entry.timestamp * 1000).toLocaleString()}</p>
            <p class="mt-1 text-gray-700">{entry.message}</p>
            <p class="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              <span class="break-words text-red-800">Vorher: {entry.before ?? '—'}</span>
              <span class="break-words text-green-800">Nachher: {entry.after ?? '—'}</span>
            </p>
            <code class="mt-2 block break-all text-xs text-gray-400">{entry.commit}</code>
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
</section>
