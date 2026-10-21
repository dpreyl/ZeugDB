import * as git from 'isomorphic-git';
import LightningFS from '@isomorphic-git/lightning-fs';
import * as HTTP from 'isomorphic-git/http/web';
import { installBufferPolyfill } from './buffer-polyfill';
import type { RepoFs } from '../fs/repo-fs';

installBufferPolyfill();

function normalizeFsPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

/**
 * Git-Authentifizierungsdaten.
 */
export interface GitAuth {
  username: string;
  token: string;
}

/**
 * Fortschritts-Info für lange Git-Operationen.
 */
export interface GitProgress {
  message: string;
  percent?: number;
}

/**
 * Minimaler Status-Eintrag pro Datei.
 */
export interface StatusEntry {
  file: string;
  before: number | null;
  after: number | null;
}

/**
 * Initialisiert das lokale Git-Repo mit LightningFS (IndexedDB-backed).
 * Dateioperationen nutzen LightningFS direkt;
 * Git-Operationen (init, clone, push, pull, commit) nutzen isomorphic-git.
 */
export class GitRepo implements RepoFs {
  private fs: InstanceType<typeof LightningFS>;

  constructor(name = 'zeugdb-git') {
    this.fs = new LightningFS(name);
  }

  getFs(): InstanceType<typeof LightningFS> {
    return this.fs;
  }

  // --- RepoFs (Dateisystem) ---

  async writeFile(path: string, content: string): Promise<void> {
    const fsPath = normalizeFsPath(path);
    const separator = fsPath.lastIndexOf('/');
    if (separator > 0) {
      const parent = fsPath.slice(1, separator);
      let directory = '/';

      for (const segment of parent.split('/')) {
        directory = `${directory.replace(/\/$/, '')}/${segment}`;
        try {
          await this.fs.promises.mkdir(directory);
        } catch (error) {
          if ((error as { code?: string }).code !== 'EEXIST') {
            throw error;
          }
        }
      }
    }
    await this.fs.promises.writeFile(fsPath, new TextEncoder().encode(content));
  }

  async readFile(path: string): Promise<string> {
    const data = await this.fs.promises.readFile(normalizeFsPath(path));
    return new TextDecoder().decode(data);
  }

  async readdir(dir: string): Promise<string[]> {
    return this.fs.promises.readdir(normalizeFsPath(dir));
  }

  async unlink(path: string): Promise<void> {
    await this.fs.promises.unlink(normalizeFsPath(path));
  }

  // --- Git-Operationen ---

  /**
   * Initialisiert ein neues Git-Repo.
   */
  async init(opts: { authorName: string; authorEmail: string }): Promise<void> {
    await git.init({ fs: this.fs, dir: '/' });
    // Schreiben der User-Konfiguration ins Config-File
    await this.fs.promises.writeFile(
      '/.git/config',
      `[user]\n\tname = ${opts.authorName}\n\temail = ${opts.authorEmail}\n`
    );
  }

  /**
   * Klont ein Remote-Repo.
   */
  async clone(opts: {
    url: string;
    auth: GitAuth;
    onprogress?: (progress: GitProgress) => void;
  }): Promise<void> {
    await git.clone({
      fs: this.fs,
      http: HTTP,
      dir: '/',
      url: opts.url,
      onProgress: (p: { message?: string; loaded: number; total: number }) => {
        opts.onprogress?.({
          message: `${p.message || 'Klone...'} (${p.loaded}/${p.total})`,
          percent: p.total ? Math.round((p.loaded / p.total) * 100) : undefined
        });
      },
      headers: {
        'Authorization': `Basic ${btoa(`${opts.auth.username}:${opts.auth.token}`)}`
      }
    });
  }

  /**
   * Pusht Änderungen zum Remote.
   */
  async push(opts: {
    remote?: string;
    branch?: string;
    auth: GitAuth;
    onprogress?: (progress: GitProgress) => void;
  }): Promise<string[]> {
    await git.push({
      fs: this.fs,
      http: HTTP,
      dir: '/',
      remote: opts.remote ?? 'origin',
      ref: opts.branch ? `refs/heads/${opts.branch}` : undefined,
      onProgress: (p: { message?: string; loaded: number; total: number }) => {
        opts.onprogress?.({
          message: `${p.message || 'Pushe...'} (${p.loaded}/${p.total})`,
          percent: p.total ? Math.round((p.loaded / p.total) * 100) : undefined
        });
      },
      headers: {
        'Authorization': `Basic ${btoa(`${opts.auth.username}:${opts.auth.token}`)}`
      }
    });
    return [];
  }

  /**
   * Zieht Änderungen vom Remote.
   */
  async pull(opts: {
    remote?: string;
    branch?: string;
    auth: GitAuth;
    author: { name: string; email: string };
    onprogress?: (progress: GitProgress) => void;
  }): Promise<void> {
    await git.pull({
      fs: this.fs,
      http: HTTP,
      dir: '/',
      remote: opts.remote ?? 'origin',
      ref: opts.branch ? `refs/heads/${opts.branch}` : undefined,
      onProgress: (p: { message?: string; loaded: number; total: number }) => {
        opts.onprogress?.({
          message: `${p.message || 'Ziehe...'} (${p.loaded}/${p.total})`,
          percent: p.total ? Math.round((p.loaded / p.total) * 100) : undefined
        });
      },
      headers: {
        'Authorization': `Basic ${btoa(`${opts.auth.username}:${opts.auth.token}`)}`
      },
      author: opts.author
    });
  }

