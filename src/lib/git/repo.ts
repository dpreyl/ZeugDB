import * as git from 'isomorphic-git';
import { LightningFS } from 'isomorphic-git/lightningfs.js';
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
 * Initialisiert das lokale Git-Repo mit LightningFS (IndexedDB-backed).
 * Gibt ein RepoFs-Interface zurück, das mit isomorphic-git arbeitet.
 */
export class GitRepo implements RepoFs {
  private fs: LightningFS;

  constructor(db: IDBDatabase) {
    this.fs = new LightningFS(db);
  }

  getFs(): LightningFS {
    return this.fs;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const encoded = new TextEncoder().encode(content);
    await git.writeBlob({ fs: this.fs, dir: '/', blob: encoded, path });
  }

  async readFile(path: string, _encoding: 'text' | 'binary'): Promise<string> {
    const blob = await git.readBlob({ fs: this.fs, dir: '/', path, integrity: false });
    return new TextDecoder().decode(blob as Uint8Array);
  }

  async readdir(dir: string): Promise<string[]> {
    const entries = await git.dir({ fs: this.fs, dir });
    return entries.map(e => e.path);
  }

  async unlink(path: string): Promise<void> {
    await git.delete({ fs: this.fs, dir: '/', path, force: true });
  }

  /**
   * Initialisiert ein neues Git-Repo.
   */
  async init(opts: { authorName: string; authorEmail: string }): Promise<void> {
    await git.init({ fs: this.fs, dir: '/' });
    await git.configure({ fs: this.fs, dir: '/', global: false, ...opts });
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
      dir: '/',
      url: opts.url,
      onprogress: (p) => {
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
    return git.push({
      fs: this.fs,
      dir: '/',
      remote: opts.remote ?? 'origin',
      ref: opts.branch ? `refs/heads/${opts.branch}` : undefined,
      onprogress: (p) => {
        opts.onprogress?.({
          message: `${p.message || 'Pushe...'} (${p.loaded}/${p.total})`,
          percent: p.total ? Math.round((p.loaded / p.total) * 100) : undefined
        });
      },
      headers: {
        'Authorization': `Basic ${btoa(`${opts.auth.username}:${opts.auth.token}`)}`
      }
    });
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
      dir: '/',
      remote: opts.remote ?? 'origin',
      ref: opts.branch ? `refs/heads/${opts.branch}` : undefined,
      onprogress: (p) => {
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
   * Commitet alle Änderungen.
   */
  async commit(opts: {
    message: string;
    authorName: string;
    authorEmail: string;
    files?: string[];
  }): Promise<string> {
    return git.commit({
      fs: this.fs,
      dir: '/',
      message: opts.message,
      author: {
        name: opts.authorName,
        email: opts.authorEmail
      },
      update: opts.files || []
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
   * Gibt die aktuellen Staging-Statusänderungen zurück.
   */
  async status(): Promise<
    { file: string; before: number | null; after: number | null }[]
  > {
    return git.status({ fs: this.fs, dir: '/' });
  }

  /**
   * Gibt die Remote-URL zurück.
   */
  async getRemoteUrl(remote = 'origin'): Promise<string | undefined> {
    return git.getConfigValue({
      fs: this.fs,
      dir: '/',
      property: 'url',
      searchKey: `remote "${remote}"`
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

