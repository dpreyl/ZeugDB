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

class EditModeImpl implements EditMode {
  public isEditing = $state(false);
  public branch: string | null = $state(null);
  public username: string | null = $state(null);

  enterEditMode(username: string, email: string): void {
    if (this.isEditing) return; // bereits im Edit-Modus
    this.username = username;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    this.branch = `edit/${username}-${stamp}`;
    this.isEditing = true;
  }

  discard(): void {
    this.isEditing = false;
    this.branch = null;
    this.username = null;
  }

  finishEdit(): void {
    this.isEditing = false;
    this.branch = null;
    this.username = null;
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

