import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AssetSummary from './AssetSummary.svelte';

afterEach(cleanup);

describe('AssetSummary', () => {
  it('shows the asset name, type, location and map link', () => {
    render(AssetSummary, {
      props: {
        designation: 'Mischpult',
        type: 'mixer',
        locationId: 'room-1',
        locationName: 'Bühne'
      }
    });

    expect(screen.getByText('Mischpult')).toBeTruthy();
    expect(screen.getByText('mixer')).toBeTruthy();
    expect(screen.getByText('Bühne')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Auf der Standortkarte ansehen' }).getAttribute('href'))
      .toContain('/locations');
  });
});
