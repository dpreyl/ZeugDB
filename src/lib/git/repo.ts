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
  private promises: InstanceType<typeof LightningFS>['promises'];

  constructor(name = 'zeugdb-git') {
    this.fs = new LightningFS(name);
    this.promises = this.fs.promises;
  }

  getFs(): InstanceType<typeof LightningFS> {
    return this.fs;
  }

  // --- RepoFs (Dateisystem) ---

  async writeFile(path: string, content: string): Promise<void> {
    const fsPath = normalizeFsPath(path);
    await this.createParentDirectories(fsPath);
    await this.promises.writeFile(fsPath, new TextEncoder().encode(content));
  }

  async writeFileBinary(path: string, content: Uint8Array): Promise<void> {
    const fsPath = normalizeFsPath(path);
    await this.createParentDirectories(fsPath);
    await this.promises.writeFile(fsPath, content);
  }

  async readFile(path: string): Promise<string> {
    const data = await this.promises.readFile(normalizeFsPath(path));
    return new TextDecoder().decode(data);
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    return this.promises.readFile(normalizeFsPath(path));
  }

  async readdir(dir: string): Promise<string[]> {
    return this.promises.readdir(normalizeFsPath(dir));
  }

  async unlink(path: string): Promise<void> {
    await this.promises.unlink(normalizeFsPath(path));
  }

  private async createParentDirectories(path: string): Promise<void> {
    const parent = path.slice(0, path.lastIndexOf('/'));
    if (!parent || parent === '/') return;

    let directory = '';
    for (const segment of parent.slice(1).split('/')) {
      directory += `/${segment}`;
      try {
        await this.promises.mkdir(directory);
      } catch (error) {
        if ((error as { code?: string }).code !== 'EEXIST') throw error;
      }
    }
  }

  // --- Git-Operationen ---

  /**
   * Initialisiert ein neues Git-Repo.
   */
  async init(opts: { authorName: string; authorEmail: string }): Promise<void> {
    await git.init({ fs: this.fs, dir: '/' });
    // Schreiben der User-Konfiguration ins Config-File
    await this.promises.writeFile(
      '/.git/config',
      `[user]\n\tname = ${opts.authorName}\n\temail = ${opts.authorEmail}\n`
    );
    await this.promises.flush();
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
    await this.promises.flush();
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
    await this.promises.flush();
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
    await this.promises.flush();
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
    const oid = await git.commit({
      fs: this.fs,
      dir: '/',
      message: opts.message,
      author: {
        name: opts.authorName,
        email: opts.authorEmail
      }
    });
    await this.promises.flush();
    return oid;
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
    await this.createParentDirectories(`/.git/refs/heads/${ref}`);
    await git.branch({
      fs: this.fs,
      dir: '/',
      ref,
      checkout: false
    });
    await this.promises.flush();
  }

  /**
   * Wechselt zu einem bestehenden Branch.
   */
  async checkoutBranch(ref: string, force = false): Promise<void> {
    await git.checkout({
      fs: this.fs,
      dir: '/',
      ref,
      force
    });
    await this.promises.flush();
  }

  /**
   * Gibt den aktuellen Branch-Namen zurück.
   */
  async getCurrentBranch(): Promise<string | undefined> {
    const b = await git.currentBranch({ fs: this.fs, dir: '/' });
    return b || undefined;
  }

  /**
   * Führt einen Merge durch.
   * Bei squash=true wird ein Squash-Merge als Commit durchgeführt.
   */
  async mergeBranch(opts: {
    branch: string;
    authorName: string;
    authorEmail: string;
    squash?: boolean;
    message?: string;
  }): Promise<void> {
    if (opts.squash) {
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
      if (!mergeResult.tree) {
        await this.promises.flush();
        return;
      }

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
      await this.promises.flush();
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
      await this.promises.flush();
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
    await this.promises.flush();
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
    await this.promises.flush();
  }
}

