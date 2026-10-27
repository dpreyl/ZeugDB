<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import ColumnFilter from '$lib/components/ColumnFilter.svelte';
  import LocationFilter from '$lib/components/LocationFilter.svelte';
  import {
    filterAssetRows,
    getAssetFilterOptions,
    getLocationDisplayName,
    getLocationFilterOptions,
    searchAssetRows,
    type AssetOverviewField,
    type AssetOverviewFilters
  } from '$lib/components/asset-overview.helpers';
  import { loadAssetOverviewState, saveAssetOverviewState } from '$lib/components/asset-overview-state';
  import { getEditMode } from '$lib/stores/edit-mode.svelte';
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { getTypesStore } from '$lib/stores/types.store.svelte';

  const assetStore = getAssetStore();
  const locationsStore = getLocationsStore();
  const typesStore = getTypesStore();
  const editMode = getEditMode();
  let filters = $state<AssetOverviewFilters>({});
  let searchQuery = $state('');

  onMount(() => {
    const savedState = loadAssetOverviewState();
    filters = savedState.filters;
    searchQuery = savedState.searchQuery;
  });

  const assets = $derived.by(() => {
    assetStore.fieldsVersion;
    return assetStore.all.map(asset => ({
      id: asset.id,
      bezeichnung: assetStore.getField(asset.id, 'bezeichnung')?.trim() || 'Ohne Bezeichnung',
      typ: asset.type,
      standort: asset.location || '—',
      standortName: getLocationDisplayName(asset.location || '—', locationsStore.all),
      suchtext: [
        asset.id,
        typesStore.all.find(type => type.id === asset.type)?.name ?? '',
        ...Object.values(assetStore.getFields(asset.id)),
        ...Object.values(assetStore.getBlocks(asset.id))
          .flatMap(instances => Object.values(instances).flatMap(fields => Object.values(fields)))
      ].join(' '),
      geaendert: asset.geaendert?.slice(0, 10) || '—'
    }));
  });
  const visibleAssets = $derived(filterAssetRows(searchAssetRows(assets, searchQuery), filters));

  function setFilter(field: AssetOverviewField, selected: string[] | null) {
    filters = { ...filters, [field]: selected };
    saveAssetOverviewState({ filters, searchQuery });
  }

  function setSearchQuery(query: string) {
    searchQuery = query;
    saveAssetOverviewState({ filters, searchQuery });
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold text-gray-900">Assets</h2>
      <p class="text-sm text-gray-500">
        {visibleAssets.length === assets.length
          ? `${assets.length} Einträge`
          : `${visibleAssets.length} von ${assets.length} Einträgen`}
      </p>
    </div>
    {#if editMode.isEditing}
      <a href="{base}/assets/new" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block">
        + Neues Asset
      </a>
    {/if}
  </div>

  <label class="block max-w-lg">
    <span class="sr-only">Assets suchen</span>
    <input
      type="search"
      aria-label="Assets suchen"
      value={searchQuery}
      oninput={(event) => setSearchQuery(event.currentTarget.value)}
      placeholder="Bezeichnung, Seriennummer, Hersteller, Modell …"
      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
    />
  </label>

  <div class="bg-white rounded-lg shadow border border-gray-200">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="px-4 py-2 text-left font-medium text-gray-600">
            Bezeichnung
            <ColumnFilter
              label="Bezeichnung"
              options={getAssetFilterOptions(assets, 'bezeichnung')}
              selected={filters.bezeichnung ?? null}
              onChange={(selected) => setFilter('bezeichnung', selected)}
            />
          </th>
          <th class="px-4 py-2 text-left font-medium text-gray-600">
            Typ
            <ColumnFilter
              label="Typ"
              options={getAssetFilterOptions(assets, 'typ')}
              selected={filters.typ ?? null}
              onChange={(selected) => setFilter('typ', selected)}
            />
          </th>
          <th class="px-4 py-2 text-left font-medium text-gray-600">
            Standort
            <LocationFilter
              options={getLocationFilterOptions(locationsStore.all, assets)}
              selected={filters.standort ?? null}
              onChange={(selected) => setFilter('standort', selected)}
            />
          </th>
          <th class="px-4 py-2 text-left font-medium text-gray-600">
            Geändert
            <ColumnFilter
              label="Geändert"
              options={getAssetFilterOptions(assets, 'geaendert')}
              selected={filters.geaendert ?? null}
              onChange={(selected) => setFilter('geaendert', selected)}
            />
          </th>
          <th class="px-4 py-2 text-right font-medium text-gray-600">Aktion</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        {#if visibleAssets.length === 0}
          <tr>
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500">
              {assets.length === 0 ? 'Noch keine Assets vorhanden.' : 'Keine Assets entsprechen den Filtern.'}
            </td>
          </tr>
        {:else}
          {#each visibleAssets as asset (asset.id)}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-2 font-medium text-gray-900">
                <a href="{base}/assets/{asset.id}" class="text-blue-700 hover:underline">{asset.bezeichnung}</a>
                {#if asset.bezeichnung === 'Ohne Bezeichnung'}
                  <span class="block font-mono text-xs font-normal text-gray-400">{asset.id}</span>
                {/if}
              </td>
              <td class="px-4 py-2 capitalize">{asset.typ}</td>
              <td class="px-4 py-2 text-gray-600">{asset.standortName}</td>
              <td class="px-4 py-2 text-gray-500">{asset.geaendert}</td>
              <td class="px-4 py-2 text-right">
                <a href="{base}/assets/{asset.id}" class="text-blue-600 hover:underline">Öffnen</a>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
