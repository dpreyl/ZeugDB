const STORAGE_RESERVE_BYTES = 20 * 1024 * 1024;

export interface StorageEstimate {
  usage: number;
  quota: number;
}

/**
 * Browser geben keine zuverlässige freie Geräte-Speichermenge preis.
 * Wir verwenden daher die Origin-Quota und halten einen Sicherheitsabstand frei.
 */
export function canDownloadPreviews(
  estimate: StorageEstimate | null,
  requiredBytes: number
): boolean {
  if (!Number.isFinite(requiredBytes) || requiredBytes < 0) return false;
  if (requiredBytes === 0) return true;
  if (!estimate || !Number.isFinite(estimate.usage) || !Number.isFinite(estimate.quota)
    || estimate.usage < 0 || estimate.quota <= estimate.usage) return false;

  const reserve = Math.max(STORAGE_RESERVE_BYTES, estimate.quota * 0.05);
  return estimate.quota - estimate.usage >= requiredBytes + reserve;
}

export async function estimateBrowserStorage(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.usage === undefined || estimate.quota === undefined) return null;
    return { usage: estimate.usage, quota: estimate.quota };
  } catch {
    return null;
  }
}
