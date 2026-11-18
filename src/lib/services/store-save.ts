import { getEditMode } from '../stores/edit-mode.svelte';
import { commitAllToGit, getGitRepo } from './git.service';
import { getLatestEditSummary } from './git-history';
import { persistStore } from './init';

/**
 * Persistiert eine Benutzeränderung lokal und sichert sie sofort als Git-Commit
 * im aktiven Edit-Branch. Ein Commit auf main oder einem falschen Branch wird
 * ausdrücklich verhindert.
 */
export async function saveStoreChanges(message: string): Promise<string | null> {
  const editMode = getEditMode();
  if (!editMode.isEditing || !editMode.branch) {
    throw new Error('Speichern ist nur im Änderungsmodus möglich');
  }

  const repo = await getGitRepo();
  if (await repo.getCurrentBranch() !== editMode.branch) {
    throw new Error('Das lokale Repository ist nicht auf dem aktiven Edit-Branch');
  }

  persistStore();
  const author = editMode.username || 'user';
  const commit = await commitAllToGit(message, author, `${author}@zeugdb.local`);
  if (commit) {
    try {
      editMode.lastChangeSummary = await getLatestEditSummary(repo, editMode.branch) ?? { label: message };
    } catch {
      // Eine fehlende Zusammenfassung darf ein erfolgreiches Speichern nicht als Fehler melden.
      editMode.lastChangeSummary = { label: message };
    }
  }
  return commit;
}
