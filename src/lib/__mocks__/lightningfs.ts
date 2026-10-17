/**
 * Mock-Implementierung von LightningFS für Tests.
 * isomorphic-git/lightningfs.js ist nur im Browser verfügbar
 * (IndexedDB-Abhängigkeit). Dieser Mock ersetzt ihn in Tests.
 */
export class LightningFS {
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
}
