/**
 * Dateisystem-Interface für das Git-Repo.
 * Im Browser: isomorphic-git + LightningFS.
 * In Tests: In-Memory Mock.
 */
export interface RepoFs {
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string, encoding: 'text' | 'binary'): Promise<string | Uint8Array>;
  readdir(dir: string): Promise<string[]>;
  unlink(path: string): Promise<void>;
}

/**
 * Erzeugt ein in-memory Dateisystem für Tests.
 */
export function createMockFs(): RepoFs {
  const store = new Map<string, string>();

  return {
    async writeFile(path: string, content: string): Promise<void> {
      store.set(path, content);
    },

    async readFile(path: string): Promise<string> {
      const content = store.get(path);
      if (content === undefined) throw new Error(`Datei nicht gefunden: ${path}`);
      return content;
    },

    async readdir(dir: string): Promise<string[]> {
      const prefix = dir.endsWith('/') ? dir : `${dir}/`;
      const files = new Set<string>();
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          const rel = key.slice(prefix.length);
          const file = rel.split('/')[0];
          if (file) files.add(file);
        }
      }
      return [...files].sort();
    },

    async unlink(path: string): Promise<void> {
      store.delete(path);
    }
  };
}

