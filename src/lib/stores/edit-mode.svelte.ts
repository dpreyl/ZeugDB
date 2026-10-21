/**
 * Zentraler Edit-Mode-Zustand.
 *
 * Workflow:
 *   Read-Only → enterEditMode() → Branch erstellen → bearbeiten → Commit
 *   Sync → Fetch + Squash Merge → Push → Read-Only
 */
export interface EditMode {
  /** Ob aktuell im Schreibmodus. */
  isEditing: boolean;
  /** Der Edit-Branch (null im Read-Only Modus). */
  branch: string | null;
  /** Benutzer-Name (für Git-Commits). */
  username: string | null;

  /** In den Schreibmodus wechseln — erzeugt neuen Branch. */
  enterEditMode(username: string, email: string): void;

  /** Änderungen verwerfen — zurück zu Read-Only. */
  discard(): void;

  /** Sync abgeschlossen — zurück zu Read-Only. */
  finishEdit(): void;
}

const EDIT_SESSION_KEY = 'zeugdb:edit-session';

class EditModeImpl implements EditMode {
  public isEditing = $state(false);
  public branch: string | null = $state(null);
  public username: string | null = $state(null);

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const stored = sessionStorage.getItem(EDIT_SESSION_KEY);
      if (!stored) return;

      const session = JSON.parse(stored) as { branch?: unknown; username?: unknown };
      if (
        typeof session.branch !== 'string' ||
        !session.branch.startsWith('edit/') ||
        typeof session.username !== 'string'
      ) {
        sessionStorage.removeItem(EDIT_SESSION_KEY);
        return;
      }

      this.branch = session.branch;
      this.username = session.username;
      this.isEditing = true;
    } catch {
      // Unlesbare Sitzungsdaten werden ignoriert.
    }
  }

  private persistSession(): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      if (this.isEditing && this.branch && this.username) {
        sessionStorage.setItem(
          EDIT_SESSION_KEY,
          JSON.stringify({ branch: this.branch, username: this.username })
        );
      } else {
        sessionStorage.removeItem(EDIT_SESSION_KEY);
      }
    } catch {
      // Nicht verfügbaren Session-Speicher tolerieren.
    }
  }

  enterEditMode(username: string, email: string): void {
    if (this.isEditing) return; // bereits im Edit-Modus
    this.username = username;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const sessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    this.branch = `edit/${username}-${stamp}-${sessionId}`;
    this.isEditing = true;
    this.persistSession();
  }

  discard(): void {
    this.isEditing = false;
    this.branch = null;
    this.username = null;
    this.persistSession();
  }

  finishEdit(): void {
    this.isEditing = false;
    this.branch = null;
    this.username = null;
    this.persistSession();
  }
}

let _instance: EditModeImpl | null = null;

export function getEditMode(): EditMode {
  if (!_instance) _instance = new EditModeImpl();
  return _instance;
}

export function resetEditMode(): void {
  _instance = null;
}

