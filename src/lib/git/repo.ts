import * as git from 'isomorphic-git';
import { LightningFS } from 'isomorphic-git/lightningfs.js';
import type { RepoFs } from '../fs/repo-fs';

/**
 * Initialisiert das lokale Git-Repo mit LightningFS (IndexedDB-backed).
 * Gibt ein RepoFs-Interface zurück, das mit isomorphic-git arbeitet.
 */
export class GitRepo implements RepoFs {
  private fs: LightningFS;

  constructor(db: IDBDatabase) {
    this.fs = new LightningFS(db);
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

  getFs(): LightningFS {
    return this.fs;
  }

  /**
   * Initialisiert ein neues Git-Repo.
   */
  async init(opts: { authorName: string; authorEmail: string }): Promise<void> {
    await git.init({ fs: this.fs, dir: '/' }).then(() => {
      return git.configure({ fs: this.fs, dir: '/', global: false, ...opts });
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

