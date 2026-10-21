import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';

const mocks = vi.hoisted(() => {
  const map = {
    setView: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 48.2, lng: 11.6 }))
  };
  map.setView.mockReturnValue(map);
  map.on.mockReturnValue(map);
  const layer = { addTo: vi.fn().mockReturnThis() };
  return { map, layer, leaflet: {
    map: vi.fn(() => map),
    tileLayer: vi.fn(() => layer)
  } };
});

vi.mock('leaflet', () => ({ default: mocks.leaflet }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import CoordinatePicker from './CoordinatePicker.svelte';

describe('CoordinatePicker', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('starts at the active coordinate and applies the map center', async () => {
    const onSelect = vi.fn();
    render(CoordinatePicker, {
      props: {
        coordinate: { lat: 51.5, lon: -0.12 },
        onSelect
      }
    });

    await waitFor(() => expect(mocks.leaflet.map).toHaveBeenCalledOnce());
    expect(mocks.map.setView).toHaveBeenCalledWith([51.5, -0.12], 17);
    expect(screen.getByRole('region', { name: 'Karte zur Koordinatenauswahl' })).toBeTruthy();
    expect(screen.getByText('48.200000, 11.600000')).toBeTruthy();

    mocks.map.getCenter.mockReturnValue({ lat: 49.1234567, lng: 12.7654321 });
    const moveEnd = mocks.map.on.mock.calls.find(([event]) => event === 'moveend')?.[1] as
      (() => void) | undefined;
    expect(moveEnd).toBeTypeOf('function');
    moveEnd?.();
    await waitFor(() => expect(screen.getByText('49.123457, 12.765432')).toBeTruthy());

    await fireEvent.click(screen.getByRole('button', { name: 'Position übernehmen' }));
    expect(onSelect).toHaveBeenCalledWith({ lat: 49.1234567, lon: 12.7654321 });
  });

  it('uses a useful default map center when the coordinate is empty', async () => {
    render(CoordinatePicker, { props: { coordinate: null, onSelect: vi.fn() } });

    await waitFor(() => expect(mocks.map.setView).toHaveBeenCalledWith([48.1351, 11.582], 13));
    expect(screen.getByText(/Verschiebe die Karte/)).toBeTruthy();
  });
});
