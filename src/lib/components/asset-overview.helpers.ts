export type AssetOverviewField = 'bezeichnung' | 'typ' | 'standort' | 'geaendert';

export type AssetOverviewRow = {
  id: string;
  bezeichnung: string;
  typ: string;
  standort: string;
  geaendert: string;
};

export type AssetOverviewFilters = Partial<Record<AssetOverviewField, string[] | null>>;

export function getAssetFilterOptions(
  rows: AssetOverviewRow[],
  field: AssetOverviewField
): string[] {
  return [...new Set(rows.map(row => row[field]))].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  );
}

export function filterAssetRows(
  rows: AssetOverviewRow[],
  filters: AssetOverviewFilters
): AssetOverviewRow[] {
  return rows.filter(row =>
    (Object.entries(filters) as [AssetOverviewField, string[] | null][]).every(([field, selected]) =>
      selected === undefined || selected === null || selected.includes(row[field])
    )
  );
}
