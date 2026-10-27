import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LocationFilter from './LocationFilter.svelte';
import type { LocationFilterOption } from './asset-overview.helpers';

afterEach(cleanup);

const options: LocationFilterOption[] = [
  { id: 'house-1', label: 'Haus 1', depth: 0, values: ['room-a', 'room-b'] },
  { id: 'room-a', label: 'Raum A', depth: 1, values: ['room-a'] },
  { id: 'room-b', label: 'Raum B', depth: 1, values: ['room-b'] },
  { id: 'house-2', label: 'Haus 2', depth: 0, values: ['room-c'] },
  { id: 'room-c', label: 'Raum C', depth: 1, values: ['room-c'] }
];

describe('LocationFilter', () => {
  it('selects a parent location together with all its descendant rooms', async () => {
    const onChange = vi.fn();
    const { rerender } = render(LocationFilter, { props: { options, selected: null, onChange } });

    await fireEvent.click(screen.getByRole('button', { name: 'Filter Standort' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Auswahl leeren' }));
    await rerender({ options, selected: [], onChange });
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Haus 1' }));

    expect(onChange).toHaveBeenNthCalledWith(1, []);
    expect(onChange).toHaveBeenNthCalledWith(2, ['room-a', 'room-b']);
  });

  it('allows selecting an individual room and resetting all locations', async () => {
    const onChange = vi.fn();
    render(LocationFilter, { props: { options, selected: [], onChange } });

    await fireEvent.click(screen.getByRole('button', { name: 'Filter Standort' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Raum A' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Alle auswählen' }));

    expect(onChange).toHaveBeenNthCalledWith(1, ['room-a']);
    expect(onChange).toHaveBeenNthCalledWith(2, null);
  });
});
