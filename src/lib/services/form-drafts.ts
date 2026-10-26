const DRAFT_PREFIX = 'zeugdb:form-draft:';

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function readFormDraft<T>(key: string): T | null {
  const store = storage();
  if (!store) return null;

  try {
    const value = store.getItem(`${DRAFT_PREFIX}${key}`);
    return value === null ? null : JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function writeFormDraft<T>(key: string, value: T): void {
  const store = storage();
  if (!store) return;

  try {
    store.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Form state must remain editable if browser storage is unavailable.
  }
}

export function clearFormDraft(key: string): void {
  storage()?.removeItem(`${DRAFT_PREFIX}${key}`);
}
