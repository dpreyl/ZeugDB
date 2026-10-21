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

  it('renders asset_ref as a selector containing only compatible assets', () => {
    const refField: FieldType = {
      nr: 0,
      name: 'Kabel',
      art: 'asset_ref',
      optionen: 'kabel',
      pflicht: false,
      sensitiv: false
    };
    render(AssetTypeFields, {
      props: {
        fields: [refField],
        values: {},
        editable: true,
        onValueChange: () => {},
        assets: [
          { id: 'cable-1', type: 'hdmi-kabel', label: 'HDMI-Kabel · cable-1' },
          { id: 'projector-1', type: 'projektor', label: 'Projektor · projector-1' }
        ],
        types: [
          { id: 'kabel', fields: [], blocks: [] },
          { id: 'hdmi-kabel', extends: 'kabel', fields: [], blocks: [] },
          { id: 'projektor', fields: [], blocks: [] }
        ]
      }
    });

    const selector = screen.getByLabelText('Kabel') as HTMLSelectElement;
    expect([...selector.options].map(option => option.value)).toContain('cable-1');
    expect([...selector.options].map(option => option.value)).not.toContain('projector-1');
  });

  it('excludes the currently edited asset from its own reference options', () => {
    const reference: FieldType = {
      nr: 0,
      name: 'Gerät',
      art: 'asset_ref',
      optionen: null,
      pflicht: false,
      sensitiv: false
    };
    render(AssetTypeFields, {
      props: {
        fields: [reference],
        values: {},
        editable: true,
        onValueChange: () => {},
        assets: [{ id: 'asset-1', type: 'projektor', label: 'Projektor · asset-1' }],
        excludedAssetId: 'asset-1'
      }
    });

    expect(screen.queryByRole('option', { name: 'Projektor · asset-1' })).toBeNull();
  });
});
