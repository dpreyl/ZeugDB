import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ColumnFilter from './ColumnFilter.svelte';

afterEach(cleanup);

describe('ColumnFilter', () => {
  it('lets users include or exclude existing values in a column', async () => {
    const onChange = vi.fn();
    const { rerender } = render(ColumnFilter, {
      props: { label: 'Typ', options: ['hdmi-kabel', 'projektor'], selected: null, onChange }
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Filter Typ' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'hdmi-kabel' }));
    await rerender({
      label: 'Typ',
      options: ['hdmi-kabel', 'projektor'],
      selected: ['projektor'],
      onChange
    });

    expect(onChange).toHaveBeenCalledWith(['projektor']);
    expect((screen.getByRole('checkbox', { name: 'hdmi-kabel' }) as HTMLInputElement).checked).toBe(false);
  });

  it('resets the column to show all values', async () => {
    const onChange = vi.fn();
    render(ColumnFilter, {
      props: { label: 'Typ', options: ['projektor'], selected: [], onChange }
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Filter Typ' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Alle auswählen' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
