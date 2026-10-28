import type { AssetBlockValues } from '$lib/components/asset-blocks.helpers';

export type InspectionCandidate = {
  id: string;
  designation: string;
  type: string;
  typeName: string;
  identifyingDetails: string[];
  locationId: string | null;
  location: string;
  searchValues: string[];
};

const IDENTIFYING_FIELD_NAMES = new Set([
  'hersteller',
  'fabrikat',
  'marke',
  'modell',
  'seriennummer',
  'inventarnummer'
]);

export type InspectionSearchScope = {
  locationId: string;
  allLocations: boolean;
};

const CURRENT_INSPECTION_MAX_AGE_MONTHS = 18;

export function getInspectionCandidateDetails(fields: Record<string, string>): string[] {
  return Object.entries(fields)
    .filter(([name, value]) =>
      IDENTIFYING_FIELD_NAMES.has(name.trim().toLocaleLowerCase('de-DE')) && value.trim() !== ''
    )
    .map(([name, value]) => `${name.trim()}: ${value.trim()}`);
}

export function hasCurrentDguvInspection(
  blocks: AssetBlockValues,
  now = new Date()
): boolean {
  if (Number.isNaN(now.getTime())) return false;
  const today = formatLocalDate(now);
  const cutoff = getDateMonthsBefore(now, CURRENT_INSPECTION_MAX_AGE_MONTHS);
  return Object.values(blocks.pruefung ?? {}).some(inspection => {
    const date = inspection['Prüfdatum'];
    return isValidDateOnly(date) && date >= cutoff && date <= today;
  });
}

export type InspectionMeasurement = {
  name: string;
  label: string;
  unit: string;
  legacyName?: string;
};

const MEASUREMENTS_BY_PROTECTION_CLASS: Record<string, InspectionMeasurement[]> = {
  I: [
    { name: 'Schutzleiterwiderstand (Ohm)', label: 'Schutzleiterwiderstand', unit: 'Ω' },
    { name: 'Isolationswiderstand (MOhm)', label: 'Isolationswiderstand', unit: 'MΩ' },
    {
      name: 'Ableitstrom IPE (mA)',
      label: 'Ableitstrom IPE',
      unit: 'mA',
      legacyName: 'Ableitstrom (mA)'
    }
  ],
  II: [
    { name: 'Isolationswiderstand (MOhm)', label: 'Isolationswiderstand', unit: 'MΩ' },
    {
      name: 'Ableitstrom IBERÜH (mA)',
      label: 'Ableitstrom IBERÜH',
      unit: 'mA',
      legacyName: 'Ableitstrom (mA)'
    }
  ]
};

export function searchInspectionCandidates(
  candidates: InspectionCandidate[],
  query: string,
  scope: InspectionSearchScope
): InspectionCandidate[] {
  const normalizedQuery = normalizeSearchText(query.trim());

  return candidates
    .filter(candidate =>
      (scope.allLocations || (scope.locationId !== '' && candidate.locationId === scope.locationId)) &&
      (!normalizedQuery || [
          candidate.id,
          candidate.designation,
          candidate.type,
          candidate.typeName,
          ...candidate.searchValues
        ].some(value => normalizeSearchText(value).includes(normalizedQuery)))
    )
    .sort((left, right) =>
      left.designation.localeCompare(right.designation, 'de-DE', { numeric: true, sensitivity: 'base' }) ||
      left.id.localeCompare(right.id, 'de-DE', { numeric: true, sensitivity: 'base' })
    );
}

export function getMeasurementsForProtectionClass(
  protectionClass: string
): InspectionMeasurement[] | null {
  return MEASUREMENTS_BY_PROTECTION_CLASS[protectionClass] ?? null;
}

export function getNextInspectionIndex(blocks: AssetBlockValues): number {
  const indexes = Object.keys(blocks.pruefung ?? {})
    .filter(index => /^\d+$/.test(index))
    .map(Number)
    .filter(Number.isSafeInteger);
  return indexes.length > 0 ? Math.max(...indexes) + 1 : 0;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de-DE');
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateMonthsBefore(date: Date, months: number): string {
  const firstOfTargetMonth = new Date(Date.UTC(date.getFullYear(), date.getMonth() - months, 1));
  const lastDay = new Date(Date.UTC(
    firstOfTargetMonth.getUTCFullYear(),
    firstOfTargetMonth.getUTCMonth() + 1,
    0
  )).getUTCDate();
  firstOfTargetMonth.setUTCDate(Math.min(date.getDate(), lastDay));
  return firstOfTargetMonth.toISOString().slice(0, 10);
}

function isValidDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
