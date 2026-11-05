<script lang="ts">
  import { onMount } from 'svelte';
  import { getGitRepo } from '$lib/services/git.service';
  import { getEditBranchChanges, type EditBranchChanges } from '$lib/services/git-history';

  type Props = {
    branch: string;
    onClose: () => void;
  };

  let { branch, onClose }: Props = $props();
  let changes = $state<EditBranchChanges | null>(null);
  let loading = $state(true);
  let error = $state('');

  onMount(() => {
    void loadChanges();
  });

  async function loadChanges() {
    loading = true;
    error = '';
    try {
      changes = await getEditBranchChanges(await getGitRepo(), branch);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Änderungen konnten nicht gelesen werden.';
    } finally {
      loading = false;
    }
  }
</script>

<div
  role="dialog"
  aria-modal="true"
  aria-label="Änderungen vor dem Sync"
  class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
>
  <div class="my-8 w-full max-w-3xl rounded-lg bg-white p-5 shadow-xl">
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Änderungen vor dem Sync</h2>
        <p class="mt-1 break-all text-xs text-gray-500">Lokaler Branch: {branch}</p>
      </div>
      <button
        type="button"
        aria-label="Änderungsübersicht schließen"
        onclick={onClose}
        class="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
      >
        Schließen
      </button>
    </div>

    {#if loading}
      <p role="status" class="text-sm text-gray-600">Lokale Änderungen werden gelesen…</p>
    {:else if error}
      <p role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
    {:else if changes?.files.length}
      <p class="mb-3 text-sm text-gray-600">
        {changes.files.length} geänderte Datei{changes.files.length === 1 ? '' : 'en'} gegenüber {changes.base}.
      </p>
      <ul class="space-y-3">
        {#each changes.files as file (file.path)}
          <li class="rounded border border-gray-200 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <code class="break-all text-sm font-medium text-gray-900">{file.path}</code>
              <span class="text-xs text-gray-500">
                {file.status === 'added' ? 'Neu' : file.status === 'deleted' ? 'Gelöscht' : 'Geändert'}
              </span>
            </div>
            {#if file.fields.length}
              <ul class="mt-2 space-y-2">
                {#each file.fields as change (`${file.path}-${change.field}-${change.before}-${change.after}`)}
                  <li class="grid grid-cols-1 gap-1 border-t border-gray-100 pt-2 text-sm sm:grid-cols-[minmax(8rem,0.7fr)_1fr_1fr]">
                    <code class="break-all text-gray-700">{change.field}</code>
                    <span class="break-words text-red-800">{change.before ?? '—'}</span>
                    <span class="break-words text-green-800">{change.after ?? '—'}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="mt-2 text-xs text-gray-500">Dateiinhalt geändert</p>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        Keine offenen Änderungen.
      </p>
    {/if}
  </div>
</div>
