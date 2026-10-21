<script lang="ts">
  import { onMount } from 'svelte';
  import type { Location } from '$lib/parser/types';
  import type { Map as LeafletMap, LayerGroup } from 'leaflet';
  import { getLocationCenter, getLocationShape } from './location-shapes';
  import { getLastMapView, saveLastMapView } from './map-view';
  import 'leaflet/dist/leaflet.css';

  type Props = {
    locations?: Location[];
    assetLabels?: Record<string, string[]>;
    selectedId?: string | null;
    onLocationSelect?: ((id: string) => void) | null;
  };

  let {
    locations = [],
    assetLabels = {},
    selectedId = null,
    onLocationSelect = null
  }: Props = $props();
  let container: HTMLDivElement;
  let map = $state<LeafletMap | null>(null);
  let overlays: LayerGroup | null = null;
  let leaflet: typeof import('leaflet') | null = null;
  let restoredLastView = false;

  onMount(() => {
    let disposed = false;
    void import('leaflet').then((module) => {
      if (disposed) return;
      const L = (module as unknown as { default: typeof import('leaflet') }).default;
      leaflet = L;
      const lastView = getLastMapView();
      restoredLastView = lastView !== null;
      const initialCenter: [number, number] = lastView
        ? [lastView.center.lat, lastView.center.lon]
        : [0, 0];
      const currentMap = L.map(container).setView(initialCenter, lastView?.zoom ?? 2);
      currentMap.on('moveend', () => {
        const center = currentMap.getCenter();
        saveLastMapView({
          center: { lat: center.lat, lon: center.lng },
          zoom: currentMap.getZoom()
        });
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        crossOrigin: 'anonymous',
        attribution: '© OpenStreetMap contributors'
      }).addTo(currentMap);
      overlays = L.layerGroup().addTo(currentMap);
      map = currentMap;
    });

    return () => {
      disposed = true;
      map?.remove();
      map = null;
      overlays = null;
    };
  });

  $effect(() => {
    const currentMap = map;
    const currentOverlays = overlays;
    const currentLocations = locations;
    const currentAssetLabels = assetLabels;
    const currentSelectedId = selectedId;
    const L = leaflet;
    if (!currentMap || !currentOverlays || !L) return;

    currentOverlays.clearLayers();
    const bounds: [number, number][] = [];
    for (const location of currentLocations) {
      const shape = getLocationShape(location);
      if (!shape) continue;

      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = location.name ?? location.id ?? 'Standort';
      popup.append(title);
      for (const assetLabel of currentAssetLabels[location.id ?? ''] ?? []) {
        const item = document.createElement('div');
        item.textContent = assetLabel;
        popup.append(item);
      }
      bounds.push(...shape.points.map(({ lat, lon }) => [lat, lon] as [number, number]));
      const selected = () => {
        if (location.id) onLocationSelect?.(location.id);
      };

      if (shape.kind === 'polygon') {
        L.polygon(shape.points.map(({ lat, lon }) => [lat, lon] as [number, number]), {
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
          weight: 2
        }).bindPopup(popup).on('click', selected).addTo(currentOverlays);
      } else if (shape.kind === 'route') {
        L.polyline(shape.points.map(({ lat, lon }) => [lat, lon] as [number, number]), {
          color: '#d97706',
          weight: 4
        }).bindPopup(popup).on('click', selected).addTo(currentOverlays);
      } else {
        const point = shape.points[0];
        L.circleMarker([point.lat, point.lon], {
          radius: 7,
          color: '#1d4ed8',
          fillColor: '#3b82f6',
          fillOpacity: 0.9
        }).bindPopup(popup).on('click', selected).addTo(currentOverlays);
      }
    }

    if (currentSelectedId) {
      const location = currentLocations.find((item) => item.id === currentSelectedId);
      const center = location ? getLocationCenter(location) : null;
      if (center) currentMap.setView([center.lat, center.lon], 17);
    } else if (bounds.length > 0 && !restoredLastView) {
      currentMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    }
  });
</script>

<div
  bind:this={container}
  class="w-full h-[28rem] rounded-lg border border-gray-200 bg-slate-100"
  role="region"
  aria-label="Kartenansicht"
></div>

<p class="mt-2 text-xs text-gray-500">
  Kartendaten: © OpenStreetMap contributors. Aufgerufene Kartenausschnitte werden lokal zwischengespeichert;
  Standortdaten und Umrisse bleiben auch ohne Netzwerk verfügbar.
</p>

<style>
  :global(.leaflet-container) {
    width: 100%;
    background: #e8edf0;
  }
</style>
