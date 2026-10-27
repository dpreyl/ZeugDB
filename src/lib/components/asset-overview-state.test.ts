import { afterEach, describe, expect, it } from 'vitest';
import type { AssetOverviewState } from './asset-overview-state';
import { loadAssetOverviewState, saveAssetOverviewState } from './asset-overview-state';

describe('asset overview state', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('restores filters and search query after navigating away from the list', () => {
    const state: AssetOverviewState = {
      filters: { standort: ['raum-1', 'raum-2'], typ: ['kamera'] },
      searchQuery: 'Prüfung'
    };

    saveAssetOverviewState(state);

    expect(loadAssetOverviewState()).toEqual(state);
  });

  it('returns an empty state when saved data is malformed', () => {
    sessionStorage.setItem('zeugdb:asset-overview', '{broken');

    expect(loadAssetOverviewState()).toEqual({ filters: {}, searchQuery: '' });
  });
});
