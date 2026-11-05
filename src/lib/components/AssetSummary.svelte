<script lang="ts">
  import { base } from '$app/paths';

  type Props = {
    designation: string;
    type: string;
    locationId: string | null;
    locationName: string;
  };

  let { designation, type, locationId, locationName }: Props = $props();
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between gap-3">
    <h3 class="font-semibold text-gray-900">Assetdetails</h3>
    <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">Nur Ansicht</span>
  </div>
  <dl class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
    <div>
      <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Bezeichnung</dt>
      <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{designation || 'Ohne Bezeichnung'}</dd>
    </div>
    <div>
      <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Typ</dt>
      <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{type}</dd>
    </div>
    <div>
      <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Standort</dt>
      <dd class="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">{locationName}</dd>
      {#if locationId}
        <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">
          Auf der Standortkarte ansehen
        </a>
      {/if}
    </div>
  </dl>
</div>
