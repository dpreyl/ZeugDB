export type InspectionSession = {
  examiner: string;
  locationId: string;
};

const STORAGE_KEY = 'zeugdb:dguv-session';

export function loadInspectionSession(
  storage: Pick<Storage, 'getItem'> = localStorage
): InspectionSession {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { examiner: '', locationId: '' };
    const saved = JSON.parse(raw) as Partial<InspectionSession>;
    return {
      examiner: typeof saved.examiner === 'string' ? saved.examiner : '',
      locationId: typeof saved.locationId === 'string' ? saved.locationId : ''
    };
  } catch {
    return { examiner: '', locationId: '' };
  }
}

export function saveInspectionSession(
  session: InspectionSession,
  storage: Pick<Storage, 'setItem'> = localStorage
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(session));
}
