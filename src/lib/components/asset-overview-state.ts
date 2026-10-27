import type { AssetOverviewField, AssetOverviewFilters } from './asset-overview.helpers';

const STORAGE_KEY = 'zeugdb:asset-overview';
const FILTER_FIELDS: AssetOverviewField[] = ['bezeichnung', 'typ', 'standort', 'geaendert'];

export type AssetOverviewState = {
  filters: AssetOverviewFilters;
  searchQuery: string;
};

const EMPTY_STATE: AssetOverviewState = { filters: {}, searchQuery: '' };

export function loadAssetOverviewState(): AssetOverviewState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;

    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== 'object') return EMPTY_STATE;
    const candidate = stored as Record<string, unknown>;
    const filters: AssetOverviewFilters = {};

    if (candidate.filters && typeof candidate.filters === 'object') {
      for (const field of FILTER_FIELDS) {
        const selected = (candidate.filters as Record<string, unknown>)[field];
        if (selected === null || (Array.isArray(selected) && selected.every(value => typeof value === 'string'))) {
          filters[field] = selected as string[] | null;
        }
      }
    }

    return {
      filters,
      searchQuery: typeof candidate.searchQuery === 'string' ? candidate.searchQuery : ''
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveAssetOverviewState(state: AssetOverviewState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Der Listenstatus ist Komfortfunktion; blockierter Speicher darf die Liste nicht verhindern.
  }
}
