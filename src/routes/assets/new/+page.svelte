<script lang="ts">
  import { getAssetStore } from '$lib/stores/assets.store.svelte';
  import { getLocationsStore } from '$lib/stores/locations.store.svelte';
  import { persistStore } from '$lib/services/init';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';

  let hersteller = $state('');
  let modell = $state('');
  let seriennummer = $state('');
  let inventarnummer = $state('');
  let zustand = $state('einwandfrei');
  let notizen = $state('');
  let type = $state('projektor');
  let location = $state('');

  const locations = getLocationsStore();
  const typOptionen = ['projektor', 'hdmi-kabel', 'patchpanel', 'netzteil'];
  const zustandOptionen = ['neu', 'einwandfrei', 'defekt', 'in_reparatur', 'verschrottet'];

  function handleSave() {
    const store = getAssetStore();
    const fields: Record<string, string> = {};
    if (hersteller) fields.hersteller = hersteller;
    if (modell) fields.modell = modell;
    if (seriennummer) fields.seriennummer = seriennummer;
    if (inventarnummer) fields.inventarnummer = inventarnummer;
    if (zustand) fields.zustand = zustand;
    if (notizen) fields.notizen = notizen;

    const id = store.createAsset({
      type,
      location: location || null,
      fields
    });
    persistStore();
    goto(`${base}/assets/${id}`);
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="max-w-2xl space-y-6">
  <div class="flex items-center gap-3">
    <a href="{base}/" class="text-sm text-gray-500 hover:text-gray-700">← Zurück</a>
    <h2 class="text-xl font-semibold text-gray-900">Neues Asset</h2>
  </div>

  <div class="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
    <div>
      <label for="type" class="block text-sm font-medium text-gray-700 mb-1">Typ</label>
      <select id="type" bind:value={type} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        {#each typOptionen as opt}
          <option value={opt}>{opt}</option>
        {/each}
      </select>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="hersteller" class="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
        <input id="hersteller" type="text" bind:value={hersteller} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
      <div>
        <label for="modell" class="block text-sm font-medium text-gray-700 mb-1">Modell</label>
        <input id="modell" type="text" bind:value={modell} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="seriennummer" class="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
        <input id="seriennummer" type="text" bind:value={seriennummer} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
      <div>
        <label for="inventarnummer" class="block text-sm font-medium text-gray-700 mb-1">Inventarnummer</label>
        <input id="inventarnummer" type="text" bind:value={inventarnummer} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="zustand" class="block text-sm font-medium text-gray-700 mb-1">Zustand</label>
        <select id="zustand" bind:value={zustand} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          {#each zustandOptionen as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="location" class="block text-sm font-medium text-gray-700 mb-1">Standort</label>
        <select id="location" bind:value={location} class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">Kein Standort</option>
          {#each locations.all as item}
            <option value={item.id}>{item.name ?? item.id}</option>
          {/each}
        </select>
        <a href="{base}/locations" class="mt-1 inline-block text-xs text-blue-600 hover:underline">Standort mit GPS-Koordinaten anlegen oder auf der Karte anzeigen</a>
      </div>
    </div>

    <div>
      <label for="notizen" class="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
      <textarea id="notizen" bind:value={notizen} rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
    </div>

    <div class="flex gap-3 pt-2">
      <button type="submit" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
        Erzeugen
      </button>
      <button type="button" onclick={() => goto(`${base}/`)} class="px-4 py-2 text-gray-600 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
        Abbrechen
      </button>
    </div>
  </div>
</form>