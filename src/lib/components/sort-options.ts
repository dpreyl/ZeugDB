export function sortByLabel<T>(options: readonly T[], getLabel: (option: T) => string): T[] {
  return [...options].sort((left, right) =>
    getLabel(left).localeCompare(getLabel(right), 'de-DE', { numeric: true, sensitivity: 'base' })
  );
}
