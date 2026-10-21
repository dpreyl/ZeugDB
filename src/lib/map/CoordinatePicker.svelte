<script lang="ts">
  import { onMount } from 'svelte';
  import type { Coord } from '$lib/parser/types';
  import type { Map as LeafletMap } from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  type Props = {
    coordinate: Coord | null;
    onSelect: (coordinate: Coord) => void;
  };

  const DEFAULT_CENTER: Coord = { lat: 48.1351, lon: 11.582 };
  let { coordinate, onSelect }: Props = $props();
  let container: HTMLDivElement;
  let map: LeafletMap | null = null;
  let isReady = $state(false);
  let mapCenter = $state<Coord>(DEFAULT_CENTER);

  function updateCenter() {
    const center = map?.getCenter();
    if (center) mapCenter = { lat: center.lat, lon: center.lng };
  }

  function selectCenter() {
    onSelect({ ...mapCenter });
  }

  onMount(() => {
    let disposed = false;
    void import('leaflet').then((module) => {
      if (disposed) return;
      const L = (module as unknown as { default: typeof import('leaflet') }).default;
      const start = coordinate ?? DEFAULT_CENTER;
      mapCenter = start;
      map = L.map(container).setView(
        [start.lat, start.lon],
        coordinate ? 17 : 13
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        crossOrigin: 'anonymous',
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      map.on('moveend', updateCenter);
      updateCenter();
      isReady = true;
    });

    return () => {
      disposed = true;
      map?.remove();
      map = null;
      isReady = false;
    };
  });
</script>

<section class="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
  <div class="relative overflow-hidden rounded-md">
    <div
      bind:this={container}
      class="h-72 w-full bg-slate-100"
      role="region"
      aria-label="Karte zur Koordinatenauswahl"
    ></div>
    <div
      class="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full"
      aria-hidden="true"
    >
      <svg
        class="h-10 w-8 drop-shadow-md"
        viewBox="0 0 32 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 40C13.2 35.7 3 24.2 3 15.5C3 8.3 8.8 2.5 16 2.5S29 8.3 29 15.5C29 24.2 18.8 35.7 16 40Z"
          fill="#dc2626"
          stroke="white"
          stroke-width="2"
        />
        <circle cx="16" cy="15.5" r="4.5" fill="white" />
      </svg>
    </div>
  </div>
  <p class="text-sm text-gray-700">
    Verschiebe die Karte mit dem Finger, bis das Ziel unter der roten Nadel liegt. Mit +/− kannst du
    den Ausschnitt vergrößern oder verkleinern.
  </p>
  <p class="text-xs tabular-nums text-gray-600">
    Kartenmitte: <output>{mapCenter.lat.toFixed(6)}, {mapCenter.lon.toFixed(6)}</output>
  </p>
  <button
    type="button"
    onclick={selectCenter}
    disabled={!isReady}
    class="w-full rounded bg-blue-700 px-3 py-2 font-medium text-white hover:bg-blue-800 disabled:bg-gray-400"
  >
    Position übernehmen
  </button>
</section>
