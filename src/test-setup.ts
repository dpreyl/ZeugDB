import { vi } from 'vitest';
import { createHash } from 'node:crypto';

// Mock browser APIs für jsdom-Umgebung
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Crypto API Mock (wird in jsdom nicht vollständig unterstützt)
if (!globalThis.crypto) {
  vi.stubGlobal('crypto', {
    getRandomValues: (buf: Uint8Array) => crypto.getRandomValues(buf)
  });
}

// crypto.subtle Mock für SHA-256 (wird für LFS-Pointer benötigt)
if (!globalThis.crypto?.subtle) {
  Object.assign(globalThis.crypto, {
    subtle: {
      digest: (_algo: string, data: ArrayBufferView): Promise<ArrayBuffer> => {
        const hash = createHash('sha256');
        const buf = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        hash.update(buf);
        return Promise.resolve(hash.digest().buffer as ArrayBuffer);
      }
    }
  });
}
