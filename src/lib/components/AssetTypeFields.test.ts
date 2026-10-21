import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AssetTypeFields from './AssetTypeFields.svelte';
import type { FieldType } from '$lib/parser/types';

const fields: FieldType[] = [
  { nr: 0, name: 'Leistung', art: 'number', optionen: null, pflicht: true, sensitiv: false },
  { nr: 1, name: 'Zustand', art: 'dropdown', optionen: 'neu|defekt', pflicht: false, sensitiv: false }
];

describe('AssetTypeFields', () => {
  it('renders defined fields with their input types, options and current values', async () => {
    const values: Record<string, string> = { Leistung: '4500', Zustand: 'neu' };
    render(AssetTypeFields, {
      props: {
        fields,
        values,
        editable: true,
        onValueChange: (name, value) => { values[name] = value; }
      }
    });

    expect((screen.getByLabelText(/Leistung/) as HTMLInputElement).type).toBe('number');
    expect((screen.getByLabelText(/Leistung/) as HTMLInputElement).required).toBe(true);
    expect((screen.getByLabelText(/Leistung/) as HTMLInputElement).value).toBe('4500');
    expect((screen.getByLabelText('Zustand') as HTMLSelectElement).value).toBe('neu');
    expect(screen.getByRole('option', { name: 'defekt' })).toBeTruthy();

    await fireEvent.input(screen.getByLabelText(/Leistung/), { target: { value: '5000' } });
    expect(values.Leistung).toBe('5000');
  });

  it('shows values as read-only text when editing is disabled', () => {
    render(AssetTypeFields, {
      props: { fields, values: { Leistung: '4500', Zustand: 'neu' }, editable: false, onValueChange: () => {} }
    });

    expect(screen.getByText('4500')).toBeTruthy();
    expect(screen.getByText('neu')).toBeTruthy();
    expect(screen.queryByLabelText(/Leistung/)).toBeNull();
  });
});
