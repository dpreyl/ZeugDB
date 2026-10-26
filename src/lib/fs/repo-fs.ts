/**
 * Dateisystem-Interface für das Git-Repo.
 * Im Browser: isomorphic-git + LightningFS.
 * In Tests: In-Memory Mock.
 */
export interface RepoFs {
  writeFile(path: string, content: string): Promise<void>;
  writeFileBinary(path: string, content: Uint8Array): Promise<void>;
  readFile(path: string): Promise<string>;
  readBinaryFile(path: string): Promise<Uint8Array>;
  readdir(dir: string): Promise<string[]>;
  unlink(path: string): Promise<void>;
}

/**
 * Erzeugt ein in-memory Dateisystem für Tests.
 */
export function createMockFs(): RepoFs {
  const textStore = new Map<string, string>();
  const binaryStore = new Map<string, Uint8Array>();

  return {
    async writeFile(path: string, content: string): Promise<void> {
      textStore.set(path, content);
    },

    async readFile(path: string): Promise<string> {
      const content = textStore.get(path);
      if (content === undefined) throw new Error(`Datei nicht gefunden: ${path}`);
      return content;
    },

    async writeFileBinary(path: string, content: Uint8Array): Promise<void> {
      binaryStore.set(path, content);
    },

    async readBinaryFile(path: string): Promise<Uint8Array> {
      const data = binaryStore.get(path);
      if (data === undefined) throw new Error(`Datei nicht gefunden: ${path}`);
      return data;
    },

    async readdir(dir: string): Promise<string[]> {
      const prefix = dir.endsWith('/') ? dir : `${dir}/`;
      const files = new Set<string>();
      for (const key of [...textStore.keys(), ...binaryStore.keys()]) {
        if (key.startsWith(prefix)) {
          const rel = key.slice(prefix.length);
          const file = rel.split('/')[0];
          if (file) files.add(file);
        }
      }
      return [...files].sort();
    },

    async unlink(path: string): Promise<void> {
      textStore.delete(path);
      binaryStore.delete(path);
    }
  };
}

