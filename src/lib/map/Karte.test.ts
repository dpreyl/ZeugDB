import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import type { Location } from '$lib/parser/types';

const mocks = vi.hoisted(() => {
  const overlay = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis()
  };
  const overlays = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn()
  };
  const map = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    on: vi.fn().mockReturnThis(),
    getCenter: vi.fn(() => ({ lat: 52.52, lng: 13.405 })),
    getZoom: vi.fn(() => 14),
    remove: vi.fn()
  };
  map.setView.mockReturnValue(map);
  const leaflet = {
    map: vi.fn(() => map),
    tileLayer: vi.fn(() => overlay),
    layerGroup: vi.fn(() => overlays),
    polygon: vi.fn(() => overlay),
    polyline: vi.fn(() => overlay),
    circleMarker: vi.fn(() => overlay)
  };
  return { overlay, overlays, map, leaflet };
});

vi.mock('leaflet', () => ({ default: mocks.leaflet }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import Karte from './Karte.svelte';

describe('Karte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => cleanup());

  it('rendert einen benannten Kartenbereich und initialisiert Leaflet', async () => {
    const { getByRole } = render(Karte, { props: { locations: [] } });
    expect(getByRole('region', { name: 'Kartenansicht' })).toBeTruthy();
    await waitFor(() => expect(mocks.leaflet.map).toHaveBeenCalledOnce());
    expect(mocks.map.setView).toHaveBeenCalledWith([0, 0], 2);
    expect(mocks.leaflet.tileLayer).toHaveBeenCalledWith(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ maxZoom: 19 })
    );
  });

  it('öffnet beim nächsten Aufruf mit dem zuletzt gespeicherten Kartenausschnitt', async () => {
    localStorage.setItem('zeugdb.map-view.v1', JSON.stringify({
      center: { lat: 52.52, lon: 13.405 },
      zoom: 14
    }));
    render(Karte, {
      props: {
        locations: [{ id: 'point', lat: 48.1, lon: 11.5 }]
      }
    });

    await waitFor(() => expect(mocks.map.setView).toHaveBeenCalledWith([52.52, 13.405], 14));

    expect(mocks.map.fitBounds).not.toHaveBeenCalled();
  });

  it('speichert die Kartenansicht nach einer Nutzerbewegung', async () => {
    render(Karte, { props: { locations: [] } });
    await waitFor(() => expect(mocks.map.on).toHaveBeenCalledWith(
      'moveend',
      expect.any(Function)
    ));

    const saveView = mocks.map.on.mock.calls.find(([event]) => event === 'moveend')?.[1];
    saveView?.();

    expect(JSON.parse(localStorage.getItem('zeugdb.map-view.v1') ?? 'null')).toEqual({
      center: { lat: 52.52, lon: 13.405 },
      zoom: 14
    });
  });

  it('zeichnet Punkt-, Raum- und Leitungsstandorte', async () => {
    const locations: Location[] = [
      { id: 'point', lat: 48.1, lon: 11.5 },
      { id: 'room', polygon: [{ lat: 48, lon: 11 }, { lat: 48.1, lon: 11 }, { lat: 48.1, lon: 11.1 }] },
      { id: 'cable', route: [{ lat: 48, lon: 11 }, { lat: 48.1, lon: 11.1 }] }
    ];
    render(Karte, { props: { locations } });
    await waitFor(() => expect(mocks.leaflet.circleMarker).toHaveBeenCalled());
    expect(mocks.leaflet.polygon).toHaveBeenCalledOnce();
    expect(mocks.leaflet.polyline).toHaveBeenCalledOnce();
    expect(mocks.map.fitBounds).toHaveBeenCalled();
  });

  it('zeigt verknüpfte Assets im Popup und wählt den Standort aus', async () => {
    const onLocationSelect = vi.fn();
    render(Karte, {
      props: {
        locations: [{ id: 'point', name: 'Raum 101', lat: 48.1, lon: 11.5 }],
        assetLabels: { point: ['Projektor (asset-1)'] },
        onLocationSelect
      }
    });
    await waitFor(() => expect(mocks.leaflet.circleMarker).toHaveBeenCalled());
    const popup = mocks.overlay.bindPopup.mock.calls.at(-1)?.[0] as HTMLElement;
    expect(popup.textContent).toContain('Raum 101');
    expect(popup.textContent).toContain('Projektor (asset-1)');
    const clickHandler = mocks.overlay.on.mock.calls.at(-1)?.[1] as () => void;
    clickHandler();
    expect(onLocationSelect).toHaveBeenCalledWith('point');
  });
});
