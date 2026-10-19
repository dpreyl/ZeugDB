import * as git from 'isomorphic-git';
import { LightningFS } from 'isomorphic-git/lightningfs.js';
import * as HTTP from 'isomorphic-git/http/web';
import type { RepoFs } from '../fs/repo-fs';

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
  private fs: LightningFS;

  constructor(db: IDBDatabase) {
    this.fs = new LightningFS(db);
  }

  getFs(): LightningFS {
    return this.fs;
  }

  // --- RepoFs (Dateisystem) ---

  async writeFile(path: string, content: string): Promise<void> {
    await this.fs.writeFile(path, new TextEncoder().encode(content));
  }

  async readFile(path: string): Promise<string> {
    const data = await this.fs.readFile(path);
    return new TextDecoder().decode(data);
  }

  async readdir(dir: string): Promise<string[]> {
    const entries = await this.fs.readdir(dir);
    return entries.map((e: { name: string }) => e.name);
  }

  async unlink(path: string): Promise<void> {
    await this.fs.unlink(path);
  }

  // --- Git-Operationen ---

  /**
   * Initialisiert ein neues Git-Repo.
   */
  async init(opts: { authorName: string; authorEmail: string }): Promise<void> {
    await git.init({ fs: this.fs, dir: '/' });
    // Schreiben der User-Konfiguration ins Config-File
    await this.fs.writeFile(
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
  }): Promise<string> {
    // Optional: nur bestimmte Dateien adden
    if (opts.files && opts.files.length > 0) {
      for (const file of opts.files) {
        await git.add({ fs: this.fs, dir: '/', filepath: file });
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
   * Gibt die aktuellen Statusänderungen zurück.
   * Nutzt git.listFiles als Approximation (isomorphic-git hat kein
   * directory-status; git.status benötigt einen konkreten filepath).
   */
  async status(): Promise<StatusEntry[]> {
    try {
      const files = await git.listFiles({ fs: this.fs, dir: '/' });
      return files.map(file => ({
        file,
        before: null,
        after: null
      }));
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
    return git.currentBranch({ fs: this.fs, dir: '/' });
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
    await git.merge({
      fs: this.fs,
      dir: '/',
      theirs: opts.branch,
      author: {
        name: opts.authorName,
        email: opts.authorEmail
      },
      fastForward: 'ff',
      squash: opts.squash ?? false,
      commitOptions: opts.squash ? {
        message: opts.message ?? `Squash merge ${opts.branch}`
      } : undefined
    });
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
      ref,
      force: true
    });
  }
}

/**
 * Öffnet (oder erstellt) die IndexedDB für das Git-Repo.
 */
export function openGitDb(name = 'zeugdb-git'): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      // LightningFS erstellt seine eigenen Objekte
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

