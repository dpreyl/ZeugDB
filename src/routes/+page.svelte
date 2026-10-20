<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900">Assets</h2>
      <p class="text-sm text-gray-500">{data.assets.length} Einträge</p>
    </div>
    <a href="{base}/assets/new" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block">
      + Neues Asset
    </a>
  </div>

  <div class="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="px-4 py-2 text-left font-medium text-gray-600">ID</th>
          <th class="px-4 py-2 text-left font-medium text-gray-600">Typ</th>
          <th class="px-4 py-2 text-left font-medium text-gray-600">Standort</th>
          <th class="px-4 py-2 text-left font-medium text-gray-600">Geändert</th>
          <th class="px-4 py-2 text-right font-medium text-gray-600">Aktion</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        {#each data.assets as asset (asset.id)}
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-2 font-mono text-xs text-gray-500">{asset.id}</td>
          <td class="px-4 py-2 capitalize">{asset.type}</td>
          <td class="px-4 py-2 text-gray-600">{asset.location}</td>
          <td class="px-4 py-2 text-gray-500">{asset.geaendert}</td>
          <td class="px-4 py-2 text-right">
            <a href="{base}/assets/{asset.id}" class="text-blue-600 hover:underline">Öffnen</a>
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
