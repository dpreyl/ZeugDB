/**
 * Mock-Implementierung von LightningFS für Tests.
 * isomorphic-git/lightningfs.js ist nur im Browser verfügbar
 * (IndexedDB-Abhängigkeit). Dieser Mock ersetzt ihn in Tests.
 */
export class LightningFS {
  private store = new Map<string, Uint8Array>();

  constructor(_db: IDBDatabase | string) {
    // leer
  }

  async init(): Promise<void> {
    // leer
  }

  async mount(): Promise<void> {
    // leer
  }

  async unmount(): Promise<void> {
    // leer
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.store.set(path, buf);
  }

  async readFile(path: string): Promise<Uint8Array> {
    const data = this.store.get(path);
    if (!data) throw new Error(`ENOENT: no such file or directory, '${path}'`);
    return new Uint8Array(data);
  }

  async readdir(dir: string): Promise<{ name: string; type: string }[]> {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    const names = new Set<string>();
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        const rel = key.slice(prefix.length);
        const file = rel.split('/')[0];
        if (file) names.add(file);
      }
    }
    return [...names].map(name => ({ name, type: 'file' }));
  }

  async unlink(path: string): Promise<void> {
    this.store.delete(path);
  }

  async mkdir(path: string, _opts?: { recursive?: boolean }): Promise<void> {
    // leer — Verzeichnisse werden implizit behandelt
  }

  async stat(path: string): Promise<{ size: number; mtime: Date; isFile(): boolean; isDirectory(): boolean }> {
    if (this.store.has(path)) {
      return { size: 0, mtime: new Date(), isFile: () => true, isDirectory: () => false };
    }
    return { size: 0, mtime: new Date(), isFile: () => false, isDirectory: () => true };
  }

  async lstat(path: string): Promise<{ size: number; mtime: Date; isFile(): boolean; isDirectory(): boolean }> {
    return this.stat(path);
  }

  async rmdir(_path: string): Promise<void> {
    // leer
  }
}