  /**
   * Commitet aktuelle Änderungen.
   * Stage-Dateien via git.add, dann git.commit.
   */
  async commit(opts: {
    message: string;
    authorName: string;
    authorEmail: string;
    files?: string[];
    deletedFiles?: string[];
  }): Promise<string> {
    // Optional: nur bestimmte Dateien adden
    if (opts.files && opts.files.length > 0) {
      for (const file of opts.files) {
        await git.add({ fs: this.fs, dir: '/', filepath: file });
      }
    }
    if (opts.deletedFiles) {
      for (const file of opts.deletedFiles) {
        await git.remove({ fs: this.fs, dir: '/', filepath: file });
      }
    }
    return git.commit({
      fs: this.fs,
      dir: '/',
      message: opts.message,
      author: {
        name: opts.authorName,
        email: opts.authorEmail
      }
    });
  }

  /**
   * Prüft, ob ein Repo initialisiert ist.
   */
  async isInitialized(): Promise<boolean> {
    try {
      return (await git.currentBranch({ fs: this.fs, dir: '/' })) !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Gibt Dateien zurück, deren Arbeitsbaum oder Index vom HEAD abweicht.
   */
  async status(): Promise<StatusEntry[]> {
    try {
      const matrix = await git.statusMatrix({ fs: this.fs, dir: '/' });
      return matrix.flatMap(([file, head, workdir, stage]) => {
        if (head === workdir && workdir === stage) return [];
        const after = head !== stage ? stage : workdir;
        return [{
          file,
          before: head === 0 ? null : head,
          after: after === 0 ? null : after
        }];
      });
    } catch {
      return [];
    }
  }

  /**
   * Gibt die Remote-URL zurück.
   */
  async getRemoteUrl(remote = 'origin'): Promise<string | undefined> {
    const remotes = await git.listRemotes({ fs: this.fs, dir: '/' });
    const entry = remotes.find(r => r.remote === remote);
    return entry?.url;
  }

  /**
   * Erstellt einen neuen Branch am aktuellen HEAD (ohne Checkout).
   */
  async createBranch(ref: string): Promise<void> {
    await git.branch({
      fs: this.fs,
      dir: '/',
      ref,
      checkout: false
    });
  }

  /**
   * Wechselt zu einem bestehenden Branch.
   */
  async checkoutBranch(ref: string): Promise<void> {
    await git.checkout({
      fs: this.fs,
      dir: '/',
      ref,
      force: false
    });
  }

  /**
   * Gibt den aktuellen Branch-Namen zurück.
   */
  async getCurrentBranch(): Promise<string | undefined> {
    const result = await git.currentBranch({ fs: this.fs, dir: '/' });
    return result ?? undefined;
  }

  /**
   * Führt einen Merge durch.
   * Bei squash=true wird ein Squash-Merge durchgeführt (Merge ohne Update,
   * dann manueller Commit).
   */
  async mergeBranch(opts: {
    branch: string;
    authorName: string;
    authorEmail: string;
    squash?: boolean;
    message?: string;
  }): Promise<void> {
    if (opts.squash) {
      // Squash-Merge: Änderungen mergen, aber keinen Merge-Commit erstellen
      const mergeResult = await git.merge({
        fs: this.fs,
        dir: '/',
        theirs: opts.branch,
        fastForward: false,
        noUpdateBranch: true,
        author: {
          name: opts.authorName,
          email: opts.authorEmail
        }
      });
      if (!mergeResult.tree) return;

      // Der Merge-Baum enthält die zusammengeführten Dateien. Ein Commit
      // ohne expliziten Baum würde nur den unveränderten Index committen.
      await git.commit({
        fs: this.fs,
        dir: '/',
        message: opts.message ?? `Squash merge ${opts.branch}`,
        tree: mergeResult.tree,
        author: {
          name: opts.authorName,
          email: opts.authorEmail
        }
      });
    } else {
      await git.merge({
        fs: this.fs,
        dir: '/',
        theirs: opts.branch,
        author: {
          name: opts.authorName,
          email: opts.authorEmail
        },
        fastForward: true
      });
    }
  }

  /**
   * Fetcht Änderungen vom Remote ohne Merge.
   */
  async fetchFromRemote(opts: {
    remote?: string;
    auth: { username: string; token: string };
  }): Promise<void> {
    await git.fetch({
      fs: this.fs,
      http: HTTP,
      dir: '/',
      remote: opts.remote ?? 'origin',
      headers: {
        'Authorization': `Basic ${btoa(`${opts.auth.username}:${opts.auth.token}`)}`
      }
    });
  }

  /**
   * Löscht einen lokalen Branch.
   */
  async deleteBranch(ref: string): Promise<void> {
    await git.deleteBranch({
      fs: this.fs,
      dir: '/',
      ref
    });
  }
}

