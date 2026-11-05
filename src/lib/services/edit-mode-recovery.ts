import { getGitRepo } from './git.service';
import { getEditMode } from '$lib/stores/edit-mode.svelte';
import { hasLocalStoreChanges } from './store-git-diff';

/**
 * Stellt den Schreibmodus anhand des lokalen Git-Repositorys wieder her.
 * Ein vorhandener Edit-Branch ist maßgeblich; uncommittete Änderungen auf
 * main werden zuerst auf einen neuen Edit-Branch übernommen.
 */
export async function recoverEditMode(username: string): Promise<void> {
  const repo = await getGitRepo();
  if (!(await repo.isInitialized())) return;

  const branch = await repo.getCurrentBranch();
  const editMode = getEditMode();
  if (branch?.startsWith('edit/')) {
    editMode.resumeEditMode(branch, username);
    return;
  }

  if (editMode.isEditing) return;
  const gitChanges = await repo.status();
  const hasUnsyncedStoreData = gitChanges.length === 0 && await hasLocalStoreChanges(repo);
  if (gitChanges.length === 0 && !hasUnsyncedStoreData) return;

  editMode.enterEditMode(username, `${username}@zeugdb.local`);
  const editBranch = editMode.branch;
  if (!editBranch) {
    editMode.discard();
    throw new Error('Edit-Branch für lokale Änderungen konnte nicht erstellt werden');
  }

  try {
    await repo.createBranch(editBranch);
    await repo.checkoutBranch(editBranch);
  } catch (error) {
    editMode.discard();
    throw error;
  }
}
